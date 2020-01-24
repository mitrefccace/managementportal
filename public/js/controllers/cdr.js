var socket; // = io.connect('http://' + window.location.host); // opens socket.io connection
var toggle = true; // toggle boolean for CDR table

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
                // Emit for CDR Data set to be called on page ready.
                socket.emit('cdrtable-get-data', {
                    "format": "json",
                    "start": start,
                    "end": end
                });
            });

            // Receives the CDR Table data.
            socket.on('cdrtable-data', function (data) {
                if (data.message === "Success") {
                    $('#cdrtable').dataTable().fnClearTable();
                    $('#cdrtable').dataTable().fnAddData(data.data);
                    $('#cdrtable').resize();
                } else {
                    $('#cdrtable').dataTable().fnClearTable();
                    $('#cdrtable').resize();
                }
            });

            // Receives the CDR data in CSV format
            socket.on('cdrtable-csv', function (data) {
                downloadFile(data, 'cdr_info.csv');
            });

            // Handles Error conditions from CDR REST calls.
            socket.on('cdrtable-error', function (data) {
                $('#cdrtable').dataTable().fnClearTable();
                $(".dataTables_empty").css("color", "red").html(data.message);
                $('#cdrtable').resize();
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
var datatable = $('#cdrtable').DataTable({
    "columns": [{
            "data": "calldate",
            "render": function (data, type, full, meta) {
                if (type == "display") {
                    return moment(data).local().format('YYYY/MM/DD hh:mm:ss a');
                }
                return data;
            }
        },
        {
            "data": "clid"
        },
        {
            "data": "src"
        },
        {
            "data": "dst"
        },
        {
            "data": "dcontext"
        },
        {
            "data": "channel"
        },
        {
            "data": "dstchannel"
        },
        {
            "data": "lastapp"
        },
        {
            "data": "lastdata"
        },
        {
            "data": "duration"
        },
        {
            "data": "billsec"
        },
        {
            "data": "disposition"
        },
        {
            "data": "amaflags"
        },
        {
            "data": "accountcode"
        },
        {
            "data": "userfield"
        },
        {
            "data": "uniqueid"
        },
        {
            "data": "linkedid"
        },
        {
            "data": "sequence"
        },
        {
            "data": "peeraccount"
        }
    ],
    "order": [
        [0, "desc"]
    ],
    "language": {
          "emptyTable": "CDR's do not exist."
    }
});

//Toggles the table to display or hide extra columns
function toggleTable() {
    toggle = !toggle;
    if (toggle) {
        $('#toggle').html('<i class="fa fa-toggle-on" style="font-size: 1.75em"></i>');
    } else {
        $('#toggle').html('<i class="fa fa-toggle-off" style="font-size: 1.75em"></i>');
    }
    datatable.column(1).visible(toggle);
    datatable.column(6).visible(toggle);
    datatable.column(11).visible(toggle);
    datatable.column(12).visible(toggle);
    datatable.column(13).visible(toggle);
    datatable.column(14).visible(toggle);
    datatable.column(15).visible(toggle);
    datatable.column(16).visible(toggle);
    datatable.column(17).visible(toggle);
    datatable.column(18).visible(toggle);
}

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
        socket.emit('cdrtable-get-data', {
            "format": "json",
            "start": startdate,
            "end": enddate
        });
    });
}

$(document).ready(function () {
    $("#sidebarcdr").addClass("active");
    toggleTable(); // hide extra columns on initial load

    //click event for the toggle button on the CDR table
    $('#toggle').on('click', function (e) {
        e.preventDefault();
        toggleTable();
    });

    //click event for downloading CSV file
    $('#cdrdownloadbtn').click(function () {
        var picker = $('#reportrange').data('daterangepicker');
        var startdate = moment(picker.startDate.format('YYYY-MM-DD')).format();
        var enddate = moment(picker.endDate.format('YYYY-MM-DD')).add(1, 'days').format();
        socket.emit('cdrtable-get-data', {
            "format": "csv",
            "start": startdate,
            "end": enddate
        });
    });

    DateRangePickerSetup();
});