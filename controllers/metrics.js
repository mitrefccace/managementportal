'use strict';
var logger = require('../helpers/logger');

exports.createMetrics = function(db, metricsStartDate, metricsEndDate, callback) {
	var metrics = {};
	logger.debug('CreateMetrics');
	logger.debug('start and end: ' + metricsStartDate + ', ' + metricsEndDate);
	logger.debug('start and end: ' + new Date(metricsStartDate) + ', ' + new Date(metricsEndDate));

	if (db) {
		metrics.showCharts = true;

		// MongoDB query for chart data
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
		.then(function(results) {
			if (results[0]) {
				metrics.averageCallsInQueue = convertTo2DArray(results[0].data, 'timestamp', 'avg_call');

				// Persist target some other way.
				var averageCallsInQueueTarget = 0.5;
				var targetData = createTargetLine(metrics.averageCallsInQueue, averageCallsInQueueTarget);
				metrics.averageCallsInQueueTarget = targetData;
			}
			else {
				//clear chart data
				logger.debug('No metrics query results');
				metrics.averageCallsInQueue = [];
				metrics.averageCallsInQueueTarget = [];
			}

			callback(metrics);
		})
		.catch(function(err) {
			logger.error('Metrics query error: ' + err);
		});
	}
	else {
		metrics.showCharts = false;
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