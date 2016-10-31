/**
 * New node file
 */
//var socket = io.connect();
var dbController = angular.module('dashboardModule', ['csrService'])
	.controller('dashboardController', function($scope, $http, $window, socket) {
		
		$scope.Queues = [];
		$scope.qNames = [];
		$scope.queue = "";
		$scope.Agents = [];
		$scope.summary = {};
		$scope.summary.calls = 0;
		$scope.summary.completed = 0;
		$scope.summary.holdtime = 0;
		$scope.summary.abandoned = 0;
		$scope.summary.avgholdtime = 0;

		// receives queue summary update every minute 
		socket.on('queue', function (data){
			console.log("Received socket emit for queues...");
			//$scope.$apply(function() {
				$scope.Queues = data.queues;
				if (data.queues.length !== $scope.qNames.length) { 
					//console.log("Push qNames socket........." );
        			$scope.qNames = [];
        			for (var i=0; i<data.queues.length; i++) {
        				$scope.qNames.push(data.queues[i].queue);
        				//console.log("Push qNames.........." + $scope.qNames[i]);
        			}
        		}
			//});
			});
		function findAgent(scopeagents, dataagent) {
			for (var i=0; i<scopeagents.length; i++) {
				if (scopeagents[i].agent === dataagent.agent)
					return scopeagents[i];
			}
			return null;
		}
		socket.on('agent-resp', function (data){
			console.log("Received agent data..." + JSON.stringify(data, null,2,true));					
				//$scope.Agents = data.agents;
				if (data.agents) {
					for (var i=0; i<data.agents.length; i++) {
						var a = findAgent($scope.Agents, data.agents[i]);
						if (a) {
							for (var prop in data.agents[i]) {
								a[prop] = data.agents[i][prop];
							}
						}
						else {
							$scope.Agents.push(data.agents[i]);
						}
					}
				}
			});
		socket.on('queue-resp', function (data){
			console.log("Received queue data..." + JSON.stringify(data, null,2,true));					
				$scope.Queues = data.queues;
				calculateSummary();
			});
		
		socket.on('sipconf', function (data){
			console.log("Received sip conf data..." + JSON.stringify(data, null,2,true));
			$window.sipconf = data; // so the data can be accessed by non-angular javascript under the window element
		});
		socket.on('queueconf', function (data){
			console.log("Received queue conf data..." + JSON.stringify(data, null,2,true));	
			$window.queueconf = data;
		});
		
		socket.on('agent-request', function (data){
			console.log("Received agent-request help data..." + JSON.stringify(data, null,2,true));	
			for (var i=0; i<$scope.Agents.length; i++) {
				if ($scope.Agents[i].agent === data.extension) {
					console.log("Extension needs assistance: " + $scope.Agents[i].agent);
					$scope.Agents[i].help = 'yes';
				}
			}
		});
		
		calculateSummary = function () {
			$scope.summary.calls = 0;
			$scope.summary.completed = 0;
			$scope.summary.holdtime = 0;
			$scope.summary.abandoned = 0;
			$scope.summary.avgholdtime = 0;
			for (var i=0; i<$scope.Queues.length; i++) {
				$scope.summary.calls += Number($scope.Queues[i].calls);
				$scope.summary.completed += Number($scope.Queues[i].completed);
				$scope.summary.holdtime += (Number($scope.Queues[i].holdtime) / 60).toFixed(2);
				$scope.summary.abandoned += Number($scope.Queues[i].abandoned);

                                
                                //HERE - trying out rounding fix NEW
				$scope.Queues[i].talktime = (Number($scope.Queues[i].talktime) / 60).toFixed(2); //NEW

			}
			if ($scope.Queues && $scope.Queues.length > 0 && $scope.summary.holdtime > 0)
				$scope.summary.avgholdtime = ($scope.summary.holdtime / $scope.Queues.length).toFixed(2);
			else
				$scope.summary.avgholdtime = 0;
		}
		$scope.initData = function () {
			   //$scope.getQueues();
			   socket.emit('config', 'agent');
			   socket.emit('config', 'webuser');
			   socket.emit('ami-req', "agent");
			   socket.emit('ami-req', "queue");
		} 
		
		angular.element(document).ready($scope.initData());       
     
	});

dbController.directive('highlightOnChange', function() {
	  return {
	    link : function(scope, element, attrs) {
	      var timer;
	      attrs.$observe( 'highlightOnChange', function ( val ) {
	        console.log("Highlighting val:" + val);
	        if (val === 'yes') {
	        	timer = setInterval(function () {
	        		jQuery(element).addClass("danger");
	            	jQuery(element).fadeOut(500, function() {
	            		jQuery(element).fadeIn(1500);
	                });
	            }, 2000);
	        }
	        else {
	        	if (timer) clearInterval(timer);
	        	jQuery(element).removeClass("danger");
	        }
	      });
	    }
	  };
	});

dbController.filter('shownum', function () {
	return function (input) {
		if (!input) {
			return 0;
		}
		else {
			return input;
		}
	}
});
