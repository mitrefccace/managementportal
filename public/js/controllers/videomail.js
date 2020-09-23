'use strict';

var socket;
var sortFlag = "id desc";
var filter = "ALL";
var remoteView = document.getElementById("remoteView");

var videomail_status_buttons = document.getElementById("videomail-status-buttons");
var extensionMe;

$(document).ready(function () {
	connect_socket();
});

function connect_socket() {
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

				socket.on('connect', function () {
					debugtxt('connect', {
						"no": "data"
					});

					//get the payload form the token
					var payload = jwt_decode(data.token);
					$('#loginModal').modal('hide');

					$('#statusmsg').text(""); //clear status text

					socket.emit('register-manager', {
						"hello": "hello"
					});
					socket.emit('get-videomail',{
						"sortBy": sortFlag,
						"filter": "ALL"
					});

					setInterval(function(){
						socket.emit('get-videomail',{
						"sortBy": sortFlag,
						"filter": filter
					}); }, 5000);

					toggle_videomail_buttons(false);
				})
				.on('got-videomail-recs', function(data){
					updateVideomailTable(data);
				})
				.on('changed-status', function(){
					getVideomailRecs();
				})
				.on('videomail-retrieval-error', function(data){
					$('#videomailErrorBody').html('Unable to locate videomail with ID ' + data + '.');
					$('#videomailErrorModal').modal('show');
					stopVideomail();
				})
				.on('videomail-status', function (data) {
					$.plot("#videomailStatusPieChart", data, {
						series: {
							pie: {
								show: true,
								label: {
									show: true,
									formatter: function(label, series){
										return(series.data[0][1]);
									}
								}
							},
							lines: {
								show: true,
								fill: true
							 }
						},
						legend: {
							show: true,
							position: 'ne',
							noColumns: 2,
						}
					});
				});
			} else {
				//TODO: handle bad connections
			}
		},
		error: function (xhr, status, error) {
			console.log('Error');
			$('#message').text('An Error Occured.');
		}
	});
}

//####################################################################
//Videomail functionality: mostly sending socket.io events to adserver

function getVideomailRecs(){
	socket.emit('get-videomail',{
		"extension": extensionMe,
		"sortBy": sortFlag,
		"filter": filter
	});
	console.log('Sent a get-videomail event');
}

//Play selected videomail when a row of the table is clicked
$('#Videomail_Table tbody').on('click', 'tr', function () {
    var tableData = $(this).children("td").map(function() {
        return $(this).text();
    }).get();

    console.log('Click event for playing video');
    console.log('vidId: ' + tableData[6] );
    $("#videomailId").attr("name",tableData[6]);
	$("#callbacknum").attr("name",tableData[0]);
    playVideomail(tableData[6], tableData[2], tableData[3]);//vidId, vidDuration vidStatus);
});

//Sorting the videomail table
$('#vmail-vrs-number').on('click',function(){
	var sort = sortButtonToggle($(this).children("i"));
	if (sort === "asc") {
		sortFlag = "callbacknumber asc";
	} else if (sort === "desc") {
		sortFlag = "callbacknumber desc";
	}
	socket.emit('get-videomail',{
		"sortBy": sortFlag,
		"filter": filter
	});
});

$('#vmail-date').on('click',function(){
	var sort = sortButtonToggle($(this).children("i"));
	if (sort === "asc") {
		sortFlag = "received asc";
	} else if (sort === "desc") {
		sortFlag = "received desc";
	}
	socket.emit('get-videomail',{
		"sortBy": sortFlag,
		"filter": filter
	});
});

$('#vmail-duration').on('click',function(){
	var sort = sortButtonToggle($(this).children("i"));
		if (sort === "asc") {
		sortFlag = "video_duration asc";
	} else if (sort === "desc") {
		sortFlag = "video_duration desc";
	}
	socket.emit('get-videomail',{
		"sortBy": sortFlag,
		"filter": filter
	});
});

$('#vmail-status').on('click',function(){
	var sort = sortButtonToggle($(this).children("i"));
	if (sort === "asc") {
		sortFlag = "status asc";
	} else if (sort === "desc") {
		sortFlag = "status desc";
	}
	socket.emit('get-videomail',{
		"sortBy": sortFlag,
		"filter": filter
	});
});

$('#vmail-agent').on('click', function(){
	var sort = sortButtonToggle($(this).children("i"));
	if (sort === "asc") {
		sortFlag = "processing_agent asc";
	} else if (sort === "desc") {
		sortFlag = "processing_agent desc";
	}
	socket.emit('get-videomail',{
		"sortBy": sortFlag,
		"filter": filter
	});
});

function sortButtonToggle(buttonid){
	if ($(buttonid).attr("class") === 'fa fa-sort'){
		$(buttonid).addClass('fa-sort-up').removeClass('fa-sort');
		return("asc");
	} else if ($(buttonid).attr("class") === 'fa fa-sort-down'){
		$(buttonid).addClass('fa-sort-up').removeClass('fa-sort-down');
		return("asc");
	} else if ($(buttonid).attr("class") === 'fa fa-sort-up'){
		$(buttonid).addClass('fa-sort-down').removeClass('fa-sort-up');
		return("desc");
	}
}

//Update the records in the videomail table
function updateVideomailTable(data){
	$("#videomailTbody").html("");
	var table;
	var row;
	var numberCell;
	var receivedCell;
	var durationCell;
	var statusCell;
	var agentCell;

	for(var i=0; i<data.length; i++){
		var vidId = data[i].id;
		var vidNumber = data[i].callbacknumber;
		if (vidNumber) {
			vidNumber = vidNumber.toString();
			if (vidNumber[0] === '1') vidNumber = vidNumber.slice(1,vidNumber.length);
			vidNumber = '('+ vidNumber.substring(0,3) + ') ' + vidNumber.substring(3,6) + '-' + vidNumber.substring(6,vidNumber.length);
		}
		var vidReceived = moment.utc(data[i].received).local().format('ddd MM/DD/YYYY hh:mm A');
		var vidDuration = data[i].video_duration;
		var vidAgent = data[i].processing_agent;
		var vidStatus = data[i].status;
		var vidFilepath = data[i].video_filepath;
		var vidFilename = data[i].video_filename;
		table = document.getElementById("videomailTbody");

		row = table.insertRow(table.length);
		numberCell = row.insertCell(0);
		receivedCell = row.insertCell(1);
		durationCell = row.insertCell(2);
		agentCell = row.insertCell(3);
		statusCell = row.insertCell(4);
		var filepathCell = row.insertCell(5);
		filepathCell.setAttribute('hidden', true);
		var idCell = row.insertCell(6);
		idCell.setAttribute('hidden',true);

		filepathCell.innerHTML = vidFilepath + vidFilename;
		idCell.innerHTML = vidId;
		numberCell.innerHTML = vidNumber;
		receivedCell.innerHTML = vidReceived;
		durationCell.innerHTML = vidDuration;
		agentCell.innerHTML = vidAgent;

    if (vidStatus === 'UNREAD')
      statusCell.innerHTML = '<span style="font-weight:bold">' + vidStatus+ '</span>';
    else
      statusCell.innerHTML = vidStatus;
	}
}

//Filter videomail by status
function filterVideomail(mailFilter){
	filter = mailFilter;
	socket.emit('get-videomail',{
		"sortBy": sortFlag,
		"filter": filter
	});
}

//More videomail functionality//Play the selected videomail
function playVideomail(id, duration, vidStatus){
	console.log('Playing video mail with id ' + id);
	$('#videoBox').removeAttr('hidden');
	remoteView.removeAttribute("poster");
	remoteView.setAttribute("src",'./getVideomail?id='+id+'&agent='+socket.id);
	remoteView.setAttribute("onended", "change_play_button()");
	if (document.getElementById("play-video-icon").classList.contains("fa-pause")){
		document.getElementById("play-video-icon").classList.add("fa-play");
		document.getElementById("play-video-icon").classList.remove("fa-pause");
	}
	toggle_videomail_buttons(true);
	updateVideoTime(duration,"vmail-total-time");
	if (vidStatus === "UNREAD"){
		videomail_read_onclick(id);
	}
}

//Update the time progress in the videomail seekbar
function updateVideoTime(time, elementId){
  var minutes = Math.floor(time / 60);
	var seconds = Math.round(time - minutes * 60);
	var timeStr = "";
  if (seconds < 10){
	  timeStr = minutes.toString() + ":0" + seconds.toString();
  }
  else if (seconds === 60){
	  timeStr = (minutes+1).toString() + ":00";
  }
  else {
	  timeStr = minutes.toString() + ":" + seconds.toString();
  }
  document.getElementById(elementId).innerHTML = timeStr;
}

//Display the videomail control buttons
function toggle_videomail_buttons(make_visible){
	if(make_visible) videomail_status_buttons.style.display = "block";
	else videomail_status_buttons.style.display = "none";
}

//Exit videomail view and return to call view
function stopVideomail(){
	console.log("Videomail view has been stopped");
	$('#videoBox').attr('hidden',true);
	remoteView.setAttribute("src","");
	remoteView.removeAttribute("src");
	remoteView.removeAttribute("onended");
	remoteView.setAttribute("autoplay", "autoplay");
	remoteView.setAttribute("poster", "images/AD-logo.png");
	toggle_videomail_buttons(false);
}

//Callback for videomail
function videomailCallback(callbacknum){
	stopVideomail();
	var videophoneNumber = callbacknum.match(/\d/g);
	videophoneNumber = videophoneNumber.join('');
	start_call(videophoneNumber);
	$('#duration').timer('reset');
	$('#outboundCallAlert').show();
	$('#user-status').text('In Call');
	changeStatusIcon(in_call_color, "in-call", in_call_blinking);
	changeStatusLight('IN_CALL');
	socket.emit('incall', null);
}

//Socket emit for changing status of a videomail
function videomail_status_change(id, videoStatus){
	socket.emit('videomail-status-change', {
		"id": id,
		"status": videoStatus
	});
	console.log('Emitted a socket videomail-status-change');
}

//Marks the videomail read when the agent clicks it and doesn't close the videomail view
function videomail_read_onclick(id){
	socket.emit('videomail-read-onclick', {
		"id": id,
		"extension": extensionMe
	});
	console.log('Emitted a socket videomail-read-onclick');
}

//Socket emit for deleting a videomail
function videomail_deleted(id){
	socket.emit('videomail-deleted', {
		"id": id,
		"extension": extensionMe
	});
	console.log('Emitted a socket videomail-deleted');
	stopVideomail();
}

//Videomail play button functionality
function play_video(){
	console.log('video paused: ' + remoteView.paused);
  if (remoteView.paused == true) { // play the video
    remoteView.play();
	document.getElementById("play-video-icon").classList.remove("fa-play");
    document.getElementById("play-video-icon").classList.add("fa-pause");
  } else { // pause the video
    remoteView.pause();
	document.getElementById("play-video-icon").classList.add("fa-play");
    document.getElementById("play-video-icon").classList.remove("fa-pause");
  }
}

function change_play_button(){
	console.log("Video ended");
	document.getElementById("play-video-icon").classList.add("fa-play");
    document.getElementById("play-video-icon").classList.remove("fa-pause");
}

//Seekbar functionality
var seekBar = document.getElementById("seek-bar");
// Event listener for the seek bar
seekBar.addEventListener("change", function() {
  // Calculate the new time
  var time = remoteView.duration * (seekBar.value / 100);

  // Update the video time
  remoteView.currentTime = time;
});

// Update the seek bar as the video plays
remoteView.addEventListener("timeupdate", function() {
  // Calculate the slider value
  var value = (100 / remoteView.duration) * remoteView.currentTime;

  // Update the slider value
  seekBar.value = value;

  //update the current time info
  updateVideoTime(remoteView.currentTime, "vmail-current-time");
});

// Event listener for the full-screen button
function enterFullscreen() {
  if (remoteView.requestFullscreen) {
    remoteView.requestFullscreen();
  } else if (remoteView.mozRequestFullScreen) {
    remoteView.mozRequestFullScreen(); // Firefox
  } else if (remoteView.webkitRequestFullscreen) {
    remoteView.webkitRequestFullscreen(); // Chrome and Safari
  }
}

function debugtxt(title, data) {
	console.log(title + ' ' + JSON.stringify(data));
}
