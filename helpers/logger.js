'use strict';
var getConfigVal = require('./utility').getConfigVal;
var log4js = require('log4js');  //https://www.npmjs.com/package/log4js
var nconf = require('nconf');

var cfile = '../dat/config.json'; // Config file
nconf.argv().env();
nconf.file({ file: cfile });

var logname = 'server-db';
log4js.configure({
	appenders: {
	  server_db: {
		type: 'dateFile',
		filename: 'logs/' + logname + '.log',
		alwaysIncludePattern: false,
		maxLogSize: 20480,
		backups: 10
	  }
	},
	categories: {
	  default: {
		appenders: ['server_db'],
		level: 'error'
	  }
	}
  })

var debugLevel = getConfigVal('common:debug_level');

var logger = log4js.getLogger('server_db');
logger.level = debugLevel; //log level hierarchy: ALL TRACE DEBUG INFO WARN ERROR FATAL OFF

module.exports = logger;
