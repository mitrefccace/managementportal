var selectedUser = 0;
$(document).ready(function () {
    $("#sidebaragentmanagement").addClass("active");
    $('#admin_treeview').addClass('active');
    $('#admin_users_treeview').addClass('active');

    var table = $('#usertable').DataTable({
        "order": [],
        "columnDefs": [{
            "targets": [0],
            "visible": false,
            "searchable": false
        }, {
            "targets": [4],
            "render": function (data, type, row) {
                if (data.length == 0) {
                    return "Never";
                } else {
                    return data;
                }
            }
        }, {
            "targets": [5],
            "data": "selected",
            "orderable": false,
            "render": function (data, type, row) {
                if (type === 'display') {
                    return '<input type="checkbox" class="editor-active">';
                }
                return data;
            },
            className: "dt-body-center"
        }],
        select: {
            style: 'os',
            selector: 'td:not(:last-child)'
        },
        // "tableTools": {
        //"sRowSelect": "os",
        //"sRowSelector": 'td:not(:last-child)' // no row selection on last column
        //}
        //"select": {
        //"style": 'os',
        //"sRowSelector": 'td:not(:last-child)'
        //},
        "rowCallback": function (row, data) {
            $('input.editor-active', row).prop('checked', data.selected == 1);
            console.log("selected row: " + (data.selected == 1));
        }

    });

    $('#usertable tbody').on('change', 'input.editor-active', function () {
        var data = table.row($(this).parents('tr')).data();
        console.log("checkbox clicked with data: " + JSON.stringify(data));

        data.selected = $(this).prop('checked') ? 1 : 0;
        console.log("checkbox data: " + data.selected);
    });

    $('#usertable tbody').on('click', 'td', function () {

        var data = table.row($(this).parents('tr')).data();
        var col = table.cell(this).index().column;

        console.log("cell clicked with col: " + col + " data: " + JSON.stringify(data));

        if (col != 5) {			// do not load agent info if the clicked cell is the checkbox
            var url = "./GetAgent/" + data[3];
            console.log("GetAgent url: " + url);
            selectedUser = data[0];
            $.get("./GetAgent", {
                "username": data[3]
            },
                function (result, status) {
                    console.log("GetAgent returned: " + JSON.stringify(result));
                    $('#inputUsername').val(result.username);
                    $('#inputFirstname').val(result.first_name);
                    $('#inputLastname').val(result.last_name);
                    $('#inputEmail').val(result.email);
                    $('#inputPhone').val(result.phone);
                    $('#inputOrganization').val(result.organization);
                    $('#inputExtension').val(result.extension);
                    if (result.queue_name != null) {
                        $('#inputComplaintsQueue').prop("checked", true);
                    }
                    if (result.queue2_name != null) {
                        $('#inputGeneralQueue').prop("checked", true);
                    }
                    console.log('complaintsQueue value is: ' + $('#inputComplaintsQueue').val());
                    console.log('generalQueue value is: ' + $('#inputGeneralQueue').val());
                });

            $('#inputUsername').prop('disabled', true);
            $('#inputPassword').prop('disabled', true);
            $('#confirmPassword').hide();

            $('#btnUpdateAgent').show();
            $(".glyphicon-eye-open").css("display", "none"); //HERE
            $('#btnDeleteAgent').show();
            $('#btnAddAgent').hide();
            $('#configModal').modal();
        }
    })

    $("#btnAddAgent").click(function (event) {
        event.preventDefault();
        /* check if both password inputs match */
        var pass = $('#inputPassword').val();
        var pass2 = $('#inputPassword2').val();
        if (pass != pass2) {
            alert("Re-entered password does not match!");
            return;
        };

        $.post("./AddAgent", {
            "username": $('#inputUsername').val(),
            "password": $('#inputPassword').val(),
            "first_name": $('#inputFirstname').val(),
            "last_name": $('#inputLastname').val(),
            "email": $('#inputEmail').val(),
            "phone": $('#inputPhone').val(),
            "organization": $('#inputOrganization').val(),
            "extension": $('#inputExtension').val(),
            "queue_id": ($('#inputComplaintsQueue').prop('checked')) ? ($('#inputComplaintsQueue').val()) : 0,
            "queue2_id": ($('#inputGeneralQueue').prop('checked')) ? ($('#inputGeneralQueue').val()) : 0,
        },
            function (data, status) {
                if (data.result == "success") {
                    console.log("Saved!!!!")
                    location.reload();
                }
                else {
                    console.log("POST failed: " + JSON.stringify(data));
                    alert(data.message);
                }
            });

    });

    $("#btnDeleteAgent").click(function (event) {
        event.preventDefault();
        console.log("AgentId selected to delete: " + selectedUser);
        $('#confirm-delete').modal();
    });

    $("#btnUpdateAgent").click(function (event) {
        event.preventDefault();

        $.post("./UpdateAgent", {
            "agent_id": selectedUser,
            "username": $('#inputUsername').val(),
            "first_name": $('#inputFirstname').val(),
            "last_name": $('#inputLastname').val(),
            "email": $('#inputEmail').val(),
            "phone": $('#inputPhone').val(),
            "organization": $('#inputOrganization').val(),
            "extension": $('#inputExtension').val(),
            "queue_id": ($('#inputComplaintsQueue').prop('checked')) ? ($('#inputComplaintsQueue').val()) : 0,
            "queue2_id": ($('#inputGeneralQueue').prop('checked')) ? ($('#inputGeneralQueue').val()) : 0,
        },
            function (data, status) {
                if (data.result == "success") {
                    console.log("POST succ: " + JSON.stringify(data));
                    location.reload();
                }
                else {
                    console.log("POST failed: " + JSON.stringify(data));
                    alert(data.message);
                }
            });
    });

    $("#delete_user_btn").click(function (event) {
        getBulkDeleteAgentList();
        $('#confirm-bulk-delete').modal();
    });

    $("#bulk_delete_btn").click(function (event) {
        event.preventDefault();

        var data = table.rows().data();
        data.each(function (value, index) {
            if (value.selected === 1) {
                // console.log("Bulk delete: checked at index: ", index)
                // console.log("agent id checked is: " + value[0] + " agent username is: " + value[3]);

                // Issue delete at backend
                $.post("./DeleteAgent", {
                    "id": value[0],
                    "username": value[3]
                },
                    function (data, status) {
                        if (data.result != "success") {
                            console.log("DeleteAgent " + value[3] + " failed: " + JSON.stringify(data));
                            alert(data.message);
                        }
                    });
            }
        })

        location.reload();
    })


    function getBulkDeleteAgentList() {

        console.log("getBulkDeleteAgentList() invoked");

        var agentNames = "";
        var data = table.rows().data();
        data.each(function (value, index) {
            if (value.selected === 1) {
                // console.log("Bulk delete: checked at index: ", index)
                // console.log("agent id checked is: " + value[0] + " agent username is: " + value[3]);
                agentNames += "  " + value[3];
            }
        })

        // present dynamically generated agentlist
        document.getElementById("agentlist").innerHTML = agentNames;
    }

});

function addUserModal() {
    $("#addUserForm").trigger("reset");
    $('#btnUpdateAgent').hide();
    $(".glyphicon-eye-open").css("display", ""); //HERE
    $('#btnDeleteAgent').hide();
    $('#btnAddAgent').show();
    $('#configModal').modal();

    $('#inputUsername').prop('disabled', false);
    $('#inputPassword').prop('disabled', false);
    $('#confirmPassword').show();
    $('#inputPassword2').prop('disabled', false);
}

function deleteUser() {
    $.post("./DeleteAgent", {
        "id": selectedUser,
        "username": $('#inputUsername').val()
    },
        function (data, status) {
            console.log("Deleted!!!!")
            location.reload();
        });
}

$.validate({
    modules: 'toggleDisabled',
    disabledFormFilter: 'form.toggle-disabled',
    showErrorDialogs: false
});

/* $(".glyphicon-eye-open").on("click", function() {
    $(this).toggleClass("glyphicon-eye-close");
            var type = $("#inputPassword").attr("type");
    if (type == "text"){
            $("#inputPassword").prop('type','password');}
    else{
            $("#inputPassword").prop('type','text'); }
});  */

$(".glyphicon-eye-open").on("mouseover mouseout", function (e) {
    $(this).toggleClass("glyphicon-eye-close");
    var field = $(this).parent().children('input');
    var type = $(field).attr("type");

    if (type == "text") {
        $(field).prop('type', 'password');
    }
    else {
        $(field).prop('type', 'text');
    }
});

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

            //update version in footer
            socket.on('adversion', function (data) {
                $('#ad-version').text(data.version);
                $('#ad-year').text(data.year);
            });
        }
    },
    error: function (xhr, status, error) {
        console.log('Error');
        $('#message').text('An Error Occured.');
    }
});

