/**
 * Logger file
 */
 var logger = exports;
  logger.debugLevel = 'warn';
  logger.log = function(level, message, jsonobj) {
    var levels = ['error', 'warn', 'info', 'debug'];
    if (levels.indexOf(level) <= levels.indexOf(logger.debugLevel) ) {
      //if (typeof message !== 'string') {
      if (jsonobj) {
          message += (': ' + JSON.stringify(jsonobj, null, 2));
      };
      console.log(level + ': '+ message);
    }
  }