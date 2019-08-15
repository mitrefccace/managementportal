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

			// Send the message to the other person in the chat
			socket.emit('msg', {'msg': chatinput.val(), 'key': key});
			if (key === 13) { // enter key
				createChatMessage(chatinput.val(), 'me');
				chatinput.val('');
			}
			else if (key == 32) { // space key

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
        chatarea.scrollTop(chatarea[0].scrollHeight - chatarea.height());
	}

	function showMessage(status,data){
		console.log("showMesage: " + status);
	}
	function showProperty(msg, obj) {
		console.log(msg + "========================================");
		if (!obj) return;
		for (var key in obj) {
			console.log(key + " = " + obj[key]);
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

    $(document).ready(function() {

    chatarea = $("#chat_area");
	chatinput = $("#chat_input");
	chats = $('#chats_ul');
	// variables which hold the data for each person
	var name = "",
		email = "";

	$(document).on( "connect-to-chat-server", function(evt,url) {
		console.log("==============================================================connect-to-chat-server event received - url: " + url);

		if (url) {
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
	});

	// this to prevent the enter key to submit the form on the user side
	chatinput.keypress(function(e){
		if (e.keyCode == 13){
			return false;
		}
	});

	chatinput.keyup(function(e){
		e.preventDefault();
		// Submit the form on enter. e.which 32 = space, 13 = return
		sendChat(e.which);
	});

	});
});
