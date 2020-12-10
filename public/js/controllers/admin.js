'use strict';

// Angular setup

// Much of the angular datatables logic was inspired by the following SO post
// https://stackoverflow.com/questions/11872832/how-to-respond-to-clicks-on-a-checkbox-in-an-angularjs-directive
var adminApp = angular.module('admin',['csrService','datatables']).controller('adminController', function($scope, socket,  DTOptionsBuilder){

    /**
     * Initial function fired when the DOM/window loads
     */
    $scope.initData = function () {
        // Add the active class to the Administration tab in the sidebar
        // Gives it a purple highlighted bar on the lefthand side
        $("#sidebaradmin").addClass("active");
        // Emit the initial AMI action request to get the Agent information from the backend
        socket.emit('ami-req', "agent");
    };
    // Call the initData function when the DOM loads
    angular.element(document).ready($scope.initData());

    // Set the default order to order by the extensions column in ascending order
    $scope.options = DTOptionsBuilder.newOptions().withOption('order', [[1, 'asc']]);

    // Initialize Agents scope to an empty array
    $scope.Agents = [];
    // Initialize the selected agents array
    $scope.selected = [];

    function findAgent(scopeagents, dataagent) {
        for (var i=0; i<scopeagents.length; i++) {
            if (scopeagents[i].agent === dataagent.agent)
                return scopeagents[i];
        }
        return null;
    }
    // Update Ace Direct version in footer of page
    socket.on('adversion', function (data) {
        $('#ad-version').text(data.version);
        $('#ad-year').text(data.year);
    });

    // Update the agents data table with the correct agent information and properties
    // The socket io event received contains the agent data
    socket.on('agent-resp', function (data){
        if (data.agents) {
            for (var i=0; i<data.agents.length; i++) {
                var a = findAgent($scope.Agents, data.agents[i]);
                if (a) {
                    for (var prop in data.agents[i]) {
                        a[prop] = data.agents[i][prop];
                    }
                }
                else {
                    // Push the new agent into the angular scope
                    $scope.Agents.push(data.agents[i]);
                }
            }
        }
    });
    // Show an error modal to the user if the force logout password is not present in the config
    socket.on('forceLogoutPasswordNotPresent', function(){
        $('#invalidForceLogoutPasswordModal').modal('show');
    });

    /**
     * Updates the array of agents that have been selected by the user
     *
     * Upon the checking or un-checking of the checkbox associated with each table row,
     * we either add or remove the agent to the list of currently selected agents within Angular's scope
     * */
    function updateSelected(action, tableAgent){
        if (action === 'add' && $scope.isSelected(tableAgent) === false) {
            // Add the selected agent to the list of selected agents
            $scope.selected.push(tableAgent);
        }
        if (action === 'remove' && $scope.isSelected(tableAgent) === true) {
            // Remove the agent from angular scope of selected agents
            for(var i = $scope.selected.length-1; i>=0; i--){
                if($scope.selected[i].agent === tableAgent.agent){
                    $scope.selected.splice(i, 1);
                }
            }
        }
    }
    /**
     * Pretty prints the list of selected agents
     */
    function printSelectedAgents(){
        for(var i = 0; i< $scope.selected.length; ++i){
            console.log(JSON.stringify($scope.selected[i], null, 2, true));
        }
    }
    /**
     * Updates the list of selected agents based on whether a row's checkbox has been checked or unchecked
     */
    $scope.updateSelection = function($event, tableAgent) {
        var checkbox = $event.target;
        var action = (checkbox.checked ? 'add' : 'remove');
        updateSelected(action, tableAgent);
        printSelectedAgents();
    };

    /**
     * Check if an agent is present in the current list of selected agents
     */
    $scope.isSelected = function(checkAgent){
        for(var i = 0; i< $scope.selected.length; ++i){
            if($scope.selected[i].agent === checkAgent.agent){
                return true;
            }
        }
        return false;
    };
    /**
     * Determines if the selected class should be added to the datatable row
     *
     * The addition of this class to the table row will give the row a blue highlighted background
     */
    $scope.getSelectedClass = function(tableAgent) {
        return $scope.isSelected(tableAgent) ? 'selected' : '';
      };


    /**
     * Returns an array of agent objects containing the agent name, extension, and call status
     *  Example return value
     *  [{
     *      "name": "James Madison",
     *      "extension": "30001",
     *      "status": Away
     *  }]
     */
    function getSelectedAgentsForForcefulLogout(){
        let agents = [];
        $scope.selected.forEach(agent => {
            // Only return the users that are currently not in a call to be forcefully logged out
            if(agent.status !== "In Call"){
                agents.push({
                    "name": agent.name, // eg. - James Madison
                    "extension": agent.agent, // agent.agent refers to an agent extension (eg. 30001)
                    "status": agent.status // eg. - Ready
                });
            }
        });
        return agents;
    }

    // Invoked when the Force Logout button within the confirmation modal is clicked
    $("#forceLogoutModalButton").click(function(event){
        event.preventDefault();
        // Hide the modal
        $('#logoutConfirmationModal').modal('hide');
        // Get the agents to be logged out from the selected scope
        let agentsToBeLoggedOut = getSelectedAgentsForForcefulLogout();
        if(socket !== null && agentsToBeLoggedOut.length > 0){
            console.log('Sending forceLogut event to server');
            // Emit a forceful logout event to the backend server
            socket.emit('forceLogout', agentsToBeLoggedOut);
            console.log('Sent forceLogout event to server');
        }
    });

    // Invoked when the Force Logout button on the main Administration page is clicked
    $("#forceLogoutButton").click(function(event){
        event.preventDefault();
        let agentsToBeLoggedOut = getSelectedAgentsForForcefulLogout();
        // Check if the user selected any agents to be logged out
        if(agentsToBeLoggedOut.length === 0){
            // Show an information toast telling the user to select an agent to logout
            iziToast.info({
                message: 'Select some agents to logout!',
                position: 'topRight',
                timeout: 2200, // how long the toast will remain active for
                displayMode: 'replace' // if a current toast is active, replace it with the new one
            });
        }else{
            // The user has selected agents to logout so show them the confirmation modal
            $('#logoutConfirmationModal').modal('show');
        }
    });
});
