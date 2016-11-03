var express = require('express');
var app = express(); 								// create our app w/ express
var port = process.env.PORT || 8090; 				// set the port
var fs = require('fs');
var nconf = require('nconf');
var morgan = require('morgan');
var bodyParser = require('body-parser');
var methodOverride = require('method-override');
var request = require('request');
var json2csv = require('json2csv');
var log4js = require('log4js');  //https://www.npmjs.com/package/log4js
var tcpp = require('tcp-ping');
var Map = require('collections/map');
var url = require('url');
var cfile = null;
var AsteriskManager = require('asterisk-manager');
//var asterisk_host = nconf.get('asterisk:sip:host');
//var asterisk_host_ari = 'http://' + asterisk_host + ':' + nconf.get('asterisk:sip:wsport');
var ami = null;
var Queues = []; // Associative array
var QueuesArray = []; // Asterisk queues information held here
var Agents = []; // Associative array
var AgentMap = new Map(); //associate extension to agent database record;
var timer;
var Asterisk_queuenames = [];

app.use(express.static(__dirname));
app.use(morgan('dev')); // log every request to the console
app.use(bodyParser.urlencoded({'extended': 'true'})); // parse application/x-www-form-urlencoded
app.use(bodyParser.json()); // parse application/json
app.use(bodyParser.json({type: 'application/vnd.api+json'})); // parse application/vnd.api+json as json
app.use(methodOverride('X-HTTP-Method-Override')); // override with the X-HTTP-Method-Override header in the request

cfile = 'config.json';
nconf.argv().env();
nconf.file({file: cfile});

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

var debugLevel = nconf.get('debuglevel');

var logger = log4js.getLogger(logname);
logger.setLevel(debugLevel); //log level hierarchy: ALL TRACE DEBUG INFO WARN ERROR FATAL OFF


nconf.defaults({// if the port is not defined in the cocnfig.json file, default it to 8080
    dashboard: {
        'pollInterval' : 10000
    },
    http: {
        'port-dashboard': 8090
    }
});

console.log('Config file: ' + cfile);
logger.info('Config file: ' + cfile);

port = nconf.get('http:port-dashboard');

process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

var io = require('socket.io').listen(app.listen(port));
logger.info('Listen on port: ' + port);
var queuenames = nconf.get('dashboard:queuesACL');
	if(nconf.get('environment')==="AD"){
		queuenames = nconf.get('dashboard:queuesAD');
	}
var pollInterval = nconf.get('dashboard:pollInterval');

if(nconf.get('environment')==="ACL"){
	asterisk_host = nconf.get('asterisk:sip:host');
	asterisk_host_ari = 'http://' + asterisk_host + ':' + nconf.get('asterisk:sip:wsport');
}else{
	asterisk_host = nconf.get('asteriskAD:sip:host');
	asterisk_host_ari = 'http://' + asterisk_host + ':' + nconf.get('asteriskAD:sip:wsport');
}

console.log(asterisk_host_ari);
console.log("port number: " + port + ", poll interval:" + pollInterval);

Asterisk_queuenames = queuenames.split(",");

logger.info('****** Restarting server-db  ****');
logger.info('Asterisk queuename: ' + Asterisk_queuenames + ", Poll Interval: " + pollInterval);
logger.info('Asterisk host ARI: ' + asterisk_host_ari);


//Testing Heap size
//setInterval(generateHeapDumpAndStats, 20000);
/**
 * 
 * @returns {undefined}
 */
function generateHeapDumpAndStats(){
  var heapUsed = process.memoryUsage().heapUsed;
  console.log("Program is using " + heapUsed + " bytes of Heap.")
}

io.sockets.on('connection', function (socket) {
	socket.emit('environment', nconf.get('environment'));
    var numClients = 0;

    logger.info('io.socket connected, id: ' + socket.id);

    socket.on('config', function (message) {
        logger.debug('Got config message request: ' + message);
		var confobj = nconf.get('asteriskAD:sip');
		
		if(nconf.get('environment')==="ACL"){
			confobj = nconf.get('asterisk:sip');
		}
        
        socket.emit('sipconf', confobj);

        if (message === 'webuser') {
            var qobj = nconf.get('queues');
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
            ////console.log("Joining room:" + room);
            socket.join(room);
        }

        //var numClients = io.sockets.clients(room).length;
        var roomObject = io.nsps['/'].adapter.rooms[room];
        if (roomObject !== null) {
            numClients = Object.keys(roomObject).length;
        }

        logger.info('Room ' + room + ' has ' + numClients + ' client(s)' + ' for client id:' + socket.id);
        logger.debug('Request to create or join room' + room);

        ////if (numClients == 0){
        if (numClients === 1) {
            //socket.join(room);
            socket.emit('created', room);
            ////} else if (numClients == 1) {
        } else if (numClients === 2) {
            try {
                io.sockets.to(room).emit('join', room);
                //socket.join(room);
                socket.emit('joined', room);
            } catch (err) {
                logger.error('Socket error in create or join ' + err.message);
            }
        } else { // max two clients
            socket.emit('full', room);
        }
        socket.emit('emit(): client ' + socket.id + ' joined room ' + room);
        socket.broadcast.emit('broadcast(): client ' + socket.id + ' joined room ' + room.toString());
    });

    socket.on('hangup', function (room) {
        socket.leave(room);
        //var numClients = io.sockets.clients(room).length;
        logger.debug('Request to leave room ' + room.toString() + ', room has ' + numClients + " client(s)");
    });
});

//calls sendResourceStatus every minute
setInterval(sendResourceStatus, 60000)
function sendResourceStatus(){    
    var hostMap = new Map();
    // list of resources to check for status 
    hostMap.set("Asterisk", nconf.get('asteriskAD:sip:websocket'));
    hostMap.set("ACR-CDR", nconf.get('acr-cdr:url'));
    hostMap.set("VRS Lookup", nconf.get('vrscheck:url'));
	if(nconf.get('environment')==="ACL")
		hostMap.set("ACE Connect Lite", nconf.get('aceconnectlite:url'));
    if(nconf.get('environment')==="AD")
		hostMap.set("ACE Direct", nconf.get('acedirect:url'));
    hostMap.set("ZenDesk", nconf.get('zendesk:url'));
	hostMap.set("Agent Provider", nconf.get('agentservice:url'));
        
    checkConnection(hostMap, function(data){        
        io.to('my room').emit('resource-status', data);
    });
}

/**
 * 
 * @param {type} hosts
 * @param {type} callback
 * @returns {undefined}
 */
function checkConnection(hosts, callback) {

    var results = [];
    var requests = hosts.length;
    
    
    hosts.forEach(function(host, name){
        
    var parsedurl = url.parse(host,true,true);
        var hostname = parsedurl.hostname;
        var port = parsedurl.port;
        if(port === null)
            port = '80';
        // tests if each address is online
        tcpp.probe(hostname, port, function (err, isAlive) {
            if(err){
                callback({error: "An Error Occurred"});
            }else{
                // push results to result arrary
                results.push({"name":name, "host":host, "status": isAlive});
                if (results.length === requests) {
                    //Sort Request by name
                    results.sort(function(a, b) {
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
 * 
 * @returns {undefined}
 */
function init_ami() {
  
    if (ami === null) {
        try {
			if(nconf.get('environment')==="ACL"){
            ami = new AsteriskManager(nconf.get('asterisk:ami:port'),
                    nconf.get('asterisk:sip:host'),
                    nconf.get('asterisk:ami:id'),
                    nconf.get('asterisk:ami:passwd'), true);
			}else{
				ami = new AsteriskManager(nconf.get('asteriskAD:ami:port'),
                    nconf.get('asteriskAD:sip:host'),
                    nconf.get('asteriskAD:ami:id'),
                    nconf.get('asteriskAD:ami:passwd'), true);
			}
			ami.keepConnected();
            ami.on('managerevent', handle_manager_event);
        } catch (exp) {
            logger.error('Init AMI error: ' + exp.message);
        }
    }
}

/**
 * 
 * @param {type} evt
 * @param {type} message
 * @returns {undefined}
 */
function sendEmit(evt, message) {

    try {
        io.sockets.emit(evt, message);
    } catch (exp) {
        logger.error('Socket io emit error: ' + exp.message);
    }
}

/**
 * 
 * @param {type} agent
 * @returns {unresolved}
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
 * 
 * @param {type} agent
 * @returns {unresolved}
 */
function findAgentName (agent) {
    for (var i=0; i<Agents.length; i++) {
        if (Agents[i].agent == agent)
            return Agents[i].name;
    }
}

/**
 * 
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
        }
        else if ((Agents[i].agent === agent) && (Agents[i].queue === "--")) { // queue not set
            logger.debug("findAgentInQueue(): empty queue");
            return Agents[i];
        }
    }
    return null;
}

/**
 * 
 * @returns {undefined}
 */
function printAgent() {
    logger.debug ("Entering printAgent() ");
    for (var i=0; i <Agents.length; i++) {
        logger.debug(Agents[i]);
    }
}

/**
 * 
 * @returns {undefined}
 */
function setAgentsLogOff() {
     for (var i = 0; i < Agents.length; i++) {
        Agents[i].status = "Logged Out";
        Agents[i].queue = "--";
    }
}

/**
 * 
 * @param {type} queue
 * @returns {unresolved}
 */
function findQueue(queue) {
    for (var i = 0; i < Queues.length; i++) {
        if (Queues[i].queue === queue)
            return Queues[i];
    }
    return null;
}

/**
 * 
 * @param {type} obj
 * @returns {undefined}
 */
function amiaction(obj) {
    init_ami();
    ami.action(obj, function (err, res) {
        if (err) {
            logger.error('AMI amiaction error: ' + err.toString());

        }
       
    });
}

function setCallMap(map) {
    for (var i=0; i<Asterisk_queuenames.length; i++) {
        map.set(Asterisk_queuenames[i], 0); // set the total call to 0
    }
}

function printCallMap(m){
    m.forEach(function(call, queue){
        logger.debug("printCallMap(): " + queue + " " + call);
    });
}


function getTotalCallsTaken(m) {
    var num = 0;
    //printCallMap(m);
     m.forEach(function(call, queue){
        num += call;
    });
    logger.debug("getTotalCallsTaken " + num );
     return num;
}

function incrementCallMap(m, myqueue) {
    m.forEach(function(call, queue) {
        if (queue === myqueue) {
            var increment = call +1;
            m.set(queue, increment);
            logger.debug ("incrementCallMap: queue=" + queue + ", value=" + increment);
        }
    });
}
/**
 * 
 * @param {type} evt
 * @returns {undefined}
 */
function handle_manager_event(evt) {
    //logger.debug (evt);
    //logger.debug("handle_manager_event(): received " + evt.event);

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
             //logger.debug (evt);
            a = findAgent(evt.agent); // find agent by extension e.g. JSSIP/60001
			var agentInt = parseInt(evt.agent);
            if (!a) {
				if(AgentMap.has(agentInt)){
					logger.debug ("Agents: New Agent"); 
					evt.name = AgentMap.get(agentInt).name;
					evt.talktime = 0;
					evt.avgtalktime = 0;
					evt.callstaken = 0;
					evt.queue = '--';
					evt.status = "Logged Out";
                    evt.callMap = new Map();
                    for (var i=0; i<Asterisk_queuenames.length; i++) {
                            evt.callMap.set(Asterisk_queuenames[i], 0); // set the total call to 0
                    }       
					//evt.callsabandoned = 0; -- this information is not available for agent
					Agents.push(evt);
					
				}else {
					logger.debug("AMI event Agent not in AgentMap");
				}
            } else {
                logger.debug ("Existing agent");  // status always set to AGENT_LOGGEDOFF. Do not use this field
                
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
                    a.talktime = Number(Number(a.talktime) +  Number(evt.talktime)/60).toFixed(2);
                }

                a.holdtime += Number((Number(evt.holdtime ? evt.holdtime : "0") / 60).toFixed(2));
                // increment the callsComplete - queueMember calls field didn't update.
                incrementCallMap(a.callMap, evt.queue);
                // do not send agent-resp till ends of QueueStatusComplete
            }
            else 
                logger.debug ("AgentComplete: cannot find agent " + evt.membername);
            break;
        }
        case 'QueueMember':
        { // update status and averageTalkTime
            logger.debug(evt);
            //logger.debug("QueueMember evtname :" + evt.name + ", queue = " + evt.queue + ", name: " + evt.name + ", status:" + evt.status + ", paused=" + evt.paused);
            name = evt.name.split("/");
            a = findAgent(name[1]); // use full name e.g. PSSIP/30001 which is the extension
            if (a) {
                logger.debug ("QueueMember(): found existing Agent");
              
                if (((evt.status === "5") || (evt.status === "1"))  && evt.paused === "1") // DEVICE_UNAVAILABLE
                        a.status = "Away";
                else if (((evt.status === "1") || (evt.status === "5")) && evt.paused === "0") // In a call
                        a.status = "Ready";
               /* else if (evt.status === "2" && evt.paused === "1") // In a call
                        a.status = "In Call"; */
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
            logger.debug (evt);
            for (var i=0; i<Asterisk_queuenames.length; i++) {
                logger.debug("QueueSummary :" + evt.queue );
                if ( evt.queue === Asterisk_queuenames[i] ) {
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
                    q.talktime = Number(evt.talktime/ 60).toFixed(2);
                    logger.debug("QueueSummary(): q.talktime: " + q.talktime);
                    q.longestholdtime = Number(evt.longestholdtime / 60).toFixed(2);
                }
            }
            break;
        }
        case 'QueueSummaryComplete':
        {
            //logger.debug("QueueSummaryComplete received: get QueueStatus");
            // Need both QueueStatus and QueueSumary to get all the queue related information. Get QueueStatus
            /*for (var i = 0; i < Queues.length; i++) {
                amiaction({'action': 'QueueStatus', 'Queue': Queues[i].queue});
            } */

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
              // set all Agent status to logoff, but do not send a emit, wait for amiaction. Continue to issue an amiaction
              setAgentsLogOff();
        case 'AgentLogin':
        case 'AgentLogoff':
        case 'QueueMemberAdded':
        {
            //amiaction({'action': 'QueueSummary'});
            amiaction({'action': 'QueueStatus'});
            break;
        }
        case 'QueueStatus':
        case 'Cdr':
        case 'Queues':
        case 'AgentsComplete':
        {

            break;
        }
        default:
            //logger.error('AMI unhandled event in handle_manager_event(): ' + evt.event);
            //console.log('AMI unhandled event:' + evt.event);
            break;
    }
}

/**
 * 
 * @param {type} evt
 * @returns {undefined}
 */
function showEvent(evt) {
    if (evt) {
        logger.debug('Event: ' + evt.event);
    }
}

/**
 * 
 * @returns {undefined}
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
 * 
 * @returns {undefined}
 */
function callAmiActions() {
    amiaction({'action': 'Agents'});
    amiaction({'action': 'QueueSummary'});
    for (var i = 0; i < Queues.length; i++) {
                amiaction({'action': 'QueueStatus', 'Queue': Queues[i].queue});
    } 
}

/**
 * 
 * @returns {undefined}
 */
function mapAgents(){
	getAgentsFromProvider(function(data){
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
					if(AgentMap.has(ext))
						AgentMap.delete(ext);
					AgentMap.set(ext,usr);					
				}
			}
		}); 
}

/**
 * 
 * @param {type} callback
 * @returns {undefined}
 */
function getAgentsFromProvider(callback) {
	
	var url = nconf.get('agentservice:url') + "/getallagentrecs";
    request({
        url: url,
        json: true
    }, function (err, res, data) {
        if (err) {
            logger.error("ERROR: " + err);
            data = {"message": "failed"};
        } 
        else {
			callback(data);
        }
     
    });
}

/**
 * 
 * @returns {undefined}
 */
function resetAllCounters() {
    for (var i = 0; i < Asterisk_queuenames.length; i++) {
        amiaction ({'action': 'QueueReset'}, {'Queue': Asterisk_queuenames[i]});
        logger.log(Asterisk_queuenames[i]);
    }  
}

app.get('/resetAllCounters', function(req, res) {
    logger.info("GET Call to reset counters");
    resetAllCounters();
	mapAgents();
  
});

// Get Call for Agent Assistance
app.get('/agentassist', function(req, res) {
    logger.info("Agent Assistance");    
    if(req.query.extension){
		sendEmit("agent-request", req.query.extension);
		res.send({'message': 'Success'});
        }else{
			res.send({'message': 'Error'});
        }
});

//GET Call for CDR information
app.get('/cdrinfo', function(req, res) {
    logger.info("GET Call to /cdrinfo");

    var url = nconf.get('acr-cdr:url');
    if (req.query.start&&req.query.end){
        url += '?start='+req.query.start+'&end='+req.query.end;
    }
    console.log(url);
    request({
        url: url,
       json: true
       }, function(error, response, data) {
            if(error){
                console.log("ERROR: " + error);
                data = {"message": "failed"};
            }
            else if(response.statusCode === 200){
                if(req.query.format === 'csv'){ //Builds CSV file for response
                    //csv field values
                    var csvFields = ['calldate', 'clid', 'src',
                        'dst', 'dcontext', 'channel',
                        'dstchannel', 'lastapp', 'lastdata',
                        'duration', 'billsec', 'disposition',
                        'amaflags', 'accountcode', 'userfield',
                        'uniqueid', 'linkedid', 'sequence',
                        'peeraccount'];
                    var csv = json2csv({'data': data.data, 'fields': csvFields});
                    res.setHeader('Content-disposition', 'attachment; filename=cdr.csv');
                    res.set('Content-Type', 'text/csv');
                    res.status(200).send(csv);
                }else{
                    res.status(200).send(data); //returns JSON object of CDR
                }
            } else {
                res.status(response.statusCode).send(data)
            }
        });
});


setImmediate(initialize);
