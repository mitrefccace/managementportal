$("#sidebaroperatinghours").addClass("active");
var socket = null;

$('#business_mode_dropdown').select2({
    minimumResultsForSearch: Infinity
});



var updateTime = function () {
    var timeFormat = 'h:mm A';
    $('#current_local').html(moment().format(timeFormat));

    var dst = 0;
    if (moment().isDST())
        dst = 1;

    $('#current_est').html(moment().utcOffset(-5 + dst).format(timeFormat));
    $('#current_cst').html(moment().utcOffset(-6 + dst).format(timeFormat));
    $('#current_mst').html(moment().utcOffset(-7 + dst).format(timeFormat));
    $('#current_pst').html(moment().utcOffset(-8 + dst).format(timeFormat));


};

updateTime();
setInterval(updateTime, 1000);

function updateHoursOfOperation() {
    $('#updateBtn').attr("disabled", "disabled");

    var data = {};
    data.start = formatTimeToUTC($("#start_time").val());
    data.end = formatTimeToUTC($("#end_time").val());
    data.business_mode = $("#business_mode_dropdown").val();
    //alert(JSON.stringify(data) )

    socket.emit('hours-of-operation-update', data);
}


var setOperatingHours = function (data) {
    $("#start_time").wickedpicker({
        now: formatTime(data.start)
    });

    $("#end_time").wickedpicker({
        now: formatTime(data.end)
    });

    $("#business_mode_dropdown").val(data.business_mode).change();
};

var setOperatingStatus = function (isOpen) {
    if (isOpen) {
        $('#opStatus').html('Open').addClass('badge-success').removeClass('badge-danger');
    } else {
        $('#opStatus').html('Closed').addClass('badge-danger').removeClass('badge-success');
    }
};

function formatTime(timeStr) {
    var d = new Date();
    d.setUTCHours(timeStr.split(':')[0]);
    var mins = timeStr.split(':')[1];
    mins = mins.substring(0, 3);
    d.setUTCMinutes(mins);

    return d.getHours() + ':' + (d.getMinutes() < 10 ? '0' : '') + d.getMinutes();
}

function formatTimeToUTC(timeStr) {
    var d = new Date();
    var hours = timeStr.split(':')[0];
    var mins = (timeStr.split(':')[1]).substring(0, 3);
    var ampm = (timeStr.split(':')[1]).slice(-2);
     if ((ampm == 'PM' && parseInt(hours) != 12)||(ampm == 'AM' && parseInt(hours) == 12))
        hours = parseInt(hours) + 12;

    d.setHours(hours);
    d.setMinutes(mins);

    return d.getUTCHours() + ':' + (d.getUTCMinutes() < 10 ? '0' : '') + d.getUTCMinutes();
}

$.ajax({
    url: './token',
    type: 'GET',
    dataType: 'json',
    success: function (data) {
        if (data.message === "success") {
            socket = io.connect('https://' + window.location.host, {
                path: nginxPath+'/socket.io',
                query: 'token=' + data.token,
                forceNew: true
            });
            socket.emit('hours-of-operation');

            //update version,hours in footer
            socket.on('adversion', function (data) {
              $('#ad-version').text(data.version);
              $('#ad-year').text(data.year);
            });

            socket.on("hours-of-operation-response", function (data) {
                setOperatingHours(data);
                setOperatingStatus(data.isOpen);
            }).on("hours-of-operation-update-response", function (data) {
                $('#updateBtn').removeAttr('disabled');
                $('#updateMessage').show();
                $('#updateMessage').fadeOut(2000);
                socket.emit('hours-of-operation');
            });
        }
    },
    error: function (xhr, status, error) {
        console.log('Error');
        $('#message').text('An Error Occured.');
    }
});

$(".timepicker").change(function () {
    let tStart = $("#start_time").val();
    let tEnd = $("#end_time").val();

    if (tStart != "" && tEnd != "") {

        let sTimeUTC = formatTimeToUTC(tStart);
        let eTimeUTC = formatTimeToUTC(tEnd);

        let shour = sTimeUTC.split(':')[0];
        let smin = sTimeUTC.split(':')[1];
        let ehour = eTimeUTC.split(':')[0];
        let emin = eTimeUTC.split(':')[1];

        let openUtc = moment.utc().hour(shour).minutes(smin);
        let closeUtc = moment.utc().hour(ehour).minutes(emin);


        $('#opHrsEST').html(formatTimeRange(getTimezoneAdjustment(openUtc, -5), getTimezoneAdjustment(closeUtc, -5)));
        $('#opHrsCST').html(formatTimeRange(getTimezoneAdjustment(openUtc, -6), getTimezoneAdjustment(closeUtc, -6)));
        $('#opHrsMST').html(formatTimeRange(getTimezoneAdjustment(openUtc, -7), getTimezoneAdjustment(closeUtc, -7)));
        $('#opHrsPST').html(formatTimeRange(getTimezoneAdjustment(openUtc, -8), getTimezoneAdjustment(closeUtc, -8)));

        $('#opHrsESTs').html(formatTimeRange(getTimezoneAdjustment(openUtc, -5), getTimezoneAdjustment(closeUtc, -5)));
        $('#opHrsCSTs').html(formatTimeRange(getTimezoneAdjustment(openUtc, -6), getTimezoneAdjustment(closeUtc, -6)));
        $('#opHrsMSTs').html(formatTimeRange(getTimezoneAdjustment(openUtc, -7), getTimezoneAdjustment(closeUtc, -7)));
        $('#opHrsPSTs').html(formatTimeRange(getTimezoneAdjustment(openUtc, -8), getTimezoneAdjustment(closeUtc, -8)));
    }

});

function getTimezoneAdjustment(time, timezone) {
    return moment(time).utcOffset(timezone).format('h:mm A');
}

function formatTimeRange(start, end) {
    return start + " - " + end;
}
