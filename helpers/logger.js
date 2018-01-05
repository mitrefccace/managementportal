'use strict';
var decodeBase64 = require('./utility').decodeBase64;
var log4js = require('log4js');  //https://www.npmjs.com/package/log4js
var nconf = require('nconf');

var cfile = '../dat/config.json'; // Config file
nconf.argv().env();
nconf.file({ file: cfile });

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

var debugLevel = decodeBase64(nconf.get('common:debug_level'));

var logger = log4js.getLogger(logname);
logger.setLevel(debugLevel); //log level hierarchy: ALL TRACE DEBUG INFO WARN ERROR FATAL OFF

module.exports = logger;
