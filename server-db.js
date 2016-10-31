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
// var logger = require('./logger');
var log4js = require('log4js');  //https://www.npmjs.com/package/log4js
var cfile = null;

app.use(express.static(__dirname));
app.use(morgan('dev')); // log every request to the console
app.use(bodyParser.urlencoded({'extended': 'true'})); // parse application/x-www-form-urlencoded
app.use(bodyParser.json()); // parse application/json
app.use(bodyParser.json({type: 'application/vnd.api+json'})); // parse application/vnd.api+json as json
app.use(methodOverride('X-HTTP-Method-Override')); // override with the X-HTTP-Method-Override header in the request

nconf.argv().env();

cfile = 'config.json';


nconf.file({file: cfile});

// Log to a file
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
    'http': {
        'port-dashboard': 8090
    }
});

console.log('Config file: ' + cfile);
logger.info('Config file: ' + cfile);

port = nconf.get('http:port-dashboard');
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
console.log("port number" + port);

var io = require('socket.io').listen(app.listen(port));
logger.info('Listen on port: ' + port);
var queuenames = nconf.get('dashboard:queues')

var AsteriskManager = require('asterisk-manager');
var asterisk_host = nconf.get('asterisk:sip:host');
var asterisk_host_ari = 'http://' + asterisk_host + ':' + nconf.get('asterisk:sip:wsport');
var ami = null;
var Queues = []; // Associative array
var QueuesArray = []; // Asterisk queues information held here
var Agents = []; // Associative array
var timer;
var Asterisk_queuenames = [];


Asterisk_queuenames = queuenames.split(",");
console.log(Asterisk_queuenames);


logger.info('Asterisk queuenames ' + Asterisk_queuenames);

logger.info('Asterisk host: ' + asterisk_host);
logger.info('Asterisk host ARI: ' + asterisk_host_ari);

io.sockets.on('connection', function (socket) {
    var numClients = 0;
    
    logger.info('io.socket connected, id: ' + socket.id);

    socket.on('config', function (message) {
        logger.debug('Got config message request: ' + message);

        var confobj = nconf.get('asterisk:sip');
        socket.emit('sipconf', confobj);

        if (message === 'webuser') {
            var qobj = nconf.get('queues');
            socket.emit('queueconf', qobj);
            logger.debug('Message is webuser type');
        }
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

function init_ami() {
    logger.debug('Entering AMI init_ami()');

    if (ami === null) {
        try {
            ami = new AsteriskManager(nconf.get('asterisk:ami:port'),
                    nconf.get('asterisk:sip:host'),
                    nconf.get('asterisk:ami:id'),
                    nconf.get('asterisk:ami:passwd'), true);
            ami.keepConnected();
            ami.on('managerevent', handle_manager_event);
        } catch (exp) {
            logger.error('Init AMI error: ' + exp.message);
        }
    }
}

function sendEmit(evt, message) {
    logger.debug('Entering AMI sendEmit()');

    try {
        io.sockets.emit(evt, message);
    } catch (exp) {
        logger.error('Socket io emit error: ' + exp.message);
    }
}

function findAgent(agent) {
    logger.debug('Entering AMI findAgent()');

    for (var i = 0; i < Agents.length; i++) {
        if (Agents[i].agent === agent)
            return Agents[i];
    }
    return null;
}

function findQueue(queue) {
    logger.debug('Entering AMI findQueue()');

    for (var i = 0; i < Queues.length; i++) {
        if (Queues[i].queue === queue)
            return Queues[i];
    }
    return null;
}

function amiaction(obj) {
    logger.debug('Entering AMI amiaction()');

    init_ami();
    ami.action(obj, function (err, res) {
        if (err) {
            logger.error('AMI amiaction error: ' + err.toString());
            console.log('AMI amiaction error: ' + err.toString());
        }
        if (res) {
            logger.info('AMI action ' + obj.action + ' result:' + res.response);
            
        }
    });
}

function handle_manager_event(evt) {

    logger.debug('AMI entering handle_manager_event(): ' + evt.event);
    var a;
    var name;
    var q;

    switch (evt.event) {
        case 'FullyBooted':
        {
            break;
        }
        case 'Agents':
        {
            a = findAgent(evt.agent);
            if (!a) {
                evt.talktime = 0;
                evt.avgtalktime = 0;
                evt.callstaken = 0;
                evt.callsabandoned = 0;
                Agents.push(evt);
            } else {
                a.talktime += Number((Number(evt.talktime ? evt.talktime : "0") / 60).toFixed(2));
                
                if (evt.status === "1") {
                    a.status = "Logged In";
                } else {
                    a.status = "Logged Out";
                }
            }
            break;
        }
        case 'AgentsComplete':
        {
            sendEmit('agent-resp', {'agents': Agents});
            break;
        }
        case 'AgentComplete':
        {
            name = evt.membername.split("/");
            //console.log("..................AgentComplete name:" + name[1]);
            a = findAgent(name[1]);
            if (a) {
                a.talktime += Number((Number(evt.talktime ? evt.talktime : "0") / 60).toFixed(2));
                a.holdtime += Number((Number(evt.holdtime ? evt.holdtime : "0") / 60).toFixed(2));
                if (a.callstaken > 0) {
                    //a.avgtalktime += a.talktime / a.callstaken;
                    a.avgtalktime = (a.talktime / a.callstaken).toFixed(2);
                }
            }
            sendEmit('agent-resp', {'agents': Agents});
            break;
        }
        case 'QueueMember':
        {
            name = evt.name.split("/");
            //console.log("QueueMember name:" + name[1]);
            a = findAgent(name[1]);
            if (a) {
                //console.log (evt);
                
                a.talktime += Number((Number(evt.talktime ? evt.talktime : "0") / 60).toFixed(2));
                a.callstaken = Number(evt.callstaken);
                if (a.callstaken > 0) {
                    a.avgtalktime = (a.talktime / a.callstaken).toFixed(2);
                }
               
                if (evt.status === "5") // DEVICE_UNAVAILABLE
                    a.status = "Logged Off";
                else if (evt.incall === "1") // In a call
                    a.status = "Busy";
                else if (evt.incall === "0" && evt.paused === "0") // Not in a call, not pause ==> ready
                    a.status = "Ready";
                else if (evt.incall === "0" && evt.paused === "1") // not in a call, paused = away
                    a.status = "Away";

            }
            sendEmit('agent-resp', {'agents': Agents});
            break;
        }
        case 'AgentsComplete':
        {
            sendEmit('agent-resp', {'agents': Agents});
            break;
        }
        case 'QueueParams':
        {
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
            //console.log (evt.queue);
            for (var i=0; i<Asterisk_queuenames.length; i++) {
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
                    q.holdtime = Number((Number(evt.holdtime) / 60).toFixed(2));
                    q.talktime = Number((Number(evt.talktime) / 60).toFixed(2));
                    q.longestholdtime = Number((Number(evt.longestholdtime) / 60).toFixed(2));
                }
            }
            break;
        }
        case 'QueueSummaryComplete':
        {
            for (var i = 0; i < Queues.length; i++) {
                amiaction({'action': 'QueueStatus', 'Queue': Queues[i].queue});
            }
            
            break;
        }
        case 'QueueStatusComplete':
        case 'QueueSummaryComplete':
        {
            sendEmit('queue-resp', {'queues': Queues});
            break;
        }
        case 'AgentLogin':

        case 'AgentLogoff':
        case 'QueueMemberAdded':
        case 'QueueMemberRemoved':
        {
            amiaction({'action': 'QueueSummary'});
            amiaction({'action': 'Agents'});
            break;
        }
        case 'QueueStatus':
        case 'Cdr':
        case 'Queues':
        {

            break;
        }
        default:
            //logger.error('AMI unhandled event in handle_manager_event(): ' + evt.event);
            //console.log('AMI unhandled event:' + evt.event);
            break;
    }
}

function showEvent(evt) {
    if (evt) {
        logger.debug('Event: ' + evt.event);
    }
}

function initialize() {
    logger.debug('AMI entering initialize(): ');

    init_ami();
    callAmiActions();
    setInterval(function () {
        callAmiActions();
    }, 20000);
}

function callAmiActions() {
    logger.debug('AMI entering callAmiActions(): ');

    amiaction({'action': 'QueueSummary'});
    amiaction({'action': 'Agents'});
    amiaction({'action': 'Queues'});

}

app.get('/resetAllCounters', function(req, res) {
    logger.info("GET Call to reset counters");
    console.log ("GET CAll to reset counters");
    for (var i = 0; i < Asterisk_queuenames.length; i++) {
        amiaction ({'action': 'QueueReset'}, {'Queue': Asterisk_queuenames[i]});
        console.log (Asterisk_queuenames[i]);
        logger.log(Asterisk_queuenames[i]);
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

