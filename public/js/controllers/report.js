var socket; // = io.connect('http://' + window.location.host); // opens socket.io connection

		// sets the Date Range picker start and end date
		var start = moment().subtract(6, 'days');
		var end = moment(); //today

		$.ajax({
			url: './token',
			type: 'GET',
			dataType: 'json',
			success: function (data) {
				//alert(JSON.stringify(data));
				if (data.message === "success") {
					socket = io.connect('https://' + window.location.host, {
						path: nginxPath+'/socket.io',
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
							"end": end
						});
					});

					// Receives the Report Table data.
					socket.on('reporttable-data', function (data) {
						if (data.message === "Success") {
							$('#repoorttable').dataTable().fnClearTable();
							$('#repoorttable').dataTable().fnAddData(data.data);
							$('#repoorttable').resize();
						} else {
							$('#repoorttable').dataTable().fnClearTable();
							$('#repoorttable').resize();
						}
					});

					// Receives the report data in CSV format
					socket.on('reporttable-csv', function (data) {
						downloadFile(data, 'report_info.csv');
					});

					// Handles Error conditions from Report REST calls.
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
							return moment(data).local().format('YYYY/MM/DD hh:mm:ss a');
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
					'All Time': [moment("2016-01-01"), end]
				}
			}, cb);

			// sets initial value for report range <div>
			cb(start, end);

			// Click event for new date range selected
			$('#reportrange').on('apply.daterangepicker', function (evt, picker) {
				var startdate = moment(picker.startDate.format('YYYY-MM-DD')).format();
				var enddate = moment(picker.endDate.format('YYYY-MM-DD')).add(1, 'days').format();
				socket.emit('reporttable-get-data', {
					"format": "json",
					"start": startdate,
					"end": enddate
				});
			});
		}

		$(document).ready(function () {
			$("#sidebarreport").addClass("active");

			//click event for downloading CSV file
			$('#reportdownloadbtn').click(function () {
				var picker = $('#reportrange').data('daterangepicker');
				var startdate = moment(picker.startDate.format('YYYY-MM-DD')).format();
				var enddate = moment(picker.endDate.format('YYYY-MM-DD')).add(1, 'days').format();
				socket.emit('reporttable-get-data', {
					"format": "csv",
					"start": startdate,
					"end": enddate
				});
			});

			DateRangePickerSetup();
		});