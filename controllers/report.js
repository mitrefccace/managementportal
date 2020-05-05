'use strict';
var logger = require('../helpers/logger');

var getDaysArray = function(start, end) {
    for(var arr=[],dt=new Date(start); dt<=end; dt.setDate(dt.getDate()+1)){
        arr.push(new Date(dt));
    }
    return arr;
};

function formatDate(date) {
	var d = new Date(date),
	month = '' + (d.getMonth() +1),
	day = '' + d.getDate(),
	year = d.getFullYear();

	if (month.length < 2) month = '0' + month;
	if (day.length <2) day = '0' + day;

	return [year, month, day].join('-');
}

exports.createReport = function (db, reportStartDate, reportEndDate, callback) {
	logger.debug('CreateReport');
	logger.debug('start and end: ' + reportStartDate + ', ' + reportEndDate);
	logger.debug('start and end: ' + new Date(reportStartDate) + ', ' + new Date(reportEndDate));

	// console.log('CreateReport');
	// console.log('start and end: ' + reportStartDate + ', ' + reportEndDate);
	// console.log('start and end: ' + new Date(reportStartDate) + ', ' + new Date(reportEndDate));

	if (db) {
		// A record from ACE Direct in mongodb.
		//
		// {
		// 	"Timestamp" : "2020-4-25T17:04:47.995Z",
		// 	"Event" : "Web"
		// }
		//
		// Event is one of type "Handled", "Abandoned", "Videomail", or "Web"

		// MongoDB query for report data
		db.collection('calldata').aggregate(
			[
				//{ $match:{"$Timestamp":{$gt:reportStartDate, $lt:reportEndDate}}},
				{ $match : { Event : {$exists:true} } },
				{ $project: { day: { $substr: ["$Timestamp", 0, 9] }, event: "$Event" } },
				{
					$group: {
						_id: { date: "$day", event: "$event" },
						number: { $sum: 1 }
					}
				},
				{ $sort: { _id: -1 } },
				{ $project: { _id: 0, date: "$_id.date", type: { $concat: ["$_id.event", ":", { $substr: ["$number", 0, -1] }] } } }
				// Operator $toString is in mongodb 4.x. Use $substr with mongodb 3.x
				//{   $project : {_id: 0, date: "$_id.date", type: {$concat: [ "$_id.event", ":", {$toString: "$number"}] } } }
			]
		)
		.toArray()
		.then(function (results) {
			//console.log(JSON.stringify(results, null,'\t'));

			var tableData = {};
			var report = {};

			if (results[0]) {
				// Create an array of dates between report start and end.
				var daylist = getDaysArray(new Date(reportStartDate),new Date(reportEndDate));
				var dates = daylist.map((v)=>v.toISOString().slice(0,10));

				// Create a report with zeros for all days and types in the date range.
				// MongoDB query only returns data for days and event types with activity.
				dates.forEach(function (item) {
					report[item] = { date: item, callshandled: 0, callsabandoned: 0, videomails: 0, webcalls: 0 };
				});

				// Add the actual counts from mongo data. Also reformat it in this step.
				results.forEach(function (item) {
					var split = item.type.split(":");
					var date = formatDate(new Date(item.date));

					switch (split[0]) {
						case "Handled":
							report[date].callshandled = split[1];
							break;
						case "Abandoned":
							report[date].callsabandoned = split[1];
							break;
						case "Videomail":
							report[date].videomails = split[1];
							break;
						case "Web":
							report[date].webcalls = split[1];
							break;
						default:
							break;
					}
				});

				tableData.message = "Success";
				tableData.data = Object.values(report);
				//console.log(JSON.stringify(Object.values(report), null, '\t'));
			}
			else {
				tableData.message = "";
				tableData.data = {};
			}

			callback(tableData);
		})
		.catch(function (err) {
			logger.error('Report query error: ' + err);
		});
	}
};
