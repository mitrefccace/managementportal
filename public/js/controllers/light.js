var socket;

           /**
            * adds a message below the submit button
           */
            function addMessage()
            {
              document.getElementById("message").innerHTML= 'Click "Save" to submit your changes';
            }

           /**
            * reders the data in default_color_config.json on the screen. NOTE: does not save the data, user still has to hit "save"
           */
           function reset_color_config()
           {
              socket.emit("reset-color-config");
           }
            /**
             * disables color from all other statuses' selection lists and reenables old_color. does not disable currently selected color from its correlating status
             * @param {color} is the current color value to disable
             * @param {old_color} the previous color value that needs to be enabled
             * @param {status_name} the name of the status that called this function
            */
            function disable_colors(color, old_color, status_name)
            {
                var options = document.getElementsByTagName("option");
                for (option in options)
                {
                    if(color != "off")  //can select "off" for mutliple statuses
                    {
                       option_status_id = "option_" + status_name;  //to compare option id with status name, so we don't disable an option that is currently selected
                        if (options[option].value == color && options[option].id != option_status_id)
                        {
                            options[option].disabled = true;
                            options[option].style.color="#cecece";
                        }
                    }
                    if (options[option].value == old_color)
                    {
                        options[option].disabled = false;
                        options[option].style.color="#333";
                    }
                }
                $('.selectpicker').selectpicker('refresh');
            }

           /**
             * emits a submit message with the form data to the server
            */
            function submit_form()
            {
                document.getElementById("message").innerHTML= "";
                var inputs = $("#form_input :input").not(':button'); //all input fields (not button because bootstrap-select makes them into buttons)
                var parsed_inputs = new Array(); //only the values of the statuses
                inputs.each(function() {
                    parsed_inputs.push(this.value);
                });

                socket.emit("submit", parsed_inputs);
            }

            /**
             * returns string with first letter capitalized
             * @param {string} the string to capitalize
             * @return the new string
            */
            function capitalize_first_letter(string)
            {
                return string.charAt(0).toUpperCase() + string.slice(1);
            }

            /**
             * calculates and returns the html id of the selected color/action in the json file
             * @param {json_data} a json object of the color_config.json file
             * @param {status} the status index to get the correct status info in the json file
             * @return the selected color id in the form "green_solid" or "red_blinking"
            */
            function get_selected_option_id(json_data,status)
            {
                var color = json_data.statuses[status].color;
                var blinking = (json_data.statuses[status].blink) ? "_blinking" : "_solid";
                var selected_option = color + blinking;
                if (color == "off") selected_option = "off"; //to avoid "off_solid" and "off_blinking"
                return selected_option;
            }

            /**
             *reads the data from the json file and creates the html form with the correct statuses and colors
             *@param {json_data} a json object of the color_config.json file
            */
            function append_html(json_data)
            {
                for (var status in json_data.statuses)
                {
                    var status_id = json_data.statuses[status].id;
                    var status_name = capitalize_first_letter(json_data.statuses[status].name);

                    //append <label> and <select>
                    //  <select> has unique id (id from json_data)
                    $("#form_table").append(
                        '<tr>' +
                            '<th style=" font-weight: normal; min-width:140px;">'+
                                '<p style = "margin-right: 10px; margin-top: 10px;" for="' + status_id + '">' + status_name + ':</p>' +
                            '</th>'+
                            '<th style=" font-weight: normal; min-width:215px; width: 100%; max-width: 50%;">'+
                                '<select class="form-control selectpicker" aria-hidden="true" id="' + status_id+ '" name ="'+status_id+'" onfocus = "this.old_value" onchange = "disable_colors(this.value,this.old_value,this.id);this.old_value=this.value; addMessage();">');

                    //append <option>
                    //  "<option> value" is the color and action concatinated, "green_blinking" for example
                    //  "<option> id" is the word option concatinated with the status id, "option_away" for example
                    //  the div class name in "data-content" is for the circle icon, "green-blinking" or "green-solid"
                    for (var color in json_data.colors)
                    {
                        for(var action in json_data.actions)
                        {
                            var circle_icon_class = json_data.colors[color].toLowerCase() + "-" + json_data.actions[action].toLowerCase();
                            var name_shown = capitalize_first_letter(json_data.colors[color])+' - '+ json_data.actions[action];
                            var value = json_data.colors[color].toLowerCase() + "_" + json_data.actions[action].toLowerCase();
                            if(json_data.colors[color] == "off") //don't want off-solid and off-blinking, so we break out of the loop
                            {
                                $("#" + status_id).append(
                                    '<option data-content="<span class=\'circle gray\'></span><div style=\'font-size:20px;\'> Off </div>" value = "off" id = "option_'+status_id+'"> </option>');
                                break;
                            }
                            else
                            {
                                $("#" + status_id).append(
                                    '<option data-content="<span class=\'circle ' +circle_icon_class +'\'></span><div style=\'font-size:20px;\'>'+name_shown+'</div>" value = "'+ value+'" id = "option_'+status_id+'"> </option>');
                            }
                        }
                    }
                     //finish appending html
                     $("#form_table").append(
                                '</select">' +
                            '</th>'+
                        '</tr>');
                }
                $('.selectpicker').selectpicker('refresh');
            }

            /**
             *sets up the html document dynamically based on the json data received
             *@param {data}  the unparsed color_config.json file
            */
            function setup_html(data)
            {
              var json_data = JSON.parse(data);
              append_html(json_data);
              for(status in json_data.statuses)
              {
                  //set currently selected color
                  var selected_option = get_selected_option_id(json_data, status);
                  document.getElementById(json_data.statuses[status].id).value = selected_option;
                  document.getElementById(json_data.statuses[status].id).old_value = selected_option;

                  //disable selected color from other menues
                  disable_colors(selected_option,"",json_data.statuses[status].id);
              }
              $('.selectpicker').selectpicker('refresh');
            }

			$(document).ready(function () {
				$("#sidebarlight").addClass("active");


                $.ajax({
                    url: './token',
                    type: 'GET',
                    dataType: 'json',
                    success: function (data)
                    {
                        if (data.message === "success")
                        {
                            socket = io.connect('https://' + window.location.host, {
                                path: nginxPath+'/socket.io',
                                query: 'token=' + data.token,
                                forceNew: true
                            });
                            socket.emit("get_color_config");

                            //sets up the html page dynmically via the json file received
                            socket.on("html_setup", function(data) {
                                setup_html(data);
                             });

                            //update version in footer
                            socket.on('adversion', function (data) {
                              $('#ad-version').text(data.version);
                              $('#ad-year').text(data.year);
                            });

                            //updates the colors shown on the page (does not resave them, just changes the display)
                            socket.on("update-colors", function(data){
                                document.getElementById("form_table").innerHTML="";
                                $("#form_table").append(
                                    '<tr style="height:20px;">' +
                                        '<th style = "text-decoration: underline; padding-bottom: 5px;"> Status </th>' +
                                        '<th style = "text-decoration: underline; padding-bottom: 5px;"> Color </th>' +
                                      '</tr>)'
                                );
                                addMessage();
                                setup_html(data);
                            });
                        }
                    },
                    error: function (xhr, status, error)
                    {
                        console.log('Error');
                        $('#message').text('An Error Occured.');
                    }
                });
			});
