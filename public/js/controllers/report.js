var socket; // = io.connect('http://' + window.location.host); // opens socket.io connection

// sets the Date Range picker start and end date
// Summary report is shown for start and end based on local time start and end of day.
var start = moment().startOf('day').subtract(6, 'days');
var end = moment().endOf('day'); //today
var timezone = getTimeZoneOffset();

$.ajax({
	url: './token',
	type: 'GET',
	dataType: 'json',
	success: function (data) {
		if (data.message === "success") {
			socket = io.connect('https://' + window.location.host, {
				path: nginxPath + '/socket.io',
				query: 'token=' + data.token,
				forceNew: true
			});

			//update the version and year in the footer
			socket.on('adversion', function (data) {
				$('#ad-version').text(data.version);
				$('#ad-year').text(data.year);
			});

			socket.on('connect', function () {
				// Emit for Report Data set to be called on page ready.
				socket.emit('reporttable-get-data', {
					"format": "json",
					"start": start,
					"end": end,
					"timezone": timezone
				});
				socket.emit('vrsreporttable-get-data', {
					"format": "json",
					"start": start,
					"end": end,
					"timezone": timezone
				});
			});

			// Receives the Report Table data.
			socket.on('reporttable-data', function (data) {
				if (data.message === "Success") {
					$('#handled').text(data.handled);
					$('#abandoned').text(data.abandoned);
					$('#videomails').text(data.videomails);
					$('#webcalls').text(data.webcalls);

					$('#reporttable').dataTable().fnClearTable();
					$('#reporttable').dataTable().fnAddData(data.data);
					$('#reporttable').resize();
				} else {
					$('#reporttable').dataTable().fnClearTable();
					$('#reporttable').resize();
				}

				updateCallStatusLineChart(data);
			});

			// Receives the Report Table data.
			socket.on('vrsreporttable-data', function (data) {
				if (data.message === "Success") {

					var content = '<table style="width:100%"">';
					for(i=0; i < data.topTenStates.length; i++){
						content += '<tr><td>' + data.topTenStates[i][0] + '</td><td>' + data.topTenStates[i][1] +'</td></tr>';
					}
					content += "</table>";
					$('#topTenStates').empty().append(content);

					content = '<table style="width:100%"">';
					for(i=0; i < data.topTenStates.length; i++){
						content += '<tr><td>' + data.topTenAreaCodes[i][0] + '</td><td>' + data.topTenAreaCodes[i][1] +'</td></tr>';
					}
					content += "</table>";
					$('#topTenAreaCodes').empty().append(content);

					content = '<table style="width:100%"">';
					for(i=0; i < data.topTenStates.length; i++){
						content += '<tr><td>' + data.topTenVrsNumbers[i][0] + '</td><td>' + data.topTenVrsNumbers[i][1] +'</td></tr>';
					}
					content += "</table>";
					$('#topTenVrsNumbers').empty().append(content);

					$('#vrsreporttable').dataTable().fnClearTable();
					$('#vrsreporttable').dataTable().fnAddData(data.data);
					$('#vrsreporttable').resize();
				} else {
					$('#topTenStates').empty().append("Data does not exist");
					$('#topTenAreaCodes').empty().append("Data does not exist");
					$('#topTenVrsNumbers').empty().append("Data does not exist");

					$('#vrsreporttable').dataTable().fnClearTable();
					$('#vrsreporttable').resize();
				}
			});

			// Receives the report data in CSV format
			socket.on('reporttable-csv', function (data) {
				downloadFile(data, 'report_info.csv');
			});

			// Receives the vrs report data in CSV format
			socket.on('vrsreporttable-csv', function (data) {
				downloadFile(data, 'vrs_report_info.csv');
			});

			// Handles Error conditions from Report calls.
			socket.on('reporttable-error', function (data) {
				$('#reporttable').dataTable().fnClearTable();
				$(".dataTables_empty").css("color", "red").html(data.message);
				$('#reporttable').resize();
			});

		} else {
			$('#message').text(data.message);
		}
	},
	error: function (xhr, status, error) {
		console.log('Error');
		$('#message').text('An Error Occured.');
	}
});

function updateCallStatusLineChart(data) {
	$(function() {

		// Enhancement - put in check for too much data to chart
		var handled = [], abandoned = [], videomail = [], webcall = [];
		for (var i = 0; i < data.data.length; i+= 1) {
			var date = new Date(data.data[i].date);
			handled.push([date, data.data[i].callshandled]);
			abandoned.push([date, data.data[i].callsabandoned]);
			videomail.push([date, data.data[i].videomails]);
			webcall.push([date, data.data[i].webcalls]);
		}

		var legendContainer = document.getElementById("legendContainer");
        var legendSettings = {
				position: "nw",
                show: true,
                noColumns: 2,
				container: legendContainer
		};

		var chartdata = [
			{color: "forestgreen", lines: {show: true, lineWidth: 3}, data: handled, label: "Calls Handled"},
			{color: "red", lines: {show: true, lineWidth: 3}, data: abandoned, label: "Calls Abandoned"},
			{color: "blue", lines: {show: true, lineWidth: 3}, data: videomail, label: "Videomail"},
			{color: "black", lines: {show: true, lineWidth: 3}, data: webcall, label: "Webcalls"},
        ];

		$.plot("#callSummaryLineChart", chartdata,
			{
				legend: legendSettings,
				xaxis: { mode: "time", timeBase: "milliseconds"}
			}
		);
	});
}

function getTimeZoneOffset() {
	var mins = moment().utcOffset();
    var h = Math.abs(mins) / 60 | 0,
		m = Math.abs(mins) % 60 | 0;

	var offset = "00:00";
	if (mins != 0) {
		offset = moment.utc().hours(h).minutes(m).format("hh:mm");
	}
    return (mins < 0 ? '-' + offset : '+' + offset);
}

function downloadFile(data, fileName) {
	var csvData = data;
	var blob = new Blob([csvData], {
		type: "application/csv;charset=utf-8;"
	});

	if (window.navigator.msSaveBlob) {
		// FOR IE BROWSER
		navigator.msSaveBlob(blob, fileName);
	} else {
		// FOR OTHER BROWSERS
		var link = document.createElement("a");
		var csvUrl = URL.createObjectURL(blob);
		link.href = csvUrl;
		link.style = "visibility:hidden";
		link.download = fileName;
		document.body.appendChild(link);
		link.click();
		document.body.removeChild(link);
	}
}

// initialize the datatable
var datatable = $('#reporttable').DataTable({
	"columns": [{
			"data": "date",
			"render": function (data, type, full, meta) {
				if (type == "display") {
					return moment(data).local().format('YYYY/MM/DD');
				}
				return data;
			}
		},
		{
			"data": "callshandled"
		},
		{
			"data": "callsabandoned"
		},
		{
			"data": "videomails"
		},
		{
			"data": "webcalls"
		}
	],
	"order": [
		[0, "desc"]
	],
	"language": {
		"emptyTable": "Data does not exist."
	}
});

var vrsdatatable = $('#vrsreporttable').DataTable({
	"columns": [{
		"data": "vrs"
		},
		{
			"data": "date",
			"render": function (data, type, full, meta) {
				if (type == "display") {
					return moment(data).local().format('YYYY/MM/DD');
				}
				return data;
			}
		},
		{
			"data": "status"
		},
		{
			"data": "stateCode"
		},
	],
	// "order": [
	// 	[0, "desc"]
	// ],
	"language": {
		"emptyTable": "Data does not exist."
	}
});

function DateRangePickerSetup() {
	// Call back funtion for setting report range <div> value
	function cb(start, end) {
		$('#reportrange span:first').html(start.format('MMMM D, YYYY') + ' - ' + end.format('MMMM D, YYYY'));
	}

	// controls for the date range picker
	$('#reportrange').daterangepicker({
		startDate: start,
		endDate: end,
		ranges: {
			'Today': [moment(), moment()],
			'Yesterday': [moment().subtract(1, 'days'), moment().subtract(1, 'days')],
			'Last 7 Days': [moment().subtract(6, 'days'), moment()],
			'Last 30 Days': [moment().subtract(29, 'days'), moment()],
			'This Month': [moment().startOf('month'), moment().endOf('month')],
			'Last Month': [moment().subtract(1, 'month').startOf('month'), moment().subtract(1, 'month').endOf('month')],
			'All Time': [moment("2020-03-01"), end] // This is a new management portal feature starting March 2020. No data before then.
		}
	}, cb);

	// sets initial value for report range <div>
	cb(start, end);

	// Click event for new date range selected
	// Summary report is shown for start and end based on local time start and end of day.
	$('#reportrange').on('apply.daterangepicker', function (evt, picker) {
		var startdate = moment(picker.startDate.format('YYYY-MM-DD')).format();
		var enddate = moment(picker.endDate.format('YYYY-MM-DD')).endOf('day').format();
		socket.emit('reporttable-get-data', {
			"format": "json",
			"start": startdate,
			"end": enddate,
			"timezone": timezone
		});
		socket.emit('vrsreporttable-get-data', {
			"format": "json",
			"start": startdate,
			"end": enddate,
			"timezone": timezone
		});
	});
}

$(document).ready(function () {
	$("#sidebarreport").addClass("active");

	//click event for downloading CSV file
	// Summary report is for start and end based on local time start and end of day.
	$('#reportdownloadbtn').click(function () {
		var picker = $('#reportrange').data('daterangepicker');
		var startdate = moment(picker.startDate.format('YYYY-MM-DD')).format();
		var enddate = moment(picker.endDate.format('YYYY-MM-DD')).endOf('day').format();
		socket.emit('reporttable-get-data', {
			"format": "csv",
			"start": startdate,
			"end": enddate,
			"timezone": timezone
		});
	});
	$('#vrsreportdownloadbtn').click(function () {
		var picker = $('#reportrange').data('daterangepicker');
		var startdate = moment(picker.startDate.format('YYYY-MM-DD')).format();
		var enddate = moment(picker.endDate.format('YYYY-MM-DD')).endOf('day').format();
		socket.emit('vrsreporttable-get-data', {
			"format": "csv",
			"start": startdate,
			"end": enddate,
			"timezone": timezone
		});
	});

	DateRangePickerSetup();
});
