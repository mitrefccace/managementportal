'use strict';
var logger = require('../helpers/logger');

exports.createMetrics = function(db, metricsStartDate, metricsEndDate, callback) {
	var metrics = {};
	logger.debug('CreateMetrics');
	logger.debug('start and end: ' + metricsStartDate + ', ' + metricsEndDate);
	logger.debug('start and end: ' + new Date(metricsStartDate) + ', ' + new Date(metricsEndDate));

	// MongoDB query for chart data
	if (db) {
		db.collection('records').aggregate(
			[
				{$match:{timestamp:{$gt:metricsStartDate, $lt:metricsEndDate}}},
				{
					"$project": {
							"date": {
									"$add": [ new Date(0), "$timestamp" ]
							},
							"callers" : "$callers",
							"timestamp": "$timestamp"
					}
				}, {
					$group : {
							"_id" : { 
									year: { $year: "$date" }, 
									month: { $month: "$date" }, 
									day: { $dayOfMonth: "$date" }, 
									hour: { $hour: "$date" }, 
									minutes: {$multiply:[{$floor:{ $divide: [{$minute: "$date"}, 10]}}, 10] }
									},
							"timestamp":{$min: "$timestamp"},
							"avg_call":{"$avg": "$callers" }
						}
				} , {
					$sort:{timestamp: 1}
				} , {
					$group : {
						"_id" : null,
						"data": { $push:  { "avg_call": "$avg_call", "timestamp": "$timestamp" } }
					}
				}
			]
		)
		.toArray()
		.then(function(results){
			if (results[0]) {
				metrics.averageCallsInQueue = convertTo2DArray(results[0].data, 'timestamp', 'avg_call');

				// Persist target some other way.
				var averageCallsInQueueTarget = 0.5;
				var targetData = createTargetLine(metrics.averageCallsInQueue, averageCallsInQueueTarget);
				metrics.averageCallsInQueueTarget = targetData;
			}
			else {
				//clear chart data
				// var newArray = [];
				// io.to('my room').emit('metrics', newArray);
				// does io.to send [] ?
				console.log('No metrics query results');
				metrics.averageCallsInQueue = [];
				metrics.averageCallsInQueueTarget = [];
			}
		})
		.then(function(){
			// Agent Status Pie Chart
			metrics.agentStatus = [
				{ label: "Away",  data: 3},
				{ label: "In Call",  data: 30},
				{ label: "Ready",  data: 5},
				{ label: "Logged Out",  data: 20}
			];

			// Generate real data from Agents array
			// Do it for one queue (user selected?)
			// Agents[i].status  Agents[i].queue
			// Make pie chart colors match busylight status colors?

			// Callback with results of resource status probes  
			callback(metrics);

			//io.to('my room').emit('metrics', metrics);
		})
		.catch(function(err) {
			logger.error('Metrics query error: ' + err);
		});
	}
};

var createTargetLine = function(data, target) {
	var targetData = [];
	var point = [];
	point.push(data[0][0]);
	point.push(target);
	targetData.push(point);
	var point2 = [];
	point2.push(data[data.length - 1][0]);
	point2.push(target);
	targetData.push(point2);
	return targetData;
};

var convertTo2DArray = function(array, firstProperty, secondProperty) {
    var newArray = [];
    for(var i = 0; i < array.length; i++) {
        var point = [];
        point.push(array[i][firstProperty]);
        point.push(array[i][secondProperty]);
        newArray.push(point);
    }
    return newArray;
};