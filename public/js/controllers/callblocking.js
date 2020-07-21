var selectedCallBlock = 0;
var selectedCallBlockVrs = 0;
$(document).ready(function () {
    $("#sidebarcallblocking").addClass("active");
    $('#admin_treeview').addClass('active');
    //$('#admin_users_treeview').addClass('active');

    var table = $('#callblocktable').DataTable({
        "order": [],
        "columnDefs": [{
            "targets": [0],
            "data": "call_block_id",
            "visible": false,
            "searchable": false
        }, {
            "targets": [1],
            "data": "timeUpdated",
            "render": function (data, type, full, meta) {
                if (type == "display") {
                    return moment(data).local().format('YYYY/MM/DD LTS');
                }
                return data;
            },
            "width": "20%"
        }, {
            "targets": [2],
            "data": "vrs",
            "render": function (data, type, full, meta) {
                if (type == "display") {
                    let vidNumber = formatVRS(data);
                    return vidNumber;
                }
                return data;
            },
            "width": "15%"
        }, {
            "targets": [3],
            "data": "reason",
            "visible": true,
            "width": "45%"
        }, {
            "targets": [4],
            "data": "admin_username",
            "visible": true,
            "width": "15%"
        }, {
            "targets": [5],
            "data": "selected",
            "width": "5%",
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
        "rowCallback": function (row, data) {
            $('input.editor-active', row).prop('checked', data.selected == 1);
            //console.log("selected row: " + (data.selected == 1));
        }
    });

    $('#callblocktable tbody').on('change', 'input.editor-active', function () {
        let data = table.row($(this).parents('tr')).data();
        //console.log("checkbox clicked with data: " + JSON.stringify(data));

        data.selected = $(this).prop('checked') ? 1 : 0;
        //console.log("checkbox data: " + data.selected);
    });

    $('#callblocktable tbody').on('click', 'td', function () {
        let data = table.row($(this).parents('tr')).data();
        let col = table.cell(this).index().column;

        if (col != 5) {
            selectedCallBlock = data.call_block_id;
            selectedCallBlockVrs = data.vrs;

            let vidNumber = formatModelVRS(data.vrs);

            $('#inputVRS').val(vidNumber);
            $('#inputReason').val(data.reason);
            $('#inputVRS').prop('disabled', true);

            $('#btnUpdateCallBlock').show();
            //$(".glyphicon-eye-open").css("display", "none");
            $('#btnDeleteCallBlock').show();
            $('#btnAddCallBlock').hide();
            $('#configModal').modal();
        }
    });

    $("#btnAddCallBlock").click(function (event) {
        event.preventDefault();

        $('#inputVRS').prop('disabled', false);

        let data = {};
        data.vrs = $('#inputVRS').val().replace(/-/g, "");
        data.reason = $('#inputReason').val();

        //TODO put in check to alert user if vrs number already in DB

        socket.emit('add-callblock', {
            "data": data
        });

        $("#configModal").modal("hide");
    });

    $("#btnDeleteCallBlock").click(function (event) {
        event.preventDefault();
        console.log("CallBlockId selected to delete: " + selectedCallBlock);
        $('#confirm-delete').modal();
    });

    $("#btnUpdateCallBlock").click(function (event) {
        event.preventDefault();

        let data = {};
        data.id = selectedCallBlock;
        data.reason = $('#inputReason').val();

        socket.emit('update-callblock', {
            "data": data
        });

        $("#configModal").modal("hide");
    });

    $("#delete_callblock_btn").click(function (event) {
        getBulkDeleteCallBlockList();
        $('#confirm-bulk-delete').modal();
        $("#confirm-delete").modal("hide");
    });

    $("#bulk_delete_btn").click(function (event) {
        event.preventDefault();

        let ids = "";
        let vrs = "";
        let data = table.rows().data();
        data.each(function (value, index) {
            if (value.selected === 1) {
                ids += value.call_block_id + ",";
                vrs += value.vrs + ",";
            }
        });

        data = {};
        data.bulk = true;
        data.id = ids.slice(0, -1);
        data.vrs = vrs.slice(0, -1);

        socket.emit('delete-callblock', {
            "data": data,
        });

        $("#confirm-bulk-delete").modal("hide");
        $("#configModal").modal("hide");
    });

    function formatModelVRS(vrs) {
        if (vrs) {
            vrs = vrs.toString();
            if (vrs[0] === '1') vrs = vrs.slice(1, vrs.length);
            vrs = vrs.substring(0, 3) + '-' + vrs.substring(3, 6) + '-' + vrs.substring(6, vrs.length);
        }
        return vrs;
    }

    function formatVRS(vrs) {
        if (vrs) {
            vrs = vrs.toString();
            if (vrs[0] === '1') vrs = vrs.slice(1, vrs.length);
            vrs = '(' + vrs.substring(0, 3) + ') ' + vrs.substring(3, 6) + '-' + vrs.substring(6, vrs.length);
        }
        return vrs;
    }

    function getBulkDeleteCallBlockList() {
        let callBlockVrsNumbers = "";
        let data = table.rows().data();
        data.each(function (value, index) {
            if (value.selected === 1) {
                // console.log("Bulk delete: checked at index: ", index)
                // console.log("agent id checked is: " + value[0] + " call block username is: " + value[3]);
                callBlockVrsNumbers += "  " + formatVRS(value.vrs);
            }
        });

        document.getElementById("callblocklist").innerHTML = callBlockVrsNumbers;
    }

    // var len = 0;
    // var maxchar = 255;
    // $('#inputReason').keyup(function(){
    //     console.log('here');
    //     len = this.value.length;
    //     if (len > maxchar){
    //         return false;
    //     }
    //     else if (len > 0){
    //         $("#remainingC").html("Remaining characters: " + (maxchar - len));
    //     }
    //     else {
    //         $("#remainingC").html("Remaining characters: " + (maxchar));
    //     }
    // });

    connect_socket();
});

function addCallBlockModal() {
    $('#inputVRS').prop('disabled', false);
    $("#addCallBlockForm").trigger("reset");
    $('#btnUpdateCallBlock').hide();
    //$(".glyphicon-eye-open").css("display", "");
    $('#btnDeleteCallBlock').hide();
    $('#btnAddCallBlock').show();
    $('#configModal').modal();
}

function deleteCallBlock() {
    event.preventDefault();

    let data = {};
    data.id = selectedCallBlock;
    data.vrs = selectedCallBlockVrs;

    socket.emit('delete-callblock', {
        "data": data
    });

    $("#confirm-delete").modal("hide");
    $("#configModal").modal("hide");
}

$.validate({
    modules: 'toggleDisabled',
    disabledFormFilter: 'form.toggle-disabled',
    showErrorDialogs: false
});

// $(".glyphicon-eye-open").on("mouseover mouseout", function (e) {
//     $(this).toggleClass("glyphicon-eye-close");
//     var field = $(this).parent().children('input');
//     var type = $(field).attr("type");

//     if (type == "text") {
//         $(field).prop('type', 'password');
//     }
//     else {
//         $(field).prop('type', 'text');
//     }
// });

function connect_socket() {
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

                socket.emit('get-callblocks', {
                }).on('got-callblocks-recs', function (data) {
                    if (data.message === "Success") {
                        if (data.data.length > 0) {
                            $('#callblocktable').dataTable().fnClearTable();
                            $('#callblocktable').dataTable().fnAddData(data.data);
                            $('#callblocktable').resize();
                        }
                        else {
                            $('#callblocktable').dataTable().fnClearTable();
                            $('#callblocktable').resize();
                        }
                    } else {
                        $('#callblocktable').dataTable().fnClearTable();
                        $('#callblocktable').resize();
                    }
                }).on('add-callblock-rec', function (data) {
                    if (data.message == "Success") {
                        console.log("Saved!!!!");
                        socket.emit('get-callblocks', {});
                    }
                    else {
                        alert(data.message);
                    }
                }).on('delete-callblock-rec', function (data) {
                    if (data.message == "Success") {
                        console.log("Deleted!!!!");
                        socket.emit('get-callblocks', {});
                    }
                    else {
                        alert(data.message);
                    }
                }).on('update-callblock-rec', function (data) {
                    if (data.message === "Success") {
                        socket.emit('get-callblocks', {});
                    } else {
                        alert(data.message);
                    }
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
}