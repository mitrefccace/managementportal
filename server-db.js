'use strict';

// node modules
var AsteriskManager = require('asterisk-manager');
var bodyParser = require('body-parser');
var cookieParser = require('cookie-parser'); // the session is stored in a cookie, so we use this to parse it
var express = require('express');
var fs = require('fs');
var https = require('https');
var MongoClient = require('mongodb').MongoClient;
var nconf = require('nconf');
var openamAgent = require('openam-agent');
var request = require('request');
var session = require('express-session');
var socketioJwt = require('socketio-jwt');
var tcpp = require('tcp-ping');
var url = require('url');
var mysql = require('mysql');
var Json2csvParser = require('json2csv').Parser;
var redis = require('redis');

// additional helpers/utility functions
var getConfigVal = require('./helpers/utility').getConfigVal;
var logger = require('./helpers/logger');
var metrics = require('./controllers/metrics');
var report = require('./controllers/report');
var set_rgb_values = require('./helpers/utility').set_rgb_values;

var port = null; // set the port
var ami = null; // Asterisk AMI
var Queues = []; // Associative array
var Agents = []; // Associative array
var AgentStats = [];	// last stored stats on agents
var QueueStats = [];	// last stored stats on queues

var AgentMap = new Map(); //associate extension to agent database record;
var Asterisk_queuenames = [];

//declare constants for various config values
const COMMON_PRIVATE_IP = "common:private_ip";
const NGINX_FQDN = "nginx:fqdn";
const COLOR_CONFIG_JSON_PATH = "../dat/color_config.json";
const ASTERISK_SIP_PRIVATE_IP = "asterisk:sip:private_ip";
const AGENT_SERVICE_PORT = "agent_service:port";
const ACE_DIRECT_PORT = "ace_direct:https_listen_port";


var app = express(); // create our app w/ express

//Required for REST calls to self signed certificate servers
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

var cfile = '../dat/config.json'; // Config file
nconf.argv().env();
nconf.file({
	file: cfile
});
console.log('Config file: ' + cfile);
logger.info('Config file: ' + cfile);

var credentials = {
	key: fs.readFileSync(getConfigVal('common:https:private_key')),
	cert: fs.readFileSync(getConfigVal('common:https:certificate'))
};

// Redis Setup

// Redis keys/mappings
// Contains login name => JSON data passed from browser
var redisStatusMap = 'statusMap';
// Map of Agent information, key agent_id value JSON object
var redisAgentInfoMap = 'agentInfoMap';

// Create a connection to Redis
var redisClient = redis.createClient(getConfigVal('database_servers:redis:port'), getConfigVal('database_servers:redis:host'));

redisClient.on("error", function (err) {
	logger.error("");
	logger.error("**********************************************************");
	logger.error("REDIS CONNECTION ERROR: Please make sure Redis is running.");
	logger.error("**********************************************************");
	logger.error("");
	logger.error(err);
	console.error("");
	console.error("**********************************************************");
	console.error("REDIS CONNECTION ERROR: Please make sure Redis is running.");
	console.error("**********************************************************");
	console.error("");
	console.error(err);
});

//catch Redis warnings
redisClient.on("warning", function (wrn) {
	logger.warn('REDIS warning: ' + wrn);
});

redisClient.auth(getConfigVal('database_servers:redis:auth'));

redisClient.on('connect', function () {
	logger.info("Connected to Redis");
	console.log("Connected to Redis");
});


//get the ACE Direct version
var version = getConfigVal('common:version');
var year = getConfigVal('common:year');
logger.info("This is ACE Direct v" + version + ", Copyright " + year + ".");

//NGINX path parameter
var nginxPath = getConfigVal('nginx:mp_path');
if (nginxPath.length === 0) {
	//default for backwards compatibility
	nginxPath = "/ManagementPortal";
}

var agent = new openamAgent.PolicyAgent({
	serverUrl: 'https://' + getConfigVal(NGINX_FQDN) + ":" + getConfigVal('nginx:port') + '/' + getConfigVal('openam:path'),
	privateIP: getConfigVal('nginx:private_ip'),
	errorPage: function () {
		return '<html><body><h1>Access Error</h1></body></html>';
	}
});
var cookieShield = new openamAgent.CookieShield({
	getProfiles: false,
	cdsso: false,
	noRedirect: false,
	passThrough: false
});

app.use(cookieParser()); // must use cookieParser before expressSession
app.use(session({
	secret: getConfigVal('web_security:session:secret_key'),
	resave: getConfigVal('web_security:session:resave'),
	rolling: getConfigVal('web_security:session:rolling'),
	saveUninitialized: getConfigVal('web_security:session:save_uninitialized'),
	cookie: {
		maxAge: parseFloat(getConfigVal('web_security:session:max_age')),
		httpOnly: getConfigVal('web_security:session:http_only'),
		secure: getConfigVal('web_security:session:secure')
	}
}));
// set the view engine to ejs
app.set('view engine', 'ejs');
app.use(express.static(__dirname + '/public'));
app.use(bodyParser.urlencoded({
	'extended': 'true'
})); // parse application/x-www-form-urlencoded
app.use(bodyParser.json()); // parse application/json
app.use(bodyParser.json({
	type: 'application/vnd.api+json'
})); // parse application/vnd.api+json as json

nconf.defaults({ // if the port is not defined in the cocnfig.json file, default it to 8080
	dashboard: {
		'pollInterval': 10000
	},
	https: {
		'port-dashboard': 8090
	}
});

var fqdn = '';
if (nconf.get(NGINX_FQDN)) {
	fqdn = getConfigVal(NGINX_FQDN);
} else {
	logger.error('*** ERROR: ' + NGINX_FQDN + ' is required in dat/config.json.');
	console.error('*** ERROR: ' + NGINX_FQDN + ' is required in dat/config.json.');
	process.exit(-99);
}
var fqdnTrimmed = fqdn.trim(); // Remove the newline
var fqdnUrl = 'https://' + fqdnTrimmed + ':*';

port = parseInt(getConfigVal('management_portal:https_listen_port'));

var httpsServer = https.createServer(credentials, app);

var io = require('socket.io')(httpsServer, {
	cookie: false
});
io.set('origins', fqdnUrl);

//Pull MySQL configuration from config.json file
var dbHost = getConfigVal('database_servers:mysql:host');
var dbUser = getConfigVal('database_servers:mysql:user');
var dbPassword = getConfigVal('database_servers:mysql:password');
var dbName = getConfigVal('database_servers:mysql:ad_database_name');
var dbPort = parseInt(getConfigVal('database_servers:mysql:port'));
var vmTable = "videomail";

// Create MySQL connection and connect to the database
var dbConnection = mysql.createConnection({
	host: dbHost,
	user: dbUser,
	password: dbPassword,
	database: dbName,
	port: dbPort
});

dbConnection.connect();

// Keeps connection from Inactivity Timeout
setInterval(function () {
	dbConnection.ping();
}, 60000);

// Pull MongoDB configuration from config.json file
var mongodbUriEncoded = nconf.get('database_servers:mongodb:connection_uri');
var logAMIEvents = nconf.get('database_servers:mongodb:logAMIevents');
var logStats = nconf.get('database_servers:mongodb:logStats');
var logStatsFreq = nconf.get('database_servers:mongodb:logStatsFreq');
var mongodb;
var dbconn = null;
var colEvents = null;
var colStats = null;

//Connect to MongoDB
if (typeof mongodbUriEncoded !== 'undefined' && mongodbUriEncoded) {
	var mongodbUri = getConfigVal('database_servers:mongodb:connection_uri');
	// Initialize connection once
	MongoClient.connect(mongodbUri, { forceServerObjectId: true, useNewUrlParser: true }, function (err, database) {
		if (err) {
			logger.error('*** ERROR: Could not connect to MongoDB. Please make sure it is running.');
			console.error('*** ERROR: Could not connect to MongoDB. Please make sure it is running.');
			process.exit(-99);
		}

		console.log('MongoDB Connection Successful');
                dbconn = database;
		mongodb = database.db();

		// Start the application after the database connection is ready
		httpsServer.listen(port);
		console.log('https web server listening on ' + port);

		// prepare an entry into MongoDB to log the managementportal restart
		var ts = new Date();
		var data = {
			"Timestamp": ts.toISOString(),
			"Role": "managementportal",
			"Purpose": "Restarted"
		};

		if (logAMIEvents) {
			// first check if collection "events" already exist, if not create one
			mongodb.listCollections({ name: 'events' }).toArray((err, collections) => {
				console.log("try to find events collection, colEvents length: " + collections.length);
				if (collections.length == 0) {	// "stats" collection does not exist
					console.log("Creating new events colleciton in MongoDB");
					mongodb.createCollection("events", { capped: true, size: 1000000, max: 5000 }, function (err, result) {
						if (err) throw err;
						console.log("Collection events is created capped size 100000, max 5000 entries");
						colEvents = mongodb.collection('events');
					});
				}
				else {
					// events collection exist already
					console.log("Collection events exist");
					colEvents = mongodb.collection('events');
					// insert an entry to record the start of managementportal
					colEvents.insertOne(data, function (err, result) {
						if (err) {
							console.log("Insert a record into events collection of MongoDB, error: " + err);
							logger.debug("Insert a record into events collection of MongoDB, error: " + err);
							throw err;
						}
					});
				}
			});
		}

		if (logStats) {
			// first check if collection "stats" already exist, if not create one
			mongodb.listCollections({ name: 'callstats' }).toArray((err, collections) => {
				console.log("try to find stats collection, colStats length: " + collections.length);
				if (collections.length == 0) {	// "stats" collection does not exist
					console.log("Creating new stats colleciton in MongoDB");
					mongodb.createCollection("callstats", { capped: true, size: 1000000, max: 5000 }, function (err, result) {
						if (err) {
							console.log("Error creating collection for callstats in Mongo: " + err);
							logger.debug("Error creating collection for callstats in Mongo: " + err);
							throw err;
						}
						logger.info("Collection stats is created capped size 100000, max 5000 entries");
						colStats = mongodb.collection('callstats');
					});
				}
				else {	// stats collection exists already
					console.log("Collection stats exist, loading the last stats into managementportal, TBD");
					colStats = mongodb.collection('callstats');
					loadStatsinDB();
				}
			});
		}
	});
} else {
	console.log('Missing MongoDB Connection URI in config');

	httpsServer.listen(port);
	console.log('https web server listening on ' + port);
}

// Validates the token, if valid go to connection.
// If token is not valid, no connection will be established.
io.use(socketioJwt.authorize({
	secret: new Buffer(getConfigVal('web_security:json_web_token:secret_key'), getConfigVal('web_security:json_web_token:encoding')),
	timeout: parseInt(getConfigVal('web_security:json_web_token:timeout')), // seconds to send the authentication message
	handshake: getConfigVal('web_security:json_web_token:handshake')
}));

if (!fs.existsSync(COLOR_CONFIG_JSON_PATH) || !fs.existsSync('../dat/default_color_config.json')) {
	logger.error("color_config.json or default_color_config.json files do not exist in ../dat folder");
	console.log("color_config.json or default_color_config.json files do not exist in ../dat folder");
}

logger.info('Listen on port: ' + port);
var queuenames = getConfigVal('management_portal:queues');
var pollInterval = parseInt(getConfigVal('management_portal:poll_interval'));
var adUrl = 'https://' + getConfigVal(COMMON_PRIVATE_IP);
console.log("port number: " + port + ", poll interval:" + pollInterval);

Asterisk_queuenames = queuenames.split(",");

logger.info('****** Restarting server-db  ****');
logger.info('Asterisk queuename: ' + Asterisk_queuenames + ", Poll Interval: " + pollInterval);

io.sockets.on('connection', function (socket) {
	var numClients = 0;
	logger.info('io.socket connected, id: ' + socket.id);

	//emit AD version, year to clients
	socket.emit('adversion', {
		"version": version,
		"year": year
	});

	socket.on('config', function (message) {
		logger.debug('Got config message request: ' + message);
		var confobj = {
			host: getConfigVal(ASTERISK_SIP_PRIVATE_IP),
			realm: getConfigVal(ASTERISK_SIP_PRIVATE_IP),
			stun: getConfigVal('asterisk:sip:stun') + ":" + getConfigVal('asterisk:sip:stun_port'),
			wsport: parseInt(getConfigVal('asterisk:sip:ws_port')),
			channel: getConfigVal('asterisk:sip:channel'),
			websocket: "wss://" + getConfigVal(ASTERISK_SIP_PRIVATE_IP) + ":" + getConfigVal('asterisk:sip:ws_port') + "/ws"
		};

		socket.emit('sipconf', confobj);

		if (message === 'webuser') {
			var qobj = {
				queues: getConfigVal('management_portal:queues')
			};
			socket.emit('queueconf', qobj);
			logger.debug('Message is webuser type');
		}
	});

	// Handle incoming Socket.IO registration requests - add to the room
	socket.on('register-manager', function () {
		logger.info("Adding client socket to room: 'my room'");
		// Add this socket to my room
		socket.join('my room');
		sendResourceStatus();
	});

	// Manually get resource status
	socket.on('resource-status-update', function () {
		sendResourceStatus();
	});

	socket.on('ami-req', function (message) {
		logger.debug('Received AMI request: ' + message);

		if (message === 'agent') {
			socket.emit('agent-resp', {
				'agents': Agents
			});
			logger.debug('Sending agent resp');
		} else if (message === 'queue') {
			socket.emit('queue-resp', {
				'queues': Queues
			});
			logger.debug('Sending queue resp');
		}
	});

	socket.on('agent-help', function (data) {
		logger.debug('Received agent help data' + data);
		io.sockets.emit('agent-request', data);
	});

	socket.on('message', function (message) {
		logger.debug('Received message ' + message);
		socket.broadcast.emit('message', message); // should be room only
	});

	// Assume socket.io is at version 1.3.5, where the API for getting clients is completely
	// different from pre 1.0 version

	socket.on('create or join', function (room) {
		if (room !== '' && room !== undefined) {
			socket.join(room);
		}

		var roomObject = io.nsps['/'].adapter.rooms[room];
		if (roomObject !== null) {
			numClients = Object.keys(roomObject).length;
		}

		logger.info('Room ' + room + ' has ' + numClients + ' client(s)' + ' for client id:' + socket.id);
		logger.debug('Request to create or join room' + room);

		if (numClients === 1) {
			socket.emit('created', room);
		} else if (numClients === 2) {
			try {
				io.sockets.to(room).emit('join', room);
				socket.emit('joined', room);
			} catch (err) {
				logger.error('Socket error in create or join ');
			}
		} else { // max two clients
			socket.emit('full', room);
		}
		socket.emit('emit(): client ' + socket.id + ' joined room ' + room);
		socket.broadcast.emit('broadcast(): client ' + socket.id + ' joined room ' + room.toString());
	});

	socket.on('hangup', function (room) {
		socket.leave(room);
		logger.debug('Request to leave room ' + room.toString() + ', room has ' + numClients + " client(s)");
	});

	// Socket for Operating Status
	socket.on('hours-of-operation', function (data) {
		var url = 'https://' + getConfigVal(COMMON_PRIVATE_IP) + ':' + getConfigVal(AGENT_SERVICE_PORT) + "/OperatingHours";
		request({
			url: url,
			json: true
		}, function (err, res, hourData) {
			if (err) {
				logger.error("Aserver error: " + err);
			} else {
				switch (hourData.business_mode) {
					case 0:
						hourData.business_mode = 'NORMAL';
						break;
					case 1:
						hourData.business_mode = 'FORCE_OPEN';
						break;
					case 2:
						hourData.business_mode = 'FORCE_CLOSE';
						break;
					default:
						hourData.business_mode = 'NORMAL';
						break;
				}

				io.to(socket.id).emit("hours-of-operation-response", hourData);
			}
		});
	}).on("hours-of-operation-update", function (data) {
		if (data.start && data.end) {
			var requestJson = {
				start: data.start,
				end: data.end
			};

			switch (data.business_mode) {
				case 'NORMAL':
					requestJson.business_mode = 0;
					break;
				case 'FORCE_OPEN':
					requestJson.business_mode = 1;
					break;
				case 'FORCE_CLOSE':
					requestJson.business_mode = 2;
					break;
				default:
					requestJson.business_mode = 0;
					break;
			}

			request({
				method: 'POST',
				url: 'https://' + getConfigVal(COMMON_PRIVATE_IP) + ':' + getConfigVal(AGENT_SERVICE_PORT) + "/OperatingHours",
				headers: {
					'Content-Type': 'application/json'
				},
				body: requestJson,
				json: true
			}, function (error, response, data) {
				if (error) {
					logger.error("Aserver error: " + error);
				} else {

					io.to(socket.id).emit("hours-of-operation-update-response", data);
				}
			});
		}
	});

	// Socket for CDR table
	socket.on('cdrtable-get-data', function (data) {
		var url = 'https://' + getConfigVal(COMMON_PRIVATE_IP) + ':' + getConfigVal('acr_cdr:https_listen_port') + "/getallcdrrecs";
		var format = data.format;
		if (data.start && data.end) {
			url += '?start=' + data.start + '&end=' + data.end;
		}
		// ACR-CDR getallcdrrecs RESTful call to get CDR JSON string.
		console.log('CDRTABLE GET DATA');
		request({
			url: url,
			json: true
		}, function (err, res, cdrdata) {
			if (err) {
				io.to(socket.id).emit('cdrtable-error', {
					"message": "Error Accessing Data Records"
				});
			} else if (format === 'csv') {
				//csv field values
				var csvFields = ['calldate', 'clid', 'src',
					'dst', 'dcontext', 'channel',
					'dstchannel', 'lastapp', 'lastdata',
					'duration', 'billsec', 'disposition',
					'amaflags', 'accountcode', 'userfield',
					'uniqueid', 'linkedid', 'sequence',
					'peeraccount'
				];
				// Converts JSON object to a CSV file.
				let json2csvParser = new Json2csvParser({ csvFields });
				let csv = json2csvParser.parse(cdrdata.data);
				//returns CSV of Call Data Records
				io.to(socket.id).emit('cdrtable-csv', csv);
			} else {
				//returns JSON object of CDR
				io.to(socket.id).emit('cdrtable-data', cdrdata);
			}
		});
	});

	// Socket for Report table
	socket.on('reporttable-get-data', function (data) {
		var format = data.format;

		// console.log("reportStartDate: " + data.start);
		// console.log("reportEndDate: " + data.end);
		// console.log("reportFormat: " + format);

		var reportStartDate = new Date(data.start);
		var reportEndDate = new Date(data.end);
		var timezone = data.timezone;
		report.createReport(mongodb, reportStartDate.getTime(), reportEndDate.getTime(), timezone, function (reportdata) {
			if (format === 'csv') {
				//csv field values
				var csvFields = ['date', 'callshandled', 'callsabandoned',
					'videomails', 'webcalls'];
				// Converts JSON object to a CSV file.
				let json2csvParser = new Json2csvParser({ csvFields });
				let csv = json2csvParser.parse(reportdata.data);
				//returns Report Data
				io.to(socket.id).emit('reporttable-csv', csv);
			} else {
				//returns JSON object of Report
				io.to(socket.id).emit('reporttable-data', reportdata);
			}
		});
	});

	socket.on('metrics-get-data', function (data) {
		if (data.start && data.end) {
			// Set start and end internally
			// Eventually store them in redis.
			var metricsStartDate = new Date(data.start);
			var metricsEndDate = new Date(data.end);
			metrics.createMetrics(mongodb, metricsStartDate.getTime(), metricsEndDate.getTime(), function (metrics) {
				io.to('my room').emit('metrics', metrics);
			});
		}
	});

	// ######################################
	//Retrieval of videomail records from the database
	socket.on("get-videomail", function (data) {
		logger.debug('entered get-videomail');

		let filterFlag = (data.filter === "ALL" || typeof data.filter === 'undefined') ? false : true;
		let sort = (typeof data.sortBy === 'undefined') ? [] : data.sortBy.split(" ");

		let vm_sql_select = `SELECT id, extension, callbacknumber, recording_agent, processing_agent,
			received, processed, video_duration, status, deleted, src_channel, dest_channel, unique_id,
			video_filename, video_filepath FROM ${vmTable}`;
		let vm_sql_where = `WHERE deleted = 0`;
		let vm_sql_order = ``;
		let vm_sql_params = [];

		if (filterFlag) {
			vm_sql_where += ` and status = ?`;
			vm_sql_params.push(data.filter);
		}
		if (sort.length == 2) {
			vm_sql_order = ` ORDER BY ??`;
			vm_sql_params.push(sort[0]);
			if (sort[1] == 'desc')
				vm_sql_order += ` DESC`;
		}

		let vm_sql_query = `${vm_sql_select} ${vm_sql_where} ${vm_sql_order};`;
		dbConnection.query(vm_sql_query, vm_sql_params, function (err, result) {
			if (err) {
				logger.error("GET-VIDEOMAIL ERROR: " + err.code);
			} else {
				io.to(socket.id).emit('got-videomail-recs', result);
			}
		});
		// Get videomail status summary for pie chart
		let vm_sql_count_query = `SELECT status AS 'label', COUNT(*) AS 'data' FROM ${vmTable} GROUP BY status;`;
		dbConnection.query(vm_sql_count_query, function (err, result) {
			if (err) {
				logger.error("GET-VIDEOMAIL ERROR: " + err.code);
			} else {
				logger.debug(result);
				io.to(socket.id).emit('videomail-status', result);
			}
		});
		// Additional status chart idea. Bar chart x-axis hour of day 0-23, y-axis number of videomails in each hour
		// select extract(hour from received) as theHour, count(*) as numberOfItems from videomail group by extract(hour from received);
		let vm_sql_deleteOld = `DELETE FROM ${vmTable} WHERE TIMESTAMPDIFF(DAY, deleted_time, CURRENT_TIMESTAMP) >= 14;`;
		dbConnection.query(vm_sql_deleteOld, function (err, result) {
			if (err) {
				logger.error('DELETE-OLD-VIDEOMAIL ERROR: ' + err.code);
			} else {
				logger.debug('Deleted old videomail');
			}
		});
	});

	//updates videomail records when the agent changes the status
	socket.on("videomail-status-change", function (data) {
		logger.debug('updating MySQL entry');
		let vm_sql_query = `UPDATE ${vmTable} SET status = ?, processed = CURRENT_TIMESTAMP,
			processing_agent = 'manager', deleted = 0, deleted_time = NULL, deleted_by = NULL  WHERE id = ?;`;
		let vm_sql_params = [data.status, data.id];
		logger.debug(vm_sql_query + " " + vm_sql_params);
		dbConnection.query(vm_sql_query, vm_sql_params, function (err, result) {
			if (err) {
				logger.error('VIDEOMAIL-STATUS-CHANGE ERROR: ' + err.code);
			} else {
				logger.debug(result);
				io.to(socket.id).emit('changed-status', result);
			}
		});
	});

	//changes the videomail status to READ if it was UNREAD before
	socket.on("videomail-read-onclick", function (data) {
		logger.debug('updating MySQL entry');
		let vm_sql_query = `UPDATE ${vmTable} SET status = 'READ',
		processed = CURRENT_TIMESTAMP, processing_agent = 'manager' WHERE id = ?;`;
		let vm_sql_params = [data.id];
		logger.debug(vm_sql_query + " " + vm_sql_params);
		dbConnection.query(vm_sql_query, vm_sql_params, function (err, result) {
			if (err) {
				logger.error('VIDEOMAIL-READ ERROR: ' + err.code);
			} else {
				logger.debug(result);
				io.to('my room').emit('changed-status', result);
			}
		});
	});

	//updates videomail records when the agent deletes the videomail. Keeps it in db but with a deleted flag
	socket.on("videomail-deleted", function (data) {
		logger.debug('updating MySQL entry');
		let vm_sql_query = `DELETE FROM ${vmTable} WHERE id = ?;`;
		let vm_sql_params = [data.id];
		logger.debug(vm_sql_query + " " + vm_sql_params);
		dbConnection.query(vm_sql_query, vm_sql_params,function (err, result) {
			if (err) {
				logger.error('VIDEOMAIL-DELETE ERROR: '+ err.code);
			} else {
				io.to('my room').emit('changed-status', result);
			}
		});
	});

	// Socket for Light Configuration
	//read color_config.json file for light configuration
	socket.on("get_color_config", function () {
		try {
			//send json file to client
			var file_path = COLOR_CONFIG_JSON_PATH;
			var data = fs.readFileSync(file_path, 'utf8');
			socket.emit("html_setup", data);
		} catch (ex) {
			logger.error('Error: ' + ex);
		}
	});

	//on light color config submit update current color_config.json file
	socket.on('submit', function (form_data) {
		try {
			var file_path = COLOR_CONFIG_JSON_PATH;
			var data = fs.readFileSync(file_path, 'utf8');
			var json_data = JSON.parse(data);
			for (var status in json_data.statuses) {
				var color_and_action = form_data[status].split('_'); //color_and_action[0] = color, color_and_action[1] = "blinking" or "solid"
				json_data.statuses[status].color = color_and_action[0].toLowerCase();
				json_data.statuses[status].stop = (color_and_action[0] == "off") ? true : false;
				json_data.statuses[status].blink = (color_and_action[1] == "blinking") ? true : false;
				json_data = set_rgb_values(json_data, status, color_and_action[0]);
			}
			fs.writeFile(file_path, JSON.stringify(json_data, null, 2), 'utf-8', function (err) {
				if (err) {
					logger.error('ERROR writing: ' + file_path);
					throw err;
				} else {
					//successful write
					//send request to AD  server
					var url2 = 'https://' + getConfigVal(COMMON_PRIVATE_IP) + ":" + parseInt(getConfigVal(ACE_DIRECT_PORT)) + "/updatelightconfigs";
					request({
						url: url2,
						json: true
					}, function (err, res, data) {
						if (err) {
							logger.error('ERROR sending request to adserver /updatelightconfigs');
						} else {
							logger.debug('SUCCESS sending request to adserver /updatelightconfigs');
						}
					});
				}
			});


		} catch (ex) {
			logger.error('Error: ' + ex);
		}
	});

	//sends the default_color_config.json data back to the management portal
	socket.on('reset-color-config', function () {
		try {
			var default_color_config = '../dat/default_color_config.json';
			var data = fs.readFileSync(default_color_config, 'utf8');
			socket.emit("update-colors", data);
		} catch (ex) {
			logger.error('Error: ' + ex);
			console.log('Error: ' + ex);
		}
	});

	// Forcefully logs out any agents that have been selected to be logged out in the Management Portal administration section
	socket.on('forceLogout', function (agents) {
		// Check to see if the force logout password is present in the config
		let forceLogoutPassword = getConfigVal('management_portal:force_logout_password');
		if (!forceLogoutPassword) {
			// Emit the event to the front end since we cant find a config value for the force logout password
			socket.emit('forceLogoutPasswordNotPresent');
		} else {
			// A password exists within the config file. Continue the force logout process
			// Create the data to send to ace direct
			let requestJson = { "agents": [] };
			agents.forEach(function (agent) {
				requestJson.agents.push(agent);
			});
			// Send a post request to ace direct force logout route
			let url = 'https://' + getConfigVal(COMMON_PRIVATE_IP) + ':' + getConfigVal(ACE_DIRECT_PORT) + "/forcelogout";
			request({
				method: 'POST',
				url: url,
				headers: {
					'Content-Type': 'application/json',
					// Pass in custom header containing the MP force logout password from the config file
					'force_logout_password': forceLogoutPassword
				},
				body: requestJson,
				json: true
			}, function (error, response, data) {
				if (error) {
					logger.error("adserver error: " + error);
				} else {
					console.log(`forcelogout response: ${JSON.stringify(response, null, 2, true)}`);
					console.log(`forcelogout response data: ${JSON.stringify(data, null, 2, true)}`);
				}
			});
		}
	});
});

//calls sendResourceStatus every minute
setInterval(sendResourceStatus, 60000);
setImmediate(initialize);

/**
 * Send Resoure status to Management Dashboard
 * @returns {undefined}
 */
function sendResourceStatus() {
	var hostMap = new Map();
	// list of resources to check for status
	hostMap.set("ACR-CDR", 'https://' + getConfigVal(COMMON_PRIVATE_IP) + ':' + getConfigVal('acr_cdr:https_listen_port'));
	hostMap.set("VRS Lookup", 'https://' + getConfigVal(COMMON_PRIVATE_IP) + ':' + getConfigVal('user_service:port'));
	hostMap.set("ACE Direct", 'https://' + getConfigVal(COMMON_PRIVATE_IP) + ':' + getConfigVal('ace_direct:https_listen_port'));

	hostMap.set("Zendesk", getConfigVal('zendesk:protocol') + '://' + getConfigVal('zendesk:private_ip') + ':' + getConfigVal('zendesk:port') + '/api/v2');
	hostMap.set("Agent Provider", 'https://' + getConfigVal(COMMON_PRIVATE_IP) + ":" + parseInt(getConfigVal(AGENT_SERVICE_PORT)));

	checkConnection(hostMap, function (data) {
		io.to('my room').emit('resource-status', data);
	});

	var metricsStartDate = 1497916801000;
	var metricsEndDate = 1498003200000;
	metrics.createMetrics(mongodb, metricsStartDate, metricsEndDate, function (data) {
		io.to('my room').emit('metrics', data);
	});
}

/**
 * Check resource status
 * @param {type} hosts
 * @param {type} callback
 * @returns {undefined}
 */
function checkConnection(hosts, callback) {
	var results = [];
	var requests = hosts.size;

	hosts.forEach(function (host, name) {
		var parsedurl = url.parse(host, true, true);
		var hostname = parsedurl.hostname;
		var port = parsedurl.port;
		if (port === null)
			port = '80';
		// tests if each address is online
		tcpp.probe(hostname, port, function (err, isAlive) {
			if (err) {
				callback({
					error: "An Error Occurred"
				});
			} else {
				// push results to result arrary
				results.push({
					"name": name,
					"host": host,
					"status": isAlive
				});
				if (results.length === requests) {
					//Sort Request by name
					results.sort(function (a, b) {
						var nameA = a.name.toUpperCase(); // ignore upper and lowercase
						var nameB = b.name.toUpperCase(); // ignore upper and lowercase
						if (nameA < nameB) {
							return -1;
						}
						if (nameA > nameB) {
							return 1;
						}
						return 0;
					});
					// Callback with results of resource status probes
					callback({
						resources: results,
						timestamp: new Date().getTime()
					});
				}
			}
		});
	});
}

/**
 * Instantiate connection to Asterisk
 * @returns {undefined} Not used
 */
function init_ami() {
	if (ami === null) {
		try {
			ami = new AsteriskManager(parseInt(getConfigVal('asterisk:ami:port')),
				getConfigVal(ASTERISK_SIP_PRIVATE_IP),
				getConfigVal('asterisk:ami:id'),
				getConfigVal('asterisk:ami:passwd'), true);

			ami.keepConnected();
			ami.on('managerevent', handle_manager_event);
		} catch (exp) {
			logger.error('Init AMI error ');
		}
	}
}

/**
 * Initialize the AMI connection.
 */
init_ami();

/**
 * Send message to the dashboard
 * @param {type} evt Asterisk Event type
 * @param {type} message Asterisk message
 * @returns {undefined} Not used
 */
function sendEmit(evt, message) {
	try {
		io.sockets.emit(evt, message);
	} catch (exp) {
		logger.error('Socket io emit error ');
	}
}

/**
 * Find the agent information
 * @param {type} agent
 * @returns {unresolved} Not used
 */
function findAgent(agent) { // find agent by name e.g. JSSIP/30001
	for (var i = 0; i < Agents.length; i++) {
		if (Agents[i].agent === agent) {
			return Agents[i];
		}
	}
	return null;
}

/**
 * Find the persisted agent information in MongoDB
 * @param {type} agent
 * @returns {unresolved} Not used
 */
function getAgentFromStats(agent) { // find agent by name e.g. JSSIP/30001
	for (var i = 0; i < AgentStats.length; i++) {
		if (AgentStats[i].agent === agent) {
			return AgentStats[i];
		}
	}
	return null;
}

/**
 * Set all agent status as Logoff.
 * @returns {undefined} Not used
 */
function setAgentsLogOff() {
	for (var i = 0; i < Agents.length; i++) {
		Agents[i].status = "Logged Out";
		Agents[i].queue = "--";
	}
}

/**
 * Find Queue information for a specific queue
 * @param {type} queue
 * @returns {unresolved} Not used
 */
function findQueue(queue) {
	for (var i = 0; i < Queues.length; i++) {
		if (Queues[i].queue === queue)
			return Queues[i];
	}
	return null;
}
/**
 * Find Queue information for a specific queue from queue stats loaded from Mongo
 * @param {type} queue
 * @returns {unresolved} Not used
 */
function findQueueFromStats(queue) {
	for (var i = 0; i < QueueStats.length; i++) {
		if (QueueStats[i].queue === queue)
			return QueueStats[i];
	}
	return null;
}

/**
 * Iniate action to Asterisk
 * @param {type} obj
 * @returns {undefined}
 */
function amiaction(obj) {
	ami.action(obj, function (err) {
		if (err) {
			logger.error('AMI amiaction error ');
		}
	});
}

/**
 * Caculate the total calls taken by an agent
 * @param {type} m Agent CallMap
 * @returns {undefined}
 */
function getTotalCallsTaken(m) {
	var num = 0;
	m.forEach(function (call) {
		num += call;
	});
	logger.debug("getTotalCallsTaken " + num);
	return num;
}

/**
 * increment the agent call for a specific queue after the agent completes a call
 * @param {type} m Agent CallMap
 * @param {type} myqueue Event Queue
 * @returns {undefined}
 */
function incrementCallMap(m, myqueue) {
	m.forEach(function (call, queue) {
		if (queue === myqueue) {
			var increment = call + 1;
			m.set(queue, increment);
			logger.debug("incrementCallMap: queue=" + queue + ", value=" + increment);
		}
	});
}

/**
 * Process Asterisk's events
 * @param {type} evt Asterisk event
 * @returns {undefined} Not used
 */
function handle_manager_event(evt) {

	var a;
	var name;
	var q;

	var ts = new Date();
	var timestamp = { "Timestamp": ts.toISOString() };
	var data = Object.assign(timestamp, evt);

	if (colEvents != null) {
		colEvents.insertOne(data, function (err, result) {
			if (err) {
				logger.debug("handle_manager_event(): insert event into MongoDB, error: " + err);
			}
		});
	}

	switch (evt.event) {
		case 'FullyBooted':
			{
				break;
			}
		case 'Agents': // response event in a series to the agents AMI action containing information about a defined agent.
			{
				a = findAgent(evt.agent); // find agent by extension e.g. JSSIP/60001
				var agentInt = parseInt(evt.agent);
				if (!a) {
					if (AgentMap.has(agentInt)) {
						logger.debug("Agents: New Agent");
						evt.name = AgentMap.get(agentInt).name;
						evt.talktime = 0;
						evt.holdtime = 0;
						evt.callstaken = 0;
						evt.avgtalktime = 0;
						evt.queue = '--';
						evt.status = "Logged Out";

						evt.callMap = new Map();
						for (var i = 0; i < Asterisk_queuenames.length; i++) {
							evt.callMap.set(Asterisk_queuenames[i], 0); // set the total call to 0
						}

						Agents.push(evt);

					} else {
						logger.debug("AMI event Agent not in AgentMap");
					}
				} else {
					let mongoAgent = getAgentFromStats(a.agent);
					if (mongoAgent) {
						if (mongoAgent.talktime > 0 && a.talktime == 0) {
							a.talktime = mongoAgent.talktime;
							a.totaltalktime = (a.talktime / 60).toFixed(2);
						}
						if (mongoAgent.holdtime > 0 && a.holdtime == 0) {
							a.holdtime = mongoAgent.holdtime;
						}
						if (mongoAgent.callstaken > 0 && a.callstaken == 0) {
							a.callstaken = mongoAgent.callstaken;
						}
						if (mongoAgent.avgtalktime > 0 && a.avgtalktime == 0) {
							a.avgtalktime = mongoAgent.avgtalktime;
						}
					}
					logger.debug("Existing agent"); // status always set to AGENT_LOGGEDOFF. Do not use this field

				}
				break;
			}

		case 'AgentComplete': // raised when a queue member has member finished servicing a caller in the queue
			{ // update calls, talktime and holdtime for agent; update longestholdtime and currently active calls for queue
				logger.debug(evt);
				name = evt.membername.split("/");
				a = findAgent(name[1]);

				if (a) {
					logger.debug("AgentComplete: " + "talktime = " + evt.talktime + ", holdtime= " + evt.holdtime);

					if (evt.talktime > 0) {
						a.talktime += Number(evt.talktime);
						a.totaltalktime = (a.talktime / 60).toFixed(2);
					}

					a.holdtime += Number(evt.holdtime);
					// increment the callsComplete - queueMember calls field didn't update.
					incrementCallMap(a.callMap, evt.queue);

					//find the queue associated with this agent complete event
					q = findQueue(evt.queue);
					let tempQ = findQueueFromStats(evt.queue);
					//check if this hold time is longer than the corresponding queue's current longest hold time
					let agentHoldTime = (Number(evt.holdtime) / 60).toFixed(2);
					if (q.longestholdtime < agentHoldTime) {
						//update the longest hold time
						q.longestholdtime = agentHoldTime;
					}
					//decrement the queue's calls in progress
					if (q.currentCalls > 0) {
						q.currentCalls -= 1;
					}
					q.cumulativeHoldTime += Number(evt.holdtime);
					q.cumulativeTalkTime += Number(evt.talktime);
					// do not send agent-resp till ends of QueueStatusComplete
				} else {
					logger.debug("AgentComplete: cannot find agent " + evt.membername);
				}
				break;
			}
		case 'AgentConnect':
			{
				//increment the number of current calls for the queue with call in progress
				q = findQueue(evt.queue);
				q.currentCalls += 1;

				break;
			}
		case 'QueueMember':
			{ // update status and averageTalkTime
				logger.debug(evt);
				if (evt.name == null) {
					logger.error("handle_manager_event(evt) QueueMember ERROR - evt.name is null or undefined");
					break;
				}
				name = evt.name.split("/");
				a = findAgent(name[1]); // use full name e.g. PSSIP/30001 which is the extension
				if (a) {
					logger.debug("QueueMember(): found existing Agent");

					if (((evt.status === "5") || (evt.status === "1")) && evt.paused === "1") // DEVICE_UNAVAILABLE
						a.status = "Away";
					else if (((evt.status === "1") || (evt.status === "5")) && evt.paused === "0") // In a call
						a.status = "Ready";
					else if (evt.status === "2") // In a call
						a.status = "In Call";
					else {
						a.queue = "--";
					}
					if (a.queue === "--")
						a.queue = evt.queue;
					else if (a.queue.indexOf(evt.queue) == -1)
						a.queue += ", " + evt.queue;

					// QueueMember event doesn't update "calls" - get it from AgentComplete
					let mongoAgent = getAgentFromStats(a.agent);
					a.callstaken = (mongoAgent && mongoAgent.callstaken > 0) ? (getTotalCallsTaken(a.callMap) + mongoAgent.callstaken) : getTotalCallsTaken(a.callMap);

					if (a.callstaken > 0) {
						a.avgtalktime = ((a.talktime / a.callstaken) / 60).toFixed(2);
					}
				}
				// wait until we processed all members
				break;
			}
		case 'QueueParams':
			{
				// console.log("In queue params")
				logger.debug(evt);

				q = findQueue(evt.queue);
				if (!q) {
					q = { queue: "", loggedin: 0, available: 0, callers: 0, currentCalls: 0, cumulativeHoldTime: 0, cumulativeTalkTime: 0, avgHoldTime: 0, avgTalkTime: 0, longestholdtime: 0, completed: 0, abandoned: 0, totalCalls: 0 };
					Queues.push(q);
				}
				q.queue = evt.queue;    // ybao: avoid creating multiple queue elements for the same queue
				q.abandoned = Number(evt.abandoned); // evt.abandoned = number of calls that have been abandoned for this queue
				//check for stats in the database
				//get this queue from the stored stats
				let tempQ = findQueueFromStats(q.queue);
				//use the call stats from Mongo
				if (tempQ) {
					q.completed = Number(evt.completed) + tempQ.completed;
					q.abandoned = Number(evt.abandoned) + tempQ.abandoned;
					q.totalCalls = q.completed + q.abandoned;
				} else {
					q.completed = Number(evt.completed);
					q.abandoned = Number(evt.abandoned);
					q.totalCalls = q.completed + q.abandoned;
				}
				break;
			}
		case 'QueueSummary':
			{
				logger.debug(evt);
				for (var j = 0; j < Asterisk_queuenames.length; j++) {
					logger.debug("QueueSummary :" + evt.queue);
					if (evt.queue === Asterisk_queuenames[j]) {
						q = findQueue(evt.queue);
						if (!q) {
							q = { queue: "", loggedin: 0, available: 0, callers: 0, currentCalls: 0, cumulativeHoldTime: 0, cumulativeTalkTime: 0, avgHoldTime: 0, avgTalkTime: 0, longestholdtime: 0, completed: 0, abandoned: 0, totalCalls: 0 };
							Queues.push(q);
						}
						q.queue = evt.queue; //evt.queue = name of the queue ("eg. ComplaintsQueue")
						q.loggedin = Number(evt.loggedin); //evt.loggedin = number of agents currently logged in
						q.available = Number(evt.available); //evt.available = number of agents available
						q.callers = Number(evt.callers); //evt.callers = number of calls currently waiting in the queue to be answered

						let tempQ = findQueueFromStats(evt.queue);
						/**
						 * If the following fields are zero, we can assume that this is the first
						 * time the server has started, so we set each field to it respective value from
						 * Mongo
						 */
						if (tempQ) {
							if (q.cumulativeHoldTime == 0 && tempQ.cumulativeHoldTime > 0) {
								q.cumulativeHoldTime = tempQ.cumulativeHoldTime;
							}
							if (q.cumulativeTalkTime == 0 && tempQ.cumulativeTalkTime > 0) {
								q.cumulativeTalkTime = tempQ.cumulativeTalkTime;
							}
							if (q.longestholdtime == 0 && tempQ.longestholdtime > 0) {
								q.longestholdtime = tempQ.longestholdtime;
							}
							if (q.completed == 0 && tempQ.completed > 0) {
								q.completed = tempQ.completed;
							}
							if (q.abandoned == 0 && tempQ.abandoned > 0) {
								q.abandoned = tempQ.abandoned;
							}
						}
						if (q.completed > 0) {
							q.avgHoldTime = Number((q.cumulativeHoldTime / q.completed) / 60).toFixed(2);
							q.avgTalkTime = Number((q.cumulativeTalkTime / q.completed) / 60).toFixed(2);
						}
						logger.debug("QueueSummary(): q.talktime: " + q.talktime);
					}
				}
				break;
			}
		case 'QueueStatusComplete': // ready to send to the portal
			{
				logger.debug("QueueStatusComplete received");
				sendEmit('queue-resp', {
					'queues': Queues
				});
				sendEmit('agent-resp', {
					'agents': Agents
				});
				break;
			}
		case 'QueueMemberRemoved':
			{
				// set all Agent status to logoff, but do not send a emit, wait for amiaction. Continue to issue an amiaction
				setAgentsLogOff();
				amiaction({
					'action': 'QueueStatus'
				});
				break;
			}
		case 'AgentLogin':
		case 'AgentLogoff':
		case 'QueueMemberAdded':
			{
				amiaction({
					'action': 'QueueStatus'
				});
				break;
			}
		case 'QueueStatus':
		case 'Cdr':
		case 'Queues':
		case 'AgentsComplete':
		case 'QueueSummaryComplete':
			break;
		default:
			break;
	}
}

/**
 * Server-db initialziation
 * @returns {undefined} Not used
 */
function initialize() {
	mapAgents();
	callAmiActions();
	resetAllCounters();

	setInterval(function () {
		callAmiActions();
		mapAgents();
	}, pollInterval);

	if (logStats && logStatsFreq > 0) {
		setInterval(function () {
			backupStatsinDB();
		}, logStatsFreq);
	}
}

/**
 * Initiate amiAction
 * @returns {undefined} Not used
 */
function callAmiActions() {
	amiaction({
		'action': 'Agents'
	});
	amiaction({
		'action': 'QueueSummary'
	});
	for (var i = 0; i < Queues.length; i++) {
		amiaction({
			'action': 'QueueStatus',
			'Queue': Queues[i].queue
		});
	}
}

/**
 * Save agent name and extension in the agentMap
 * @returns {undefined} Not used
 */
function mapAgents() {
	getAgentsFromProvider(function (data) {
		for (var i in data.data) {
			if (data.data[i].extension) {
				var ext = data.data[i].extension;
				var queues = "--";
				if (data.data[i].queue_name !== null) {
					queues = data.data[i].queue_name;
					if (data.data[i].queue2_name !== null) {
						queues += ", " + data.data[i].queue2_name;
					}
				}
				var usr = {
					"name": data.data[i].first_name + " " + data.data[i].last_name,
					"queues": queues
				};
				AgentMap.set(ext, usr);
				// console.log(JSON.stringify(AgentMap,undefined,2))
			}
		}
	});
}

/**
 * Retrieve agent information from the Provider
 * @param {type} callback
 * @returns {undefined} Not used
 */
function getAgentsFromProvider(callback) {
	var url = 'https://' + getConfigVal(COMMON_PRIVATE_IP) + ":" + parseInt(getConfigVal(AGENT_SERVICE_PORT)) + "/getallagentrecs";
	request({
		url: url,
		json: true
	}, function (err, res, data) {
		if (err) {
			logger.error("getAgentsFromProvider ERROR  ");
			data = {
				"message": "failed"
			};
		} else {
			callback(data);
		}
	});
}

/**
 * Reset Asterisk stat counters
 * @returns {undefined} Not used
 */
function resetAllCounters() {
	for (var i = 0; i < Asterisk_queuenames.length; i++) {
		logger.info('QueueReset: ' + Asterisk_queuenames[i]);
		amiaction({
			'action': 'QueueReset',
			'Queue': Asterisk_queuenames[i]
		});
		logger.log(Asterisk_queuenames[i]);
	}
}

/**
 * Backup the Agents and Queues stats into mongoDB - this should be invoked periodically
 * @returns {undefined} Not used
 */
function backupStatsinDB() {
	var ts = new Date();

	/* backup Agents and Queues stats field: using the same JSON elements as in original object
 	 *
 	 * Timestamp:
	 * agentstats[]:
	 * 	agent: "30001",		// by asterisk extension
	 * 	talktime: 0,
	 * 	avgtalktime: 0,
	 * 	callstaken: 0
	 * queuestats[]:
	 * 	queue: "GeneralQuestionsQueue",
	 * 	holdtime: "0.00"
	 * 	talktime: "0.00"
	 * 	longestholdtime: "0.00"
	 * 	completed: 0
	 * 	abandoned: 0
	 * 	calls: 0
	 */

	var data = {};
	data.Timestamp = ts.toISOString();

	// adding Agents[] stats
	data.agentstats = [];
	Agents.forEach(function (element) {
		var astats = {};
		astats.agent = element.agent;
		astats.talktime = element.talktime;
		astats.holdtime = element.holdtime;
		astats.avgtalktime = element.avgtalktime;
		astats.callstaken = element.callstaken;
		data.agentstats.push(astats);
	});

	// adding Queues stats
	data.queuestats = [];
	Queues.forEach(function (element) {
		var qstats = {};
		qstats.queue = element.queue;
		qstats.cumulativeHoldTime = element.cumulativeHoldTime;
		qstats.cumulativeTalkTime = element.cumulativeTalkTime;
		qstats.longestholdtime = element.longestholdtime;
		qstats.completed = element.completed;
		qstats.abandoned = element.abandoned;
		qstats.totalCalls = element.totalCalls;
		data.queuestats.push(qstats);
	});


	if (colStats != null) {
		colStats.insertOne(data, function (err, result) {
			if (err) {
				console.log("backupStatsinDB(): insert callstats into MongoDB, error: " + err);
				logger.debug("backupStatsinDB(): insert callstats into MongoDB, error: " + err);
				throw err;
			}
		});
	}
}

/**
 * Load persisted  Agents and Queues stats from mongoDB - this should be invoked when managementportal restarts
 *
 * Curent design assumes that this is invoked after Agents[] and Queues[] are fully populated - may need to verify
 * whether this is always true
 *
 * @returns {undefined} Not used
 */
function loadStatsinDB() {
	// Find the last stats entry backed up in mongoDB
	if (colStats != null) {
		var cursor = colStats.find().limit(1).sort({ $natural: -1 });

		cursor.toArray(function (err, data) {
			if (err) console.log("Stats find returned error: " + err);

			if (data[0] != null) {
				// for now only saving this, cannot copy them into Agents[] and Queues[] since they may be empty
				AgentStats = data[0].agentstats;
				QueueStats = data[0].queuestats;
			}
		});
	}

	console.log("---------------------------- Stats pulled out of mongoDB: ");
}

app.use(function (err, req, res, next) {
	if (err.code !== 'EBADCSRFTOKEN') return next(err);
	// handle CSRF token errors here
	res.status(200).json({
		"message": "Form has been tampered"
	});
});

/**
 * Handles all GET request to server
 * determines if user can procede or
 * before openam cookie shield is enforced
 */
app.use(function (req, res, next) {
	if (req.path === nginxPath || req.path === '/agentassist') {
		return next();
	} else if (req.path === '/logout') {
		return next();
	} else if (req.session !== null && req.session.data) {
		if (req.session.data !== null && req.session.data.uid) {
			if (req.session.role)
				return next(); //user is logged in go to next()

			var username = req.session.data.uid;
			getUserInfo(username, function (user) {
				if (user.message === "success") {
					req.session.agent_id = user.data[0].agent_id;
					req.session.role = user.data[0].role;
					return next();
				} else {
					res.redirect('./');
				}
			});
		}
	} else {
		res.redirect('.' + nginxPath);
	}
});

/**
 * Get Call for Agent Assistance
 * @param {type} param1 Extension
 * @param {type} param2 Response
 */
app.use('/agentassist', function (req, res) {
	logger.info("Agent Assistance");
	if (req.query.extension) {
		sendEmit("agent-request", req.query.extension);
		res.send({
			'message': 'Success'
		});
	} else {
		res.send({
			'message': 'Error'
		});
	}
});

//must come after above function
//All get requests below are subjected to openam cookieShield

app.use(function (req, res, next) {
	res.locals = {
		"nginxPath": nginxPath
	};
	next();
});

app.use('/', require('./routes'));

/**
 * Calls the RESTful service running on the provider host to verify the agent
 * username and password.
 *
 * @param {type} username Agent username
 * @param {type} password Agent password
 * @param {type} callback Returns retrieved JSON
 * @returns {undefined} Not used
 */
function getUserInfo(username, callback) {
	var url = 'https://' + getConfigVal(COMMON_PRIVATE_IP) + ":" + parseInt(getConfigVal(AGENT_SERVICE_PORT)) + '/getagentrec/' + username;
	request({
		url: url,
		json: true
	}, function (error, response, data) {
		if (error) {
			logger.error("login ERROR: " + error);
			data = {
				"message": "failed"
			};
		} else {
			logger.info("Agent Verify: " + data.message);
		}
		callback(data);
	});
}

/**
 * Reset Asterisk stat counters
 * @param {type} param1 Not used
 * @param {function} 'agent.shield(cookieShield)'
 * @param {type} param2 Not used
 */
app.get('/resetAllCounters', agent.shield(cookieShield), function () {
	logger.info("GET Call to reset counters");
	resetAllCounters();
	mapAgents();
});

/**
 * Handles a GET request for /getVideoamil to retrieve the videomail file
 * @param {string} '/getVideomail'
 * @param {function} function(req, res)
 */
app.get('/getVideomail', function (req, res) {
	console.log("/getVideomail");
	var videoId = req.query.id;
	var agent = req.query.agent;
	console.log("id: " + videoId);

	//Wrap in mysql query
	dbConnection.query('SELECT video_filepath AS filepath, video_filename AS filename FROM videomail WHERE id = ?', videoId, function (err, result) {
		if (err) {
			console.log('GET VIDEOMAIL ERROR: ', err.code);
		} else {
			try {
				var videoFile = result[0].filepath + result[0].filename;
				var stat = fs.statSync(videoFile);
				res.writeHead(200, {
					'Content-Type': 'video/webm',
					'Content-Length': stat.size
				});
				var readStream = fs.createReadStream(videoFile);
				readStream.pipe(res);
			} catch (err) {
				console.log(err);
				io.to(agent).emit('videomail-retrieval-error', videoId);
			}
		}
	});
});


process.on('exit', function () {
	console.log('exit signal received');
        console.log('DESTROYING MySQL DB CONNECTION');
        dbConnection.destroy(); //destroy db connection
        if ( typeof dbconn !== 'undefined' && dbconn ) {
          console.log('DESTROYING MongoDB CONNECTION');
          dbconn.close();
        }
	backupStatsinDB();
        process.exit(0);
});


process.on('SIGINT', function () {
	console.log('SIGINT signal received');
	backupStatsinDB();
});

process.on('SIGTERM', function () {
	console.log('SIGINT signal received');
	backupStatsinDB();
});

process.on('uncaughtException', function () {
	console.log('uncaughtException received');
	backupStatsinDB();
});
