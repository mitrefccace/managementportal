'use strict';
const util = require('util');
var logger = require('../helpers/logger');
let AreaCodes = require('areacodes');
let areaCodes = new AreaCodes();
const areaCodesPromise = util.promisify(areaCodes.get);

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

exports.createReport = function (db, reportStartDate, reportEndDate, timezone, callback) {
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
		// 	"Timestamp" : ISODate("2020-4-25T17:04:47.995Z"),
		// 	"Event" : "Web"
		// }
		//
		// Event is one of type "Handled", "Abandoned", "Videomail", or "Web"

		// MongoDB query for report data
		db.collection('calldata').aggregate(
			[
				{ $match:{"Timestamp":{$gte:new Date(reportStartDate), $lte:new Date(reportEndDate)}}},
				{ $match : { Event : {$exists:true} } },
				// timezone in $dateToString requires mongodb 3.6 or higher
				{ $project: {"day": { $dateToString: { "format": "%Y-%m-%d", "date": "$Timestamp", "timezone": timezone}}, event:"$Event"} },
				{
					$group: {
						_id: { date: "$day", event: "$event" },
						number: { $sum: 1 }
					}
				},
				{ $sort: { _id: -1 } },
				{ $project: { _id: 0, date: "$_id.date", type: { $concat: ["$_id.event", ":", { $substr: ["$number", 0, -1] }] } } }
			]
		)
		.toArray()
		.then(function (results) {
			//console.log("Results " + JSON.stringify(results, null,'\t'));

			var tableData = {};
			var report = {};
			var handled = 0;
			var abandoned = 0;
			var videomails = 0;
			var webcalls = 0;

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
							handled += parseInt(split[1]);
							break;
						case "Abandoned":
							report[date].callsabandoned = split[1];
							abandoned += parseInt(split[1]);
							break;
						case "Videomail":
							report[date].videomails = split[1];
							videomails += parseInt(split[1]);
							break;
						case "Web":
							report[date].webcalls = split[1];
							webcalls += parseInt(split[1]);
							break;
						default:
							break;
					}
				});

				tableData.message = "Success";
				tableData.data = Object.values(report);
				tableData.handled = handled;
				tableData.abandoned = abandoned;
				tableData.videomails = videomails;
				tableData.webcalls = webcalls;
				//console.log(JSON.stringify(Object.values(report), null, '\t'));
			}
			else {
				tableData.message = "";
				tableData.data = {};
				tableData.handled = 0;
				tableData.abandoned = 0;
				tableData.videomails = 0;
				tableData.webcalls = 0;
			}

			callback(tableData);
		})
		.catch(function (err) {
			logger.error('Report query error: ' + err);
		});
	}
};

exports.createVrsReport = function (db, reportStartDate, reportEndDate, timezone, callback) {
	logger.debug('CreateReport');
	logger.debug('start and end: ' + reportStartDate + ', ' + reportEndDate);
	logger.debug('start and end: ' + new Date(reportStartDate) + ', ' + new Date(reportEndDate));

	if (db) {
		// MongoDB query for report data
		db.collection('calldata').aggregate(
			[
				{ $match:{"Timestamp":{$gte:new Date(reportStartDate), $lte:new Date(reportEndDate)}}},
				{ $match : { Event : {$exists:true}, vrs : {$exists:true} } },
				{ $sort: { vrs: 1, Timestamp: -1 } },
				// timezone in $dateToString requires mongodb 3.6 or higher
				{ $project: {_id: 0, "vrs": "$vrs", "date": { $dateToString: { "format": "%Y-%m-%d", "date": "$Timestamp", "timezone": "GMT"}}, status:"$Event"} }
			]
		)
		.toArray()
		.then(function (results) {
			var tableData = {};
			var report = {};

			if (results[0]) {
				// Add state codes from vrs area code.
				forEachPromise(results, logItem)
				.then(() => {
					//console.log(JSON.stringify(results, null, '\t'));

					const reducedStates = results.map(x => x.stateCode).reduce((acc, e) =>acc.set(e, (acc.get(e) ||0) + 1), new Map());
					var topTenStates = new Map([...reducedStates.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10));
					console.log([...topTenStates.entries()]);

					const reducedAreaCodes = results.map(x => x.vrs.substring(1, 4)).reduce((acc, e) =>acc.set(e, (acc.get(e) ||0) + 1), new Map());
					var topTenAreaCodes = new Map([...reducedAreaCodes.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10));
					console.log([...topTenAreaCodes.entries()]);

					const reducedVrsNumbers = results.map(x => x.vrs).reduce((acc, e) =>acc.set(e, (acc.get(e) ||0) + 1), new Map());
					var topTenVrsNumbers = new Map([...reducedVrsNumbers.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10));
					console.log([...topTenVrsNumbers.entries()]);

					tableData.message = "Success";
					tableData.data = Object.values(results);
					tableData.topTenStates = Array.from(topTenStates);
					tableData.topTenAreaCodes = Array.from(topTenAreaCodes);
					tableData.topTenVrsNumbers = Array.from(topTenVrsNumbers);

				 	callback(tableData);
				});
			}
			else {
				tableData.message = "";
				tableData.data = {};
				tableData.topTenStates = {};
				tableData.topTenAreaCodes = {};
				tableData.topTenVrsNumbers = {};
				callback(tableData);
			}
		})
		.catch(function (err) {
			logger.error('Report query error: ' + err);
		});
	}
};

/**
  * @param items An array of items.
  * @param fn A function that accepts an item from the array and returns a promise.
  * @returns {Promise}
  */
 function forEachPromise(items, fn) {
	return items.reduce(function (promise, item) {
		return promise.then(function () {
			return fn(item);
		});
	}, Promise.resolve());
}

function logItem(item) {
	return new Promise((resolve, reject) => {
		process.nextTick(() => {
			areaCodesPromise(item.vrs)
			.then(data => {
				item.stateCode = data.stateCode;
				resolve();
			})
			.catch(err => {
				item.stateCode = '';
				resolve();
			});
		});
	});
}

// Get number of records of each event type. Change
// {
// 	"status": "Web",
// 	"number":"3119.0"
// },
// 	"status": "Abandoned",
// 	"number":"539.0"
// },

// db.getCollection('calldata').aggregate(
// 	[
// 			//{ $match:{"Timestamp":{$gte:new Date(reportStartDate), $lte:new Date(reportEndDate)}}},
// 			{ $match : { Event : {$exists:true} } },
// 			{
// 					$group: {
// 							_id: "$Event" ,
// 							number: { $sum: 1 }
// 					}
// 			},
// 			{ $project: { _id: 0, status: "$_id", number: "$number" } }
// 	]
// )
