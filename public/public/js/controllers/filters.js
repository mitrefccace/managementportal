/**
 * New node file
 */
//-----------------------------------------------------------------------

'use strict';

//angular.module('CDM.filterModule', []).filter('CDMshorten', function () {
var filterModule = angular.module('filterModule', []);

filterModule.filter('shorten', function () {
	return function (input, length) {
		var len = 50; // default to 50 chars
		var out = input;
		if (length && length > 0) {
			len = length;
		}
		if (out !== null && out.length > len) {
			out = input.substr(0, len) + "...";
		}
		return out;
	}
});
filterModule.filter('ssnfilter', function () {
	return function (input) {
		
		var out = "";
		if (input && input.length > 4) {
			out = input.substring(input.length-4);
		}
		
		return "***********" + out;
	}
});
filterModule.filter('ACRdate', function ($filter) {
    return function (input, time) {
        if (input == null || input.length == 0) {
            return "Unavailable";
        }
            var d = new Date(input);
            if (time && time === 't') { // returns time only
                return $filter('date')(d, 'shortTime');
            }
            else if (time && time === 'd') { // returns date only
                return $filter('date')(d, 'mediumDate');
            }
            else if (time === 'd-or-t') { // returns date or time depending on if it's today
                var today = new Date();
                if (d.getFullYear() == today.getFullYear() &&
                    d.getMonth() == today.getMonth() &&
                    d.getDate() == today.getDate()) {
                    return $filter('date')(d, 'shortTime');
                }
                else {
                    return $filter('date')(d, 'mediumDate');
                }
            }
            else if (time && time === 'us') { // returns the normal date used in the U.S.
                return $filter('date')(d, 'MM/dd/yyyy HH:mm');
            }
            else if (time === 'utc') { // returns whole string in utc format. will add the time offset at end
                return $filter('date')(d, 'yyyy-MM-ddTHH:mmZ');
            }
            else if (time === 'iso') { // returns whole string in ISO format. will produce format like yyyy-MM-ddTHH:mmZ
                return d.toISOString();
            }
            else // default to return date and time in 'MMM dd, yyyy HH:mm' format (military format)
                //return $filter('date')(d, 'medium');
                return $filter('date')(d, 'MMM dd, yyyy HH:mm');
        }
});