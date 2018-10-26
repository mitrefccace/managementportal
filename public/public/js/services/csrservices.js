/**
 * New node file
 */
'use strict';

angular.module('csrService', []).factory('socket', ['$rootScope', '$http', '$timeout', '$q', function ($rootScope, $http, $timeout, $q) {
		//var socket = io.connect();
		var socket = io.connect('https://' + window.location.host, {
			path: nginxPath+'/socket.io',
			query: 'token=' + socketToken(),
			forceNew: true
		});
		return {
			on: function (eventName, callback) {
				socket.on(eventName, function () {
					var args = arguments;
					$rootScope.$apply(function () {
						callback.apply(socket, args);
					});
				});
			},
			emit: function (eventName, data, callback) {
				socket.emit(eventName, data, function () {
					var args = arguments;
					$rootScope.$apply(function () {
						if (callback) {
							callback.apply(socket, args);
						}
					});
				})
			}
		};


	}]);

function socketToken() {
	var token = '';
	$.ajax({
		url: './token',
		type: 'GET',
		dataType: 'json',
		async: false,
		success: function (data) {
			if (data.message === "success") {
				token = data.token;
			}
		}
	});
	return token;
}
