'use strict';

var dbController = angular.module('dashboardModule', ['csrService', 'angularDurationFormat'])
		.controller('dashboardController', function($scope, $http, $window, socket) {

		$scope.Queues = [];
		$scope.qNames = [];
		$scope.queue = "";
		$scope.Agents = [];
		$scope.summary = {};
		$scope.summary.callers = 0;
		$scope.summary.completed = 0;
		$scope.summary.holdtime = 0;
		$scope.summary.abandoned = 0;
		$scope.summary.avgholdtime = 0;

		// receives queue summary update every minute
		socket.on('queue', function (data){
			$scope.Queues = data.queues;
			if (data.queues.length !== $scope.qNames.length) {
				$scope.qNames = [];
				for (var i=0; i<data.queues.length; i++) {
					$scope.qNames.push(data.queues[i].queue);
				}
			}
		});

		function findAgent(scopeagents, dataagent) {
			for (var i=0; i<scopeagents.length; i++) {
				if (scopeagents[i].agent === dataagent.agent)
					return scopeagents[i];
			}
			return null;
		}

		socket.on('agent-resp', function (data){
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

				updateAgentStatusPieChart(data.agents);
			}
		});

		socket.on('queue-resp', function (data){
			$scope.Queues = data.queues;
			calculateSummary();
		});

		socket.on('sipconf', function (data){
			$window.sipconf = data; // so the data can be accessed by non-angular javascript under the window element
		});
		socket.on('queueconf', function (data){
			$window.queueconf = data;
		});

		socket.on('agent-request', function (data){
			console.log("Received agent-request help data..." + JSON.stringify(data, null,2,true));

			for (var i=0; i<$scope.Agents.length; i++) {
				if ($scope.Agents[i].agent === data) {
					console.log("Extension needs assistance: " + $scope.Agents[i].agent);
					$scope.Agents[i].help = 'yes';
				}
			}
		});

		var calculateSummary = function () {
			//initialize summary to zero since we are going to sum across all queues
			$scope.summary.callers = 0;
			$scope.summary.completed = 0;
			$scope.summary.abandoned = 0;
			let totalHoldTime = 0
			for (var i=0; i<$scope.Queues.length; i++) {
				$scope.summary.callers += Number($scope.Queues[i].callers);

				$scope.summary.completed += $scope.Queues[i].completed;

				$scope.summary.abandoned += $scope.Queues[i].abandoned;

				totalHoldTime += Number($scope.Queues[i].cumulativeHoldTime)
			}

			if ($scope.summary.completed > 0 && totalHoldTime > 0) {
				$scope.summary.avgholdtime = Number((totalHoldTime / $scope.summary.completed)/60).toFixed(2);
			}
			else {
				$scope.summary.avgholdtime = 0;
			}
		};

		$scope.initData = function () {
			   socket.emit('config', 'agent');
			   socket.emit('config', 'webuser');
			   socket.emit('ami-req', "agent");
			   socket.emit('ami-req', "queue");
		};

		angular.element(document).ready($scope.initData());
	});

function updateAgentStatusPieChart(agents) {
	var temp = agents.reduce(function(p, c){
		var defaultValue = {
		  status: c.status,
		  data: 0
		};
		p[c.status] = p[c.status] || defaultValue;
		p[c.status].data++;

		return p;
	  }, {});

	var agentStatusSummary = [];
	for( var k in temp ){
		agentStatusSummary.push(temp[k]);
	}

	agentStatusSummary.forEach(function(e) {
		e.label = e.status;
		delete e.status;
		//handle color logic for pie charts
		switch(e.label) {
			case 'Logged Out':
				e.color = '#d3d3d3';
				break;
			case 'In Call':
				e.color = '#d9534f';
				break;
			case 'Ready':
				e.color = '#5cb85c';
				break;
			case 'Away':
				e.color = '#f4f470';
				break;
		}
	});

	$.plot("#agentStatusPieChart", agentStatusSummary, {
		series: {
			pie: {
				show: true,
				radius: 1,
				label: {
					show: true,
					radius: 0.6,
					formatter: labelFormatter,
					background: {
						opacity: 0.5
					}
				}
			}
		},
		legend: {
			show: false
		}
	});
}

dbController.directive('highlightOnChange', function() {
	  return {
	    link : function(scope, element, attrs) {
	      var timer;
	      attrs.$observe( 'highlightOnChange', function ( val ) {
	        if (val === 'yes') {
	        	timer = setInterval(function () {
	        		jQuery(element).addClass("agent-assistance");
	            	jQuery(element).fadeOut(500, function() {
	            		jQuery(element).fadeIn(1500);
	                });
	            }, 2000);
	        }
	        else {
	        	if (timer) clearInterval(timer);
	        	jQuery(element).removeClass("agent-assistance");
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
	};
});

dbController.filter('minsectimeformat', function () {
	return function (input) {
		return moment.duration(Number(input), "minutes").format('mm:ss', { trim: false });
	};
});
