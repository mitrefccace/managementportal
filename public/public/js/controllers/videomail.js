var socket;
var sortFlag = "id desc";
var filter = "ALL";
var telNumber;

var videomail_status_buttons = document.getElementById("videomail-status-buttons");
var extensionMe;

$(document).ready(function () {
	connect_socket();
	//$("[data-mask]").inputmask();
	//make boxes draggable
	//$('.box').draggable({
	//	cursor: "crosshair"
	//});

	//clearScreen();

	// $.getJSON("./resources/licenses.json", function (data) {
	// 	$.each(data.license, function (i) {
	// 		$("#licModalBody").append("<h3>" + data.license[i].name + "<h3><pre>" + data.license[i].pre + "</pre>");
	// 	});
	// });

	/*if (window.addEventListener) {
		var state = 0,
			theCode = [38, 38, 40, 40, 37, 39, 37, 39, 66, 65];
		window.addEventListener("keydown", function (e) {
			if (e.keyCode === theCode[state]) {
				state++;
			} else {
				state = 0;
			}
			if (state === 10) {
				$("#debugtab").show();
			}
		}, true);
	}*/
});

function connect_socket() {
	//if (sessionStorage.getItem('accesstoken') === null)
	//	logout();
	console.log('connect_socket to ');
	console.log(window.location.host);
	$.ajax({
		url: './token',
		type: 'GET',
		dataType: 'json',
		success: function (data) {
			console.log(JSON.stringify(data));
			if (data.message === "success") {
				socket = io.connect('https://' + window.location.host, {
					path: '/ManagementPortal/socket.io',
					query: 'token=' + data.token,
					forceNew: true
				});

				socket.on('connect', function () {
					debugtxt('connect', {
						"no": "data"
					});
					console.log('authenticated');

					//socket.emit("get_color_config");

					//get the payload form the token
					var payload = jwt_decode(data.token);
					$('#loginModal').modal('hide');

					$('#statusmsg').text(""); //clear status text
					
					socket.emit('register-manager', {
						"hello": "hello"
					});
					socket.emit('get-videomail',{
						"sortBy": "id desc",
						"filter": "ALL"
					});

					setInterval(function(){
						socket.emit('get-videomail',{
						"sortBy": sortFlag,
						"filter": filter
					}); }, 5000);

					toggle_videomail_buttons(false);
					console.log('Sent a get-videomail event');
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
    console.log('vidId: ' + tableData[5] );
    $("#videomailId").attr("name",tableData[5]);
	$("#callbacknum").attr("name",tableData[0]);
    playVideomail(tableData[5], tableData[2], tableData[3]);//vidId, vidDuration vidStatus);
});

//Sorting the videomail table
$('#vmail-vrs-number').on('click',function(){
	var sort = sortButtonToggle($(this).children("i"));
	if (sort == "asc") {
		sortFlag = "callbacknumber asc";
	} else if (sort == "desc") {
		sortFlag = "callbacknumber desc";
	}
	socket.emit('get-videomail',{
		"extension": extensionMe,
		"sortBy": sortFlag,
		"filter": filter
	});
});

$('#vmail-date').on('click',function(){
	var sort = sortButtonToggle($(this).children("i"));
	if (sort == "asc") {
		sortFlag = "unix_timestamp(received) asc";
	} else if (sort == "desc") {
		sortFlag = "unix_timestamp(received) desc";
	}
	socket.emit('get-videomail',{
		"extension": extensionMe,
		"sortBy": sortFlag,
		"filter": filter
	});
});

$('#vmail-duration').on('click',function(){
	var sort = sortButtonToggle($(this).children("i"));
		if (sort == "asc") {
		sortFlag = "video_duration asc";
	} else if (sort == "desc") {
		sortFlag = "video_duration desc";
	}
	socket.emit('get-videomail',{
		"extension": extensionMe,
		"sortBy": sortFlag,
		"filter": filter
	});
});

$('#vmail-status').on('click',function(){
	var sort = sortButtonToggle($(this).children("i"));
	if (sort == "asc") {
		sortFlag = "status asc";
	} else if (sort == "desc") {
		sortFlag = "status desc";
	}
	socket.emit('get-videomail',{
		"extension": extensionMe,
		"sortBy": sortFlag,
		"filter": filter
	});
});

function sortButtonToggle(buttonid){
	if ($(buttonid).attr("class")=='fa fa-sort'){
		$(buttonid).addClass('fa-sort-asc').removeClass('fa-sort');
		return("asc");
	} else if ($(buttonid).attr("class")=='fa fa-sort-desc'){
		$(buttonid).addClass('fa-sort-asc').removeClass('fa-sort-desc');
		return("asc");
	} else if ($(buttonid).attr("class")=='fa fa-sort-asc'){
		$(buttonid).addClass('fa-sort-desc').removeClass('fa-sort-asc');
		return("desc");
	}
}

//Update the records in the videomail table
function updateVideomailTable(data){
	console.log("Refreshing videomail");
	$("#videomailTbody").html("");
	var table;
	var row;
	var numberCell;
	var receivedCell;
	var durationCell;
	var statusCell;
	for(var i=0; i<data.length; i++){
		var vidId = data[i].id;
		var vidNumber = data[i].callbacknumber;
		if (vidNumber) {
			vidNumber = vidNumber.toString();
			if (vidNumber[0] === '1') vidNumber = vidNumber.slice(1,vidNumber.length);
			vidNumber = '('+ vidNumber.substring(0,3) + ') ' + vidNumber.substring(3,6) + '-' + vidNumber.substring(6,vidNumber.length);
		}
		var vidReceived = data[i].received;
		var vidDuration = data[i].video_duration;
		var vidStatus = data[i].status;
		var vidFilepath = data[i].video_filepath;
		var vidFilename = data[i].video_filename;
		table = document.getElementById("videomailTbody");
		row = table.insertRow(table.length);
		numberCell = row.insertCell(0);
		receivedCell = row.insertCell(1);
		durationCell = row.insertCell(2);
		statusCell = row.insertCell(3);
		filepathCell = row.insertCell(4);
		filepathCell.setAttribute('hidden', true);
		idCell = row.insertCell(5);
		idCell.setAttribute('hidden',true);
		filepathCell.innerHTML = vidFilepath + vidFilename;
		idCell.innerHTML = vidId;
		numberCell.innerHTML = vidNumber;
		receivedCell.innerHTML = vidReceived;
		durationCell.innerHTML = vidDuration;

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
		"extension": extensionMe,
		"sortBy": sortFlag,
		"filter": filter
	});
}

function processFilter(filter){
	if (filter == 'ALL'){
		return('');
	} else{
		return('AND status = ' + filter);
	}
}

//More videomail functionality//Play the selected videomail
function playVideomail(id, duration, vidStatus){
	console.log('Playing video mail with id ' + id);
	$('#videoBox').removeAttr('hidden');
	remoteView.removeAttribute("autoplay");
	remoteView.removeAttribute("poster");
	remoteView.setAttribute("src",'./getVideomail?id='+id+'&ext='+extensionMe);
	remoteView.setAttribute("onended", "change_play_button()");
	toggle_videomail_buttons(true);
	updateVideoTime(duration,"vmail-total-time");
	if (vidStatus === "UNREAD"){
		videomail_read_onclick(id);
	}
}

//Update the time progress in the videomail seekbar
function updateVideoTime(time,elementId){
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
		"extension": extensionMe,
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
	// var dt = new Date();
	// var time = dt.getHours() + ":" + dt.getMinutes() + ":" + dt.getSeconds();
	// $('#dbgtxt').html('<span style="color:green">' + time + ": " + title + '</span><br>' + JSON.stringify(data) + '<br>----------------<br>' + $('#dbgtxt').html());
	console.log(title + ' ' + JSON.stringify(data));
}
