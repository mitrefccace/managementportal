// This file is executed in the browser, when people visit /chat/<random id>
	var chatarea;
	var chatinput;
	var socket;
	var id;
	var chats;
	var realtimearea;
	var realtimetext = false;
	var newline = true;
	var currentli = null;

	function sendChat (key) {
		if(chatinput.val().length) {
			//createChatMessage(chatinput.val(), name, img, moment());

			// Send the message to the other person in the chat
			socket.emit('msg', {'msg': chatinput.val(), 'key': key});
			if (key === 13) { // enter key
				createChatMessage(chatinput.val(), 'me');
				chatinput.val('');
				//realtimearea.val('');
			}
			else if (key = 32) { // space key
				//realtimearea.val(chatinput.val());
			}
            scrollToBottom();
		}
	}
	// Function that creates a new chat message

	function createChatMessage(msg, user){
		// user is either 'you' or 'me'
		/*
		var li = $(
			'<li class=' + user + '>'+
				'<div class="image">' +
					'<img src=' + imgg + ' />'
					'<b></b>' +
					'<i class="timesent" data-time=' + now + '></i> ' +
				'</div>' +
				'<p></p>' +
			'</li>');
		*/
		var li = $(
				'<li class=' + user + '>'+
					//'<p></p>' +
				'</li>');

		// use the 'text' method to escape malicious user input
		li.text(user + ': ' + msg);

		chats.append(li);
		chats.scrollTop(chats[0].scrollHeight - chats.height());
	}

	function processChatMessage(msg, user){
		currentli = $(
				'<li class=' + user + '>'+
					//'<p></p>' +
				'</li>');
		currentli.text(msg);
		chats.append(currentli);
		scrollToBottom();
	}

	function scrollToBottom(){
		//chatArea.scrollTop = chatArea.scrollHeight;
        chatarea.scrollTop(chatarea[0].scrollHeight - chatarea.height());
	}

	function showMessage(status,data){
		console.log("showMesage: " + status);
	}
	function showProperty(msg, obj) {
		console.log(msg + "========================================");
		if (!obj) return;
		for (var key in obj) {
			//if (obj.hasOwnProperty(key)) {
			//if (typeof obj[key] !== "function") {
				console.log(key + " = " + obj[key]);
			//}
		}
	}


	function socketToken() {
		var token = '';
		$.ajax({
			url: './token',
			type: 'GET',
			dataType: 'json',
			async: false,
			success: function (data) {
				if (data.message === "success") {
					token = data.token;
				}
			}
		});
		return token;
	}

////$(function(){
    $(document).ready(function() {

    chatarea = $("#chat_area");
	chatinput = $("#chat_input");
	chats = $('#chats_ul');
	//realtimearea = $("#txtRealtime");
	// variables which hold the data for each person
	var name = "",
		email = "",
		img = "",
		friend = "";

	$(document).on( "connect-to-chat-server", function(evt,url) {
		console.log("==============================================================connect-to-chat-server event received - url: " + url);

		if (url) {
			//socket = io.connect(url);
			socket = io.connect('http://' + window.location.host, {
				query: 'token=' + socketToken(),
				forceNew: true
			});
		}
		else {
			socket = window.socket_chat;
		}

		$(document).on("disconnect-chat-server", function(evt, room) {
			socket.disconnect();
		});

		$(document).on("terminate-chat-session", function(evt, room) {
			socket.emit("leave", room);
		});

		$(document).on("chat-register", function(evt, room) {
			socket.emit('chat_login', {user: name, avatar: email, id: room});
		});

		$(document).on("chat-unregister", function(evt, room) {
			socket.emit("leave", room);
		});


	socket.on('opentok', function(data) {
		showProperty("Opentok credentials", data.opentok);
		if (data && data.opentok) {
			window.opentok = data.opentok;
			//if (window.isPortalAgent) {
			//	$(document).trigger('opentok_ready', window.opentok);
			//}
		}
	});

	socket.on('leave',function(data){
		if(data.boolean && id==data.room){
			showMessage("Leaving chat room: ", data);
			socket.emit("leave", id);
		}
	});

	socket.on('tooMany', function(data){

		if(data.boolean && name.length === 0) {

			showMessage('tooManyPeople');
		}
	});

	socket.on('receive', function(data){
		console.log("Received message: " + JSON.stringify(data, null, 4, true));
		if (data.msg.key == 13) { // enter key
			newline = true;
		}
		else {
			if (newline) {
				newline = false;
				processChatMessage(data.msg.msg, 'you');
			}
			else {
				currentli.text(data.msg.msg);
			}
		}
		/*
		if(data.msg.msg.length) {
			if (data.msg.key == 13) { // enter key
				createChatMessage(data.msg.msg, 'you');
				realtimearea.val("");
				//chatinput.val("");
			}
			else if (data.msg.key == 32) { // space key
				realtimearea.val(data.msg.msg);
			}
			scrollToBottom();
		}
		*/
	});

	// this to prevent the enter key to submit the form on the user side
	chatinput.keypress(function(e){
		if (e.keyCode == 13)
			return false;
	});

	chatinput.keyup(function(e){
		e.preventDefault();
		// Submit the form on enter. e.which 32 = space, 13 = return
		//if(e.which == 13) {
		//if((realtimetext && e.which == 32) || e.which == 13) {
		//if((realtimetext) {
			//e.preventDefault();
			sendChat(e.which);
		//}
	});

	});
	/*
	$('#btnRealtime').click(function() {
		realtimetext = $('#btnRealtime').is(':checked');

		 //$('#btnRealtime').attr('checked', !realtimetext);
		 //  if($('#btnRealtime').is(':checked')) {
		//	   realtimetext = true;
		//   } else {
		//	   realtimetext = false;
		  // }

		 console.log("realtimetext is: " + realtimetext);
	});
    */
});
