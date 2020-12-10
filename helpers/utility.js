'use strict';

var nconf = require('nconf');

var cfile = '../dat/config.json'; // Config file
nconf.argv().env();
nconf.file({
	file: cfile
});

//the presence of a populated cleartext field indicates that the file is unencoded
//remove cleartext or set it to "" to idicate that the file is encoded
var clearText = false;
if (typeof (nconf.get('common:cleartext')) !== "undefined"  && nconf.get('common:cleartext') !== "" ) {
	console.log('clearText field is in config.json. assuming file is in clear text');
	clearText = true;
}

/**
 * Function to verify the config parameter name and
 * decode it from Base64 (if necessary).
 * @param {type} param_name of the config parameter
 * @returns {unresolved} Decoded readable string.
 */
exports.getConfigVal = function (param_name) {
  var val = nconf.get(param_name);
  if (typeof val !== 'undefined' && val !== null) {
    //found value for param_name
    var decodedString = null;
    if (clearText) {
      decodedString = val;
    } else {
	  decodedString = Buffer.from(val, 'base64');
    }
  } else {
    //did not find value for param_name
    console.log('');
    console.log('*******************************************************');
    console.log('ERROR!!! Config parameter is missing: ' + param_name);
    console.log('*******************************************************');
    console.log('');
    decodedString = "";
  }
  return (decodedString.toString());
};

/**
 * Function that sets the rgb fields in the json file from a given color (for light config page)
 * @param {json_data} a json object of the color_config.json file
 * @param {status} the status index to update the correct status info in the json file
 * @param {color} the name of the color
 * @returns {return} the updated json object
 */
exports.set_rgb_values = function (json_data, status, color) {
	//json_data.statuses[status] gets you the fields of each specific status
	if (color === "red") {
		json_data.statuses[status].r = 255;
		json_data.statuses[status].g = 0;
		json_data.statuses[status].b = 0;
	} else if (color === "green") {
		json_data.statuses[status].r = 0;
		json_data.statuses[status].g = 255;
		json_data.statuses[status].b = 0;
	} else if (color === "blue") {
		json_data.statuses[status].r = 0;
		json_data.statuses[status].g = 0;
		json_data.statuses[status].b = 255;
	} else if (color === "orange") {
		json_data.statuses[status].r = 255;
		json_data.statuses[status].g = 50;
		json_data.statuses[status].b = 0;
	} else if (color === "yellow") {
		json_data.statuses[status].r = 255;
		json_data.statuses[status].g = 255;
		json_data.statuses[status].b = 0;
	} else if (color === "pink") {
		json_data.statuses[status].r = 255;
		json_data.statuses[status].g = 0;
		json_data.statuses[status].b = 255;
	} else if (color === "aqua") {
		json_data.statuses[status].r = 0;
		json_data.statuses[status].g = 255;
		json_data.statuses[status].b = 255;
	} else {
		//color is white
		json_data.statuses[status].r = 255;
		json_data.statuses[status].g = 255;
		json_data.statuses[status].b = 255;
	}
	return json_data;
};
