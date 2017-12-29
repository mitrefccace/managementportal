'use strict';

var AsteriskManager = require('asterisk-manager');
var bodyParser = require('body-parser');
var cookieParser = require('cookie-parser'); // the session is stored in a cookie, so we use this to parse it
var csrf = require('csurf');
var decodeBase64 = require('./helpers/utility').decodeBase64;
var express = require('express');
var fs = require('fs');
var https = require('https');
var json2csv = require('json2csv');
var logger = require('./helpers/logger');
var Map = require('collections/map');
var metrics = require('./controllers/metrics');
var MongoClient = require('mongodb').MongoClient;
var nconf = require('nconf');
var openamAgent = require('openam-agent');
const os = require('os'); //get home directory path
var request = require('request');
var session = require('express-session');
var set_rgb_values = require('./helpers/utility').set_rgb_values;
var shell = require('shelljs');
var socketioJwt = require('socketio-jwt');
var tcpp = require('tcp-ping');
var url = require('url');
var mysql = require('mysql');


var port = null; // set the port
var ami = null; // Asterisk AMI 
var Queues = []; // Associative array
var Agents = []; // Associative array
var AgentMap = new Map(); //associate extension to agent database record;
var Asterisk_queuenames = [];

var app = express(); // create our app w/ express

//Required for REST calls to self signed certificate servers 
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

var cfile = 'config.json'; // Config file
nconf.argv().env();
nconf.file({ file: cfile });
console.log('Config file: ' + cfile);
logger.info('Config file: ' + cfile);

var credentials = {
	key: fs.readFileSync(decodeBase64(nconf.get('https:private_key'))),
	cert: fs.readFileSync(decodeBase64(nconf.get('https:certificate')))
};

var agent = new openamAgent.PolicyAgent({
	serverUrl : decodeBase64(nconf.get('openam:serverUrl')) + ":" + decodeBase64(nconf.get('openam:port')) + '/' +  decodeBase64(nconf.get('openam:path')),
	privateIP: decodeBase64(nconf.get('openam:privateIP')),
	errorPage: function () {
		return '<html><body><h1>Access Error</h1></body></html>';
  } 
});
var cookieShield = new openamAgent.CookieShield({ getProfiles: false, cdsso: false, noRedirect: false, passThrough: false });

app.use(cookieParser()); // must use cookieParser before expressSession
app.use(session({
	secret: decodeBase64(nconf.get('session:secretKey')),
	resave: decodeBase64(nconf.get('session:resave')),
	rolling: decodeBase64(nconf.get('session:rolling')),
	saveUninitialized: decodeBase64(nconf.get('session:saveUninitialized')),
	cookie: {
		maxAge: parseFloat(decodeBase64(nconf.get('session:cookie:maxAge'))),
		httpOnly: decodeBase64(nconf.get('session:cookie:httpOnly')),
		secure: decodeBase64(nconf.get('session:cookie:secure'))
	}
}));
// set the view engine to ejs
app.set('view engine', 'ejs');
app.use(express.static(__dirname + '/public'));
app.use(bodyParser.urlencoded({ 'extended': 'true' })); // parse application/x-www-form-urlencoded
app.use(bodyParser.json()); // parse application/json
app.use(bodyParser.json({ type: 'application/vnd.api+json' })); // parse application/vnd.api+json as json
app.use(csrf({ cookie: false }));

nconf.defaults({// if the port is not defined in the cocnfig.json file, default it to 8080
	dashboard: {
		'pollInterval': 10000
	},
	https: {
		'port-dashboard': 8090
	}
});

var fqdn = '';
if (nconf.get('nginx:fqdn')) {
	fqdn = decodeBase64(nconf.get('nginx:fqdn'));
} else {
	fqdn = shell.exec('hostname -f', {
		silent: true
	}).stdout;
}
var fqdnTrimmed = fqdn.trim(); // Remove the newline
var fqdnUrl = 'https://' + fqdnTrimmed + ':*';

port = parseInt(decodeBase64(nconf.get('https:port-dashboard')));

var httpsServer = https.createServer(credentials, app);

var io = require('socket.io')(httpsServer, { cookie: false });
io.set('origins', fqdnUrl);

var dbHost = decodeBase64(nconf.get('virtualagent:mysql:host'));
var dbUser = decodeBase64(nconf.get('virtualagent:mysql:user'));
var dbPassword = decodeBase64(nconf.get('virtualagent:mysql:password'));
var dbName = decodeBase64(nconf.get('virtualagent:mysql:database'));
var dbPort = parseInt(decodeBase64(nconf.get('virtualagent:mysql:port')));
var vmTable = decodeBase64(nconf.get('virtualagent:mysql:table'));

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

// MongoDB Connection URI
var mongodbUriEncoded = nconf.get('mongodb:connectionURI');
var db;
if (typeof mongodbUriEncoded !== 'undefined' && mongodbUriEncoded) {
	var mongodbUri = decodeBase64(mongodbUriEncoded);
	// Initialize connection once
	MongoClient.connect(mongodbUri, function(err, database) {
		if(err) throw err;

		console.log('MongoDB Connection Successful');
		db = database;

		// Start the application after the database connection is ready
		httpsServer.listen(port);
		console.log('https web server listening on ' + port);
	});
}
else {
	console.log('Missing MongoDB Connection URI in config');

	httpsServer.listen(port);
	console.log('https web server listening on ' + port);
}

// Validates the token, if valid go to connection.
// If token is not valid, no connection will be established.
io.use(socketioJwt.authorize({
	secret: new Buffer(decodeBase64(nconf.get('jsonwebtoken:secretkey')), decodeBase64(nconf.get('jsonwebtoken:encoding'))),
	timeout: parseInt(decodeBase64(nconf.get('jsonwebtoken:timeout'))), // seconds to send the authentication message
	handshake: decodeBase64(nconf.get('jsonwebtoken:handshake'))
}));

//light status config requirement: copy dat/color_config.json to ~/dat if not already there
var color_config_file_path = os.homedir() + '/dat';
if (!fs.existsSync(color_config_file_path)) { //make sure dir existsSync
  fs.mkdirSync(color_config_file_path, '0775');
}
if (!fs.existsSync(color_config_file_path + '/color_config.json') || !fs.existsSync(color_config_file_path + '/default_color_config.json') ) {
  // copy it from dat
  logger.info('copying default color config file to ~/dat since it does not exist...');
  fs.createReadStream('dat/color_config.json').pipe(fs.createWriteStream(color_config_file_path + '/color_config.json'));
  fs.createReadStream('dat/default_color_config.json').pipe(fs.createWriteStream(color_config_file_path + '/default_color_config.json'));
}

logger.info('Listen on port: ' + port);
var queuenames = decodeBase64(nconf.get('dashboard:queues'));
var pollInterval = parseInt(decodeBase64(nconf.get('dashboard:pollInterval')));
var adUrl = decodeBase64(nconf.get('acedirect:url'));
console.log("port number: " + port + ", poll interval:" + pollInterval);

Asterisk_queuenames = queuenames.split(",");

logger.info('****** Restarting server-db  ****');
logger.info('Asterisk queuename: ' + Asterisk_queuenames + ", Poll Interval: " + pollInterval);

io.sockets.on('connection', function (socket) {
	var numClients = 0;
	logger.info('io.socket connected, id: ' + socket.id);

	socket.on('config', function (message) {
		logger.debug('Got config message request: ' + message);
		var confobj = {};
		confobj.host = decodeBase64(nconf.get('asterisk:sip:host'));
		confobj.realm = decodeBase64(nconf.get('asterisk:sip:realm'));
		confobj.stun = decodeBase64(nconf.get('asterisk:sip:stun'));
		confobj.wsport = parseInt(decodeBase64(nconf.get('asterisk:sip:wsport')));
		confobj.channel = decodeBase64(nconf.get('asterisk:sip:channel'));
		confobj.websocket = decodeBase64(nconf.get('asterisk:sip:websocket'));

		socket.emit('sipconf', confobj);

		if (message === 'webuser') {
			var qobj = {};
			qobj.queues = decodeBase64(nconf.get('dashboard:queues'));
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
			socket.emit('agent-resp', { 'agents': Agents });
			logger.debug('Sending agent resp');
		} else if (message === 'queue') {
			socket.emit('queue-resp', { 'queues': Queues });
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

	// Socket for CDR table
	socket.on('cdrtable-get-data', function (data) {
		var url = decodeBase64(nconf.get('acr-cdr:url'));
		var format = data.format;
		if (data.start && data.end) {
			url += '?start=' + data.start + '&end=' + data.end;
		}

		// ACR-CDR getallcdrrecs RESTful call to get CDR JSON string.
		request({
			url: url,
			json: true
		}, function (err, res, cdrdata) {
			if (err) {
				io.to(socket.id).emit('cdrtable-error', { "message": "Error Accessing Data Records" });
			} else if (format === 'csv') {
				//csv field values
				var csvFields = ['calldate', 'clid', 'src',
					'dst', 'dcontext', 'channel',
					'dstchannel', 'lastapp', 'lastdata',
					'duration', 'billsec', 'disposition',
					'amaflags', 'accountcode', 'userfield',
					'uniqueid', 'linkedid', 'sequence',
					'peeraccount'];
				// Converts JSON object to a CSV file.
				var csv = json2csv({ 'data': cdrdata.data, 'fields': csvFields });
				//returns CSV of Call Data Records
				io.to(socket.id).emit('cdrtable-csv', csv);
			} else {
				//returns JSON object of CDR
				io.to(socket.id).emit('cdrtable-data', cdrdata);
			}
		});
	});

	socket.on('metrics-get-data', function (data) {
		if (data.start && data.end) {
			// Set start and end internally
			// Eventually store them in redis.
			var metricsStartDate = new Date(data.start);
			var metricsEndDate = new Date(data.end);
			metrics.createMetrics(db, Agents, metricsStartDate.getTime(), metricsEndDate.getTime(), function(metrics) {
				io.to('my room').emit('metrics', metrics);
			});
		}
	});

	// ######################################
	// Videomail-specific socket.io events

	function processFilter(filter){
		if (filter == 'ALL'){
			return('');
		} else{
			return('AND status = ' + filter);
		}
	}

	//Retrieval of videomail records from the database	
	socket.on("get-videomail", function (data) {
		logger.debug('entered get-videomail');
		logger.debug('test');
		var sortBy = data.sortBy;
		var filterFlag = processFilter(data.filter);
		var sortStr = '';
		var queryStr = '';

		if (filterFlag) {
			if (sortBy.includes('asc')) {
				sortStr = sortBy.slice(0, sortBy.length - 4);
				queryStr = "SELECT id, extension, callbacknumber, recording_agent, processing_agent, DATE_FORMAT(convert_tz(received,@@session.time_zone,'-04:00'), '%a %m/%d/%Y %h:%i %p') as received, processed, video_duration, status, deleted, src_channel, dest_channel, unique_id, video_filename, video_filepath FROM " + vmTable + " WHERE deleted = 0 and status = " + filterFlag + " ORDER BY " + sortStr + " asc";
			} else if (sortBy.includes('desc')) {
				sortStr = sortBy.slice(0, sortBy.length - 5);
				queryStr = "SELECT id, extension, callbacknumber, recording_agent, processing_agent, DATE_FORMAT(convert_tz(received,@@session.time_zone,'-04:00'), '%a %m/%d/%Y %h:%i %p') as received, processed, video_duration, status, deleted, src_channel, dest_channel, unique_id, video_filename, video_filepath FROM " + vmTable + " WHERE deleted = 0 and status = " + filterFlag + " ORDER BY " + sortStr + " desc";
			}
		} else {
			if (sortBy.includes('asc')) {
				sortStr = sortBy.slice(0, sortBy.length - 4);
				queryStr = "SELECT id, extension, callbacknumber, recording_agent, processing_agent, DATE_FORMAT(convert_tz(received,@@session.time_zone,'-04:00'), '%a %m/%d/%Y %h:%i %p') as received, processed, video_duration, status, deleted, src_channel, dest_channel, unique_id, video_filename, video_filepath FROM " + vmTable + " WHERE deleted = 0 ORDER BY " + sortStr + " asc";
			} else if (sortBy.includes('desc')) {
				sortStr = sortBy.slice(0, sortBy.length - 5);
				queryStr = "SELECT id, extension, callbacknumber, recording_agent, processing_agent, DATE_FORMAT(convert_tz(received,@@session.time_zone,'-04:00'), '%a %m/%d/%Y %h:%i %p') as received, processed, video_duration, status, deleted, src_channel, dest_channel, unique_id, video_filename, video_filepath FROM " + vmTable + " WHERE deleted = 0 ORDER BY " + sortStr + " desc";
			}
		}
		logger.debug(queryStr);
		dbConnection.query(queryStr, function (err, result) {
			if (err) {
				logger.error("GET-VIDEOMAIL ERROR: ", err.code);
			} else {
				//io.to(Number(data.extension)).emit('got-videomail-recs', result);
				logger.debug(result);
				io.to('my room').emit('got-videomail-recs', result);
			}
		});

		queryStr = "DELETE FROM " + vmTable + " WHERE TIMESTAMPDIFF(DAY, deleted_time, CURRENT_TIMESTAMP) >= 14;";
		dbConnection.query(queryStr, function(err, result) {
			if (err) {
				logger.error('DELETE-OLD-VIDEOMAIL ERROR: ', err.code);
			} else {
				logger.debug('Deleted old videomail');
			}
		});
	});

	//updates videomail records when the agent changes the status
	socket.on("videomail-status-change", function (data) {
		logger.debug('updating MySQL entry');
		var queryStr = "UPDATE " + vmTable + " SET status = '" + data.status + "', processed = CURRENT_TIMESTAMP, processing_agent = manager, deleted = 0, deleted_time = NULL, deleted_by = NULL WHERE id = " + data.id;
		logger.debug(queryStr);
		dbConnection.query(queryStr, function (err, result) {
			if (err) {
				logger.error('VIDEOMAIL-STATUS-CHANGE ERROR: ', err.code);
			} else {
				logger.debug(result);
				//io.to(Number(data.extension)).emit('changed-status', result);
				io.to('my room').emit('changed-status', result);			}
		});
	});

	//changes the videomail status to READ if it was UNREAD before
	socket.on("videomail-read-onclick", function (data) {
		logger.debug('updating MySQL entry');
		var queryStr = "UPDATE " + vmTable + " SET status = 'READ', processed = CURRENT_TIMESTAMP, processing_agent = manager WHERE id = " + data.id;
		logger.debug(queryStr);
		dbConnection.query(queryStr, function (err, result) {
			if (err) {
				logger.error('VIDEOMAIL-READ ERROR: ', err.code);
			} else {
				logger.debug(result);
				//io.to(Number(data.extension)).emit('changed-status', result);
				io.to('my room').emit('changed-status', result);
			}
		});
	});

	//updates videomail records when the agent deletes the videomail. Keeps it in db but with a deleted flag
	socket.on("videomail-deleted", function (data) {
		logger.debug('updating MySQL entry');
		var queryStr = "UPDATE " + vmTable + " SET deleted_time = CURRENT_TIMESTAMP, deleted_by = manager, deleted = 1 WHERE id = " + data.id;
		dbConnection.query(queryStr, function (err, result) {
			if (err) {
				logger.error('VIDEOMAIL-DELETE ERROR: ', err.code);
			} else {
				logger.debug(result);
				//io.to(Number(data.extension)).emit('changed-status', result);
				io.to('my room').emit('changed-status', result);
			}
		});
	});
	
	// Socket for Light Configuration
	//read color_config.json file for light configuration
	socket.on("get_color_config", function(){
		try {
			//send json file to client
			var file_path = os.homedir() + '/dat/color_config.json';
			var data = fs.readFileSync(file_path,'utf8');
			socket.emit("html_setup", data);
		} 
		catch (ex) {
			logger.error('Error: ' + ex);
		} 
	});

	//on light color config submit update current color_config.json file
	socket.on('submit', function(form_data){
		try {
			var file_path = os.homedir() + '/dat/color_config.json';
			var data = fs.readFileSync(file_path,'utf8');
			var json_data = JSON.parse(data);
			for(var status in json_data.statuses)
			{
				var color_and_action = form_data[status].split('_'); //color_and_action[0] = color, color_and_action[1] = "blinking" or "solid"
				json_data.statuses[status].color = color_and_action[0].toLowerCase();
				json_data.statuses[status].stop = (color_and_action[0] == "off") ? true : false;
				json_data.statuses[status].blink = (color_and_action[1] == "blinking") ? true : false;
				json_data = set_rgb_values(json_data, status, color_and_action[0]);
			}
			fs.writeFile(file_path, JSON.stringify(json_data, null, 2) , 'utf-8'); 

			//send to server
			request({
				url: adUrl + '/updatelightconfigs'
			}, function (err) {
				if (err) {
					logger.error('Error: ' + err);
				}
			});
		} 
		catch (ex) {
			logger.error('Error: ' + ex);
		} 
	});

	//sends the default_color_config.json data back to the management portal
	socket.on('reset-color-config', function(){
		try {
			var default_color_config = os.homedir() + '/dat/default_color_config.json';
			var data = fs.readFileSync(default_color_config,'utf8');
			socket.emit("update-colors",data);
		} 
		catch (ex) {
			logger.error('Error: ' + ex);
			console.log('Error: ' + ex);
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
	hostMap.set("Asterisk", decodeBase64(nconf.get('asterisk:sip:websocket')));	
	hostMap.set("ACR-CDR", decodeBase64(nconf.get('acr-cdr:url')));
	hostMap.set("VRS Lookup", decodeBase64(nconf.get('vrscheck:url')));
	hostMap.set("ACE Direct", decodeBase64(nconf.get('acedirect:url')));
	hostMap.set("Zendesk", decodeBase64(nconf.get('zendesk:url')));
	hostMap.set("Agent Provider", decodeBase64(nconf.get('agentservice:url')) + ":" + parseInt(decodeBase64(nconf.get('agentservice:port'))));

	checkConnection(hostMap, function (data) {
		io.to('my room').emit('resource-status', data);
	});

	var metricsStartDate = 1497916801000;
	var metricsEndDate = 1498003200000;
	metrics.createMetrics(db, Agents, metricsStartDate, metricsEndDate, function(data) {
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
	var requests = hosts.length;

	hosts.forEach(function (host, name) {
		var parsedurl = url.parse(host, true, true);
		var hostname = parsedurl.hostname;
		var port = parsedurl.port;
		if (port === null)
			port = '80';
		// tests if each address is online
		tcpp.probe(hostname, port, function (err, isAlive) {
			if (err) {
				callback({ error: "An Error Occurred" });
			} else {
				// push results to result arrary
				results.push({ "name": name, "host": host, "status": isAlive });
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
					callback({ resources: results, timestamp: new Date().getTime() });
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
			ami = new AsteriskManager(parseInt(decodeBase64(nconf.get('asterisk:ami:port'))),
				decodeBase64(nconf.get('asterisk:sip:host')),
				decodeBase64(nconf.get('asterisk:ami:id')),
				decodeBase64(nconf.get('asterisk:ami:passwd')), true);

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
			//logger.debug("findAgent(): found Agent " + agent);
			return Agents[i];
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
 * @param {type} m
 * @returns {undefined}
 */
function getTotalCallsTaken(m) {
	var num = 0;
	//printCallMap(m);
	m.forEach(function (call) {
		num += call;
	});
	logger.debug("getTotalCallsTaken " + num);
	return num;
}

/**
 * increment the agent call for a specific queue after the agent completes a call
 * @param {type} m
 * @param {type} myqueue
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
	//logger.debug (evt);

	var a;
	var name;
	var q;

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
						evt.avgtalktime = 0;
						evt.callstaken = 0;
						evt.queue = '--';
						evt.status = "Logged Out";
						evt.callMap = new Map();
						for (var i = 0; i < Asterisk_queuenames.length; i++) {
							evt.callMap.set(Asterisk_queuenames[i], 0); // set the total call to 0
						}
						//evt.callsabandoned = 0; -- this information is not available for agent
						Agents.push(evt);

					} else {
						logger.debug("AMI event Agent not in AgentMap");
					}
				} else {
					logger.debug("Existing agent");  // status always set to AGENT_LOGGEDOFF. Do not use this field

				}
				break;
			}

		case 'AgentComplete': // raised when a queue member has member finished servicing a caller in the queue
			{ // update calls, talktime and holdtime
				logger.debug(evt);
				name = evt.membername.split("/");
				a = findAgent(name[1]);

				if (a) {
					logger.debug("AgentComplete: " + "talktime = " + evt.talktime + ", holdtime= " + evt.holdtime);

					if (evt.talktime > 0) {
						a.talktime = Number(Number(a.talktime) + Number(evt.talktime) / 60).toFixed(2);
					}

					a.holdtime += Number((Number(evt.holdtime ? evt.holdtime : "0") / 60).toFixed(2));
					// increment the callsComplete - queueMember calls field didn't update.
					incrementCallMap(a.callMap, evt.queue);
					// do not send agent-resp till ends of QueueStatusComplete
				} else
					logger.debug("AgentComplete: cannot find agent " + evt.membername);
				break;
			}
		case 'QueueMember':
			{ // update status and averageTalkTime
				logger.debug(evt);
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
						a.status = "Logged Out";
						a.queue = "--";
					}
					if (a.queue === "--")
						a.queue = evt.queue;
					else if (a.queue.indexOf(evt.queue) == -1)
						a.queue += ", " + evt.queue;

					// QueueMember event doesn't update "calls" - get it from AgentComplete
					a.callstaken = getTotalCallsTaken(a.callMap);

					if (a.callstaken > 0) {
						a.avgtalktime = (a.talktime / a.callstaken).toFixed(2);
					}
				}
				// wait until we processed all members
				break;
			}
		case 'QueueParams':
			{
				logger.debug(evt);
				q = findQueue(evt.queue);
				if (!q) {
					q = {};
					Queues.push(q);
				}
				q.completed = Number(evt.completed); // params
				q.abandoned = Number(evt.abandoned); // params
				q.calls = Number(evt.calls); // params
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
							q = {};
							Queues.push(q);
						}
						q.queue = evt.queue;
						q.loggedin = evt.loggedin;
						q.available = evt.available;
						q.callers = Number(evt.callers);

						q.holdtime = Number((evt.holdtime) / 60).toFixed(2);
						q.talktime = Number(evt.talktime / 60).toFixed(2);
						logger.debug("QueueSummary(): q.talktime: " + q.talktime);
						q.longestholdtime = Number(evt.longestholdtime / 60).toFixed(2);
					}
				}
				break;
			}
		case 'QueueStatusComplete': // ready to send to the portal
			{
				logger.debug("QueueStatusComplete received");
				sendEmit('queue-resp', { 'queues': Queues });
				sendEmit('agent-resp', { 'agents': Agents });
				break;
			}
		case 'QueueMemberRemoved':
			{
				// set all Agent status to logoff, but do not send a emit, wait for amiaction. Continue to issue an amiaction
				setAgentsLogOff();
				amiaction({ 'action': 'QueueStatus' });
				break;
			}
		case 'AgentLogin':
		case 'AgentLogoff':
		case 'QueueMemberAdded':
			{
				amiaction({ 'action': 'QueueStatus' });
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
}

/**
 * Initiate amiAction
 * @returns {undefined} Not used
 */
function callAmiActions() {
	amiaction({ 'action': 'Agents' });
	amiaction({ 'action': 'QueueSummary' });
	for (var i = 0; i < Queues.length; i++) {
		amiaction({ 'action': 'QueueStatus', 'Queue': Queues[i].queue });
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
				var usr = { "name": data.data[i].first_name + " " + data.data[i].last_name, "queues": queues };
				//if (AgentMap.has(ext))
				//	AgentMap.delete(ext);
				AgentMap.set(ext, usr);
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
	var url = decodeBase64(nconf.get('agentservice:url')) + ":" + parseInt(decodeBase64(nconf.get('agentservice:port'))) + "/getallagentrecs";
	request({
		url: url,
		json: true
	}, function (err, res, data) {
		if (err) {
			logger.error("getAgentsFromProvider ERROR  ");
			data = { "message": "failed" };
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
		amiaction({ 'action': 'QueueReset' }, { 'Queue': Asterisk_queuenames[i] });
		logger.log(Asterisk_queuenames[i]);
	}
}

app.use(function (err, req, res, next) {
	if (err.code !== 'EBADCSRFTOKEN') return next(err);
	// handle CSRF token errors here
	res.status(200).json({ "message": "Form has been tampered" });
});

/**
 * Handles all GET request to server
 * determines if user can procede or   
 * before openam cookie shield is enforced
 */
app.use(function (req, res, next) {
	if (req.path === '/ManagementPortal'|| req.path === '/agentassist') {
		return next();
	} else if (req.path === '/logout') {
		return next();
	} else if (req.session.data) {		
	 	if (req.session.data.uid) {
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
		res.redirect('./ManagementPortal');
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
		res.send({ 'message': 'Success' });
	} else {
		res.send({ 'message': 'Error' });
	}
});

//must come after above function
//All get requests below are subjected to openam cookieShield
//app.use(agent.shield(cookieShield));

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
// function login(username, password, callback) {
// 	var url = decodeBase64(nconf.get('agentservice:url')) + ":" + parseInt(decodeBase64(nconf.get('agentservice:port'))) + "/agentverify/";
// 	var params = "?username=" + escape(username) + "&password=" + escape(password);
// 	request({
// 		url: url + params,
// 		json: true
// 	}, function (error, response, data) {
// 		if (error) {
// 			logger.error("login ERROR");
// 			data = { "message": "failed" };
// 		} else {
// 			logger.info("Agent Verify: " + data.message);
// 		}
// 		callback(data);
// 	});
// }

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
	var url = decodeBase64(nconf.get('agentservice:url')) + ":" + parseInt(decodeBase64(nconf.get('agentservice:port'))) + '/getagentrec/' + username;
	request({
		url: url,
		json: true
	}, function (error, response, data) {
		if (error) {
			logger.error("login ERROR: " + error);
			data = { "message": "failed" };
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
