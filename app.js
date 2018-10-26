// This is the main JS for the fendesk RESTFul server
var https = require('https');
var express = require('express');
var bodyParser = require('body-parser');
var app = express();
var fs = require('fs');
var clear = require('clear');
var log4js = require('log4js');
var nconf = require('nconf');
var cfile = null;
var ip = require("ip");

// Initialize log4js
log4js.loadAppender('file');
var logname = 'fendesk';
log4js.configure({
	appenders: [
		{
			type: 'dateFile',
			filename: 'logs/' + logname + '.log',
			alwaysIncludePattern: false,
			maxLogSize: 20480,
			backups: 10
		}
	]
});

// Get the name of the config file from the command line (optional)
nconf.argv().env();

cfile = '../dat/config.json';

//Validate the incoming JSON config file
try {
	var content = fs.readFileSync(cfile,'utf8');
	var myjson = JSON.parse(content);
} catch (ex) {
    console.log("");
    console.log("*******************************************************");
    console.log("Error! Malformed configuration file: " + cfile);
    console.log('Exiting...');
    console.log("*******************************************************");
    console.log("");
    process.exit(1);
}

var logger = log4js.getLogger(logname);

nconf.file({file: cfile});
var configobj = JSON.parse(fs.readFileSync(cfile,'utf8'));

//the presence of a populated cleartext field in config.json means that the file is in clear text
//remove the field or set it to "" if the file is encoded
var clearText = false;
if (typeof(nconf.get('common:cleartext')) !== "undefined"  && nconf.get('common:cleartext') !== ""    ) {
    console.log('clearText field is in config.json. assuming file is in clear text');
    clearText = true;
}

// Set log4js level from the config file
logger.setLevel(getConfigVal('common:debug_level'));
logger.trace('TRACE messages enabled.');
logger.debug('DEBUG messages enabled.');
logger.info('INFO messages enabled.');
logger.warn('WARN messages enabled.');
logger.error('ERROR messages enabled.');
logger.fatal('FATAL messages enabled.');
logger.info('Using config file: ' + cfile);


var credentials = {
	key: fs.readFileSync(getConfigVal('common:https:private_key')),
	cert: fs.readFileSync(getConfigVal('common:https:certificate'))
};

// Start the server
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use('/apidoc',express.static(__dirname + '/apidoc'));
app.use(bodyParser.json({type: 'application/vnd/api+json'}));

var routes = require('./routes/routes.js')(app,fs,ip,getConfigVal('zendesk:port'),logger);
var httpsServer = https.createServer(credentials,app);
httpsServer.listen(parseInt(getConfigVal('zendesk:port')));
logger.debug('HTTPS Fendesk server running on port=%s   (Ctrl+C to Quit)', parseInt(getConfigVal('zendesk:port')));


// Handle Ctrl-C (graceful shutdown)
process.on('SIGINT', function() {
  logger.debug('Exiting...');
  process.exit(0);
});

/**
 * Function to verify the config parameter name and
 * decode it from Base64 (if necessary).
 * @param {type} param_name of the config parameter
 * @returns {unresolved} Decoded readable string.
 */
function getConfigVal(param_name) {
  var val = nconf.get(param_name);
  if (typeof val !== 'undefined' && val !== null) {
    //found value for param_name
    var decodedString = null;
    if (clearText) {
      decodedString = val;
    } else {
      decodedString = new Buffer(val, 'base64');
    }
  } else {
    //did not find value for param_name
    logger.error('');
    logger.error('*******************************************************');
    logger.error('ERROR!!! Config parameter is missing: ' + param_name);
    logger.error('*******************************************************');
    logger.error('');
    decodedString = "";
  }
  return (decodedString.toString());
}
