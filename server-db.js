var express = require('express');
var fs = require('fs');
var nconf = require('nconf');
var jwt = require('jsonwebtoken');
var bodyParser = require('body-parser');
var socketioJwt = require('socketio-jwt');
var request = require('request');
var json2csv = require('json2csv');
var log4js = require('log4js');  //https://www.npmjs.com/package/log4js
var tcpp = require('tcp-ping');
var Map = require('collections/map');
var url = require('url');
var AsteriskManager = require('asterisk-manager');
var cookieParser = require('cookie-parser'); // the session is stored in a cookie, so we use this to parse it
var session = require('express-session');
var https = require('https');
var shell = require('shelljs');
var csrf = require('csurf')

var port = null; // set the port
var cfile = null; // Config file
var ami = null; // Asterisk AMI 
var Queues = []; // Associative array
var QueuesArray = []; // Asterisk queues information held here
var Agents = []; // Associative array
var AgentMap = new Map(); //associate extension to agent database record;
var Asterisk_queuenames = [];
var app = express(); // create our app w/ express

cfile = 'config.json';
nconf.argv().env();
nconf.file({file: cfile});

var credentials = {
	key: fs.readFileSync(decodeBase64(nconf.get('https:private_key'))),
	cert: fs.readFileSync(decodeBase64(nconf.get('https:certificate')))
};


app.use(cookieParser()); // must use cookieParser before expressSession
app.use(session({
	secret: decodeBase64(nconf.get('session:secretKey')),
	resave: decodeBase64(nconf.get('session:resave')),
	rolling : decodeBase64(nconf.get('session:rolling')),
	saveUninitialized: decodeBase64(nconf.get('session:saveUninitialized')),
	cookie: {
		maxAge: parseFloat(decodeBase64(nconf.get('session:maxAge'))),
		httpOnly : decodeBase64(nconf.get('session:httpOnly')),
		secure : decodeBase64(nconf.get('session:secure'))
	}
}));
// set the view engine to ejs
app.set('view engine', 'ejs');
app.use(express.static(__dirname + '/public'));
app.use(bodyParser.urlencoded({'extended': 'true'})); // parse application/x-www-form-urlencoded
app.use(bodyParser.json()); // parse application/json
app.use(bodyParser.json({type: 'application/vnd.api+json'})); // parse application/vnd.api+json as json
app.use(csrf({ cookie: false }));

log4js.loadAppender('file');
var logname = 'server-db';
log4js.configure({
	appenders: [
		{
			type: 'dateFile',
			filename: 'logs/' + logname + '.log',
			pattern: '-yyyy-MM-dd',
			alwaysIncludePattern: false,
			maxLogSize: 20480,
			backups: 10
		}
	]
});

var debugLevel = decodeBase64(nconf.get('debuglevel'));

var logger = log4js.getLogger(logname);
logger.setLevel(debugLevel); //log level hierarchy: ALL TRACE DEBUG INFO WARN ERROR FATAL OFF


nconf.defaults({// if the port is not defined in the cocnfig.json file, default it to 8080
	dashboard: {
		'pollInterval': 10000
	},
	https: {
		'port-dashboard': 8090
	}
});

console.log('Config file: ' + cfile);
logger.info('Config file: ' + cfile);

var fqdn = shell.exec('hostname -f', {silent:true}).stdout; //Shell command for hostname
var fqdnTrimmed = fqdn.trim(); // Remove the newline
var fqdnUrl = 'https://' + fqdnTrimmed + ':*';

port = parseInt(decodeBase64(nconf.get('https:port-dashboard')));

//Required for REST calls to self signed certificate servers 
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

var httpsServer = https.createServer(credentials, app);

var io = require('socket.io')(httpsServer, {cookie: false});
io.set('origins', fqdnUrl);
httpsServer.listen(port);
console.log("https web server listening on " + port);

// Validates the token, if valid go to connection.
// If token is not valid, no connection will be established.
io.use(socketioJwt.authorize({
	secret: new Buffer(decodeBase64(nconf.get('jsonwebtoken:secretkey')), decodeBase64(nconf.get('jsonwebtoken:encoding'))),
	timeout: parseInt(decodeBase64(nconf.get('jsonwebtoken:timeout'))), // seconds to send the authentication message
	handshake: decodeBase64(nconf.get('jsonwebtoken:handshake'))
}));


logger.info('Listen on port: ' + port);
var queuenames = decodeBase64(nconf.get('dashboard:queuesACL'));
if (decodeBase64(nconf.get('environment')) === "AD") {
	queuenames = decodeBase64(nconf.get('dashboard:queuesAD'));
}
var pollInterval = parseInt(decodeBase64(nconf.get('dashboard:pollInterval')));

if (decodeBase64(nconf.get('environment')) === "ACL") {
	asterisk_host = decodeBase64(nconf.get('asterisk:sip:host'));
} else {
	asterisk_host = decodeBase64(nconf.get('asteriskAD:sip:host'));
}

console.log("port number: " + port + ", poll interval:" + pollInterval);

Asterisk_queuenames = queuenames.split(",");

logger.info('****** Restarting server-db  ****');
logger.info('Asterisk queuename: ' + Asterisk_queuenames + ", Poll Interval: " + pollInterval);


io.sockets.on('connection', function (socket) {
	var token = socket.decoded_token;
	socket.emit('environment', decodeBase64(nconf.get('environment')));
	var numClients = 0;

	logger.info('io.socket connected, id: ' + socket.id);

	socket.on('config', function (message) {
		logger.debug('Got config message request: ' + message);
		var confobj = new Object();
		confobj.host = decodeBase64(nconf.get('asteriskAD:sip:host'));
		confobj.realm = decodeBase64(nconf.get('asteriskAD:sip:realm'));
		confobj.stun = decodeBase64(nconf.get('asteriskAD:sip:stun'));
		confobj.wsport = parseInt(decodeBase64(nconf.get('asteriskAD:sip:wsport')));
		confobj.channel = decodeBase64(nconf.get('asteriskAD:sip:channel'));
		confobj.websocket = decodeBase64(nconf.get('asteriskAD:sip:websocket'));

		if (decodeBase64(nconf.get('environment')) === "ACL") {
			confobj.host = decodeBase64(nconf.get('asterisk:sip:host'));
			confobj.realm = decodeBase64(nconf.get('asterisk:sip:realm'));
			confobj.stun = decodeBase64(nconf.get('asterisk:sip:stun'));
			confobj.wsport = parseInt(decodeBase64(nconf.get('asterisk:sip:wsport')));
			confobj.channel = decodeBase64(nconf.get('asterisk:sip:channel'));
			confobj.websocket = decodeBase64(nconf.get('asterisk:sip:websocket'));
		}

		socket.emit('sipconf', confobj);

		if (message === 'webuser') {
			var qobj = new Object();
			qobj.queues =  decodeBase64(nconf.get('dashboard:queuesAD'));
			if (decodeBase64(nconf.get('environment')) === "ACL") {
				qobj.queues =  decodeBase64(nconf.get('dashboard:queuesACL'));
			}
			socket.emit('queueconf', qobj);
			logger.debug('Message is webuser type');
		}
	});


	// Handle incoming Socket.IO registration requests - add to the room
	socket.on('register-manager', function (data) {
		logger.info("Adding client socket to room: 'my room'");
		// Add this socket to my room
		socket.join('my room');
		sendResourceStatus();
	});

	//Manually get resource status
	socket.on('resource-status-update', function (data) {
		sendResourceStatus();
	});

	socket.on('ami-req', function (message) {
		logger.debug('Received AMI request: ' + message);

		if (message === 'agent') {
			socket.emit('agent-resp', {'agents': Agents});

			logger.debug('Sending agent resp');
		} else if (message === 'queue') {
			socket.emit('queue-resp', {'queues': Queues});

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

	//Socket for CDR table
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
				io.to(socket.id).emit('cdrtable-error', {"message": "Error Accessing Data Records"});
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
				var csv = json2csv({'data': cdrdata.data, 'fields': csvFields});
				//returns CSV of Call Data Records
				io.to(socket.id).emit('cdrtable-csv', csv);
			} else {
				//returns JSON object of CDR
				io.to(socket.id).emit('cdrtable-data', cdrdata);
			}
		});
	});

});

//calls sendResourceStatus every minute
setInterval(sendResourceStatus, 60000)
setImmediate(initialize);

/**
 * Send Resoure status to Management Dashboard
 * @returns {undefined}
 */
function sendResourceStatus() {
	var hostMap = new Map();
	// list of resources to check for status 
	hostMap.set("Asterisk", decodeBase64(nconf.get('asteriskAD:sip:websocket')));
	hostMap.set("ACR-CDR", decodeBase64(nconf.get('acr-cdr:url')));
	hostMap.set("VRS Lookup", decodeBase64(nconf.get('vrscheck:url')));
	if (decodeBase64(nconf.get('environment')) === "ACL")
		hostMap.set("ACE Connect Lite", decodeBase64(nconf.get('aceconnectlite:url')));
	if (decodeBase64(nconf.get('environment')) === "AD")
		hostMap.set("ACE Direct", decodeBase64(nconf.get('acedirect:url')));
	hostMap.set("ZenDesk", decodeBase64(nconf.get('zendesk:url')));
	hostMap.set("Agent Provider", decodeBase64(nconf.get('agentservice:url')) + ":" + parseInt(decodeBase64(nconf.get('agentservice:port'))));

	checkConnection(hostMap, function (data) {
		io.to('my room').emit('resource-status', data);
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
				callback({error: "An Error Occurred"});
			} else {
				// push results to result arrary
				results.push({"name": name, "host": host, "status": isAlive});
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
					callback({resources: results, timestamp: new Date().getTime()});
				}
			}
		});
	})
}

/**
 * Instantiate connection to Asterisk
 * @returns {undefined} Not used
 */
function init_ami() {

	if (ami === null) {
		try {
			if (decodeBase64(nconf.get('environment')) === "ACL") {
				ami = new AsteriskManager(parseInt(decodeBase64(nconf.get('asterisk:ami:port'))),
					decodeBase64(nconf.get('asterisk:sip:host')),
					decodeBase64(nconf.get('asterisk:ami:id')),
					decodeBase64(nconf.get('asterisk:ami:passwd')), true);
			} else {
				ami = new AsteriskManager(parseInt(decodeBase64(nconf.get('asteriskAD:ami:port'))),
					decodeBase64(nconf.get('asteriskAD:sip:host')),
					decodeBase64(nconf.get('asteriskAD:ami:id')),
					decodeBase64(nconf.get('asteriskAD:ami:passwd')), true);
			}
			ami.keepConnected();
			ami.on('managerevent', handle_manager_event);
		} catch (exp) {
			logger.error('Init AMI error ');
		}
	}
}

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
 * Find the agent name given the agent information
 * @param {type} agent
 * @returns {unresolved} Not used
 */
function findAgentName(agent) {
	for (var i = 0; i < Agents.length; i++) {
		if (Agents[i].agent == agent)
			return Agents[i].name;
	}
}

/**
 * Find agent by name and queue
 * @param {type} agent
 * @param {type} queue
 * @returns {unresolved}
 */
function findAgentInQueue(agent, queue) { // find agent by name (extension) and queue
	logger.debug("findAgentInQueue() Entering:  agent= " + agent + ", queue= " + queue);
	for (var i = 0; i < Agents.length; i++) {
		logger.debug(Agents[i]);
		if ((Agents[i].agent === agent) && (Agents[i].queue === queue)) {
			logger.debug("findAgentInQueue(): found Agent " + agent + ", queue:" + queue);
			return Agents[i];
		} else if ((Agents[i].agent === agent) && (Agents[i].queue === "--")) { // queue not set
			logger.debug("findAgentInQueue(): empty queue");
			return Agents[i];
		}
	}
	return null;
}

/**
 * Display agent information in the array
 * @returns {undefined} Not used
 */
function printAgent() {
	logger.debug("Entering printAgent() ");
	for (var i = 0; i < Agents.length; i++) {
		logger.debug(Agents[i]);
	}
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
	init_ami();
	ami.action(obj, function (err, res) {
		if (err) {
			logger.error('AMI amiaction error ');

		}

	});
}

/**
 * Initialize Agent Call map (total calls taken) 
 * @param {type} obj Map
 * @returns {undefined} Not used
 */
function setCallMap(map) {
	for (var i = 0; i < Asterisk_queuenames.length; i++) {
		map.set(Asterisk_queuenames[i], 0); // set the total call to 0
	}
}

/**
 * Display the content of agent call map
 * @param {type} obj Map
 * @returns {undefined} Not used
 */
function printCallMap(m) {
	m.forEach(function (call, queue) {
		logger.debug("printCallMap(): " + queue + " " + call);
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
	m.forEach(function (call, queue) {
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
			for (var i = 0; i < Asterisk_queuenames.length; i++) {
				logger.debug("QueueSummary :" + evt.queue);
				if (evt.queue === Asterisk_queuenames[i]) {
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
			sendEmit('queue-resp', {'queues': Queues});
			sendEmit('agent-resp', {'agents': Agents});
			break;
		}
		case 'QueueMemberRemoved':
		{
			// set all Agent status to logoff, but do not send a emit, wait for amiaction. Continue to issue an amiaction
			setAgentsLogOff();
			amiaction({'action': 'QueueStatus'});
			break;
		}
		case 'AgentLogin':
		case 'AgentLogoff':
		case 'QueueMemberAdded':
		{
			amiaction({'action': 'QueueStatus'});
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
 * Display event detail information
 * @param {type} evt Event to display
 * @returns {undefined} Not used
 */
function showEvent(evt) {
	if (evt) {
		logger.debug('Event: ' + evt.event);
	}
}

/**
 * Server-db initialziation 
 * @returns {undefined} Not used
 */
function initialize() {

	init_ami();
	mapAgents();
	callAmiActions();
	resetAllCounters();
	setInterval(function () {
		callAmiActions();
	}, pollInterval);
}

/**
 * Initiate amiAction
 * @returns {undefined} Not used
 */
function callAmiActions() {
	amiaction({'action': 'Agents'});
	amiaction({'action': 'QueueSummary'});
	for (var i = 0; i < Queues.length; i++) {
		amiaction({'action': 'QueueStatus', 'Queue': Queues[i].queue});
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
				var ext = data.data[i].extension
				var queues = "--";
				if (data.data[i].queue_name !== null) {
					queues = data.data[i].queue_name;
					if (data.data[i].queue2_name !== null) {
						queues += ", " + data.data[i].queue2_name;
					}
				}
				var usr = {"name": data.data[i].first_name + " " + data.data[i].last_name, "queues": queues};
				if (AgentMap.has(ext))
					AgentMap.delete(ext);
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
			data = {"message": "failed"};
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
		amiaction({'action': 'QueueReset'}, {'Queue': Asterisk_queuenames[i]});
		logger.log(Asterisk_queuenames[i]);
	}
}

app.use(function (err, req, res, next) {
  if (err.code !== 'EBADCSRFTOKEN') return next(err)
  // handle CSRF token errors here
  //res.status(403)
  //res.send('form tampered with')
  res.status(200).json({"message": "Form has been tampered"});
})

/**
 * Handles a GET request for / Checks if user has
 * a valid session, if so display dashboard else 
 * display login page.   
 * 
 * @param {string} '/'
 * @param {function} function(req, res)
 */
app.get('/', function (req, res) {
	if (req.session.role === 'Manager') {
		res.redirect('/dashboard');
	} else {
		res.render('pages/login', { csrfToken: req.csrfToken() });
	}
});

/**
 * Handles a GET request for /dashboard. Checks user has
 * a valid session and displays dashboard page.   
 * 
 * @param {string} '/dashboard'
 * @param {function} function(req, res)
 */
app.get('/dashboard', function (req, res) {
	if (req.session.role === 'Manager') {
		res.render('pages/dashboard');
	} else {
		res.redirect('./');
	}
});

/**
 * Handles a GET request for /cdr. Checks user has
 * a valid session and displays CDR page.   
 * 
 * @param {string} '/cdr'
 * @param {function} function(req, res)
 */
app.get('/cdr', function (req, res) {
	if (req.session.role === 'Manager') {
		res.render('pages/cdr');
	} else {
		res.redirect('/');
	}
});

/**
 * Handles a POST request for login. Creates
 * valid session for authenticated Managers.   
 * 
 * @param {string} '/login'
 * @param {function} function(req, res)
 */
app.post('/login', function (req, res) {
	login(req.body.username, req.body.password, function (user) {
		if (user.message === "success") {
			if (user.data[0].role === "Manager") {
				req.session.id = user.data[0].agent_id;
				req.session.role = user.data[0].role;
				res.status(200).json({"message": "success"});
			} else {
				// User is not a manager
				res.status(200).json({"message": "username not found"});
			}
		} else {
			res.status(200).json(user);
		}
	});
})

/**
 * Handles a GET request for logout, destroys session 
 * and redirects the user to the login page. 
 * 
 * @param {string} '/logout'
 * @param {function} function(req, res)
 */
app.get('/logout', function (req, res) {
	req.session.destroy(function (err) {
		res.redirect(req.get('referer'));
	});
});

/**
 * Handles a GET request for token and returnes a valid JWT token
 * for Manager's with a valid session.
 * 
 * @param {string} '/token'
 * @param {function} function(req, res)
 */
app.get('/token', function (req, res) {
	if (req.session.role === 'Manager') {

		var token = jwt.sign(
			{id: req.session.id},
			new Buffer(decodeBase64(nconf.get('jsonwebtoken:secretkey')), decodeBase64(nconf.get('jsonwebtoken:encoding'))),
			{expiresIn: parseInt(decodeBase64(nconf.get('jsonwebtoken:timeout')))});

		res.status(200).json({message: "success", token: token});
	} else {
		req.session.destroy(function (err) {			
			res.redirect(req.get('referer'));
		});
	}
})

/**
 * Calls the RESTful service running on the provider host to verify the agent 
 * username and password.  
 * 
 * @param {type} username Agent username
 * @param {type} password Agent password
 * @param {type} callback Returns retrieved JSON
 * @returns {undefined} Not used
 */
function login(username, password, callback) {
	var url = decodeBase64(nconf.get('agentservice:url')) + ":" + parseInt(decodeBase64(nconf.get('agentservice:port'))) + "/agentverify/";
	var params = "?username=" + escape(username) + "&password=" + escape(password);
	request({
		url: url + params,
		json: true
	}, function (error, response, data) {
		if (error) {
			logger.error("login ERROR");
			data = {"message": "failed"};
		} else {
			logger.info("Agent Verify: " + data.message);
		}
		callback(data);
	});
}


/**
 * Reset Asterisk stat counters
 * @param {type} param1 Not used
 * @param {type} param2 Not used
 */
app.get('/resetAllCounters', function (req, res) {
	logger.info("GET Call to reset counters");
	resetAllCounters();
	mapAgents();

});

/**  
 * Get Call for Agent Assistance
 * @param {type} param1 Extension
 * @param {type} param2 Response
 */
app.get('/agentassist', function (req, res) {
	logger.info("Agent Assistance");
	if (req.query.extension) {
		sendEmit("agent-request", req.query.extension);
		res.send({'message': 'Success'});
	} else {
		res.send({'message': 'Error'});
	}
});

/**
 * Function to decode the Base64 configuration file parameters.
 * @param {type} encodedString Base64 encoded string.
 * @returns {unresolved} Decoded readable string.
 */
function decodeBase64(encodedString) {
		var decodedString = new Buffer(encodedString, 'base64');
		return(decodedString.toString());
}


