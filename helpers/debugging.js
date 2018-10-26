// These are functions that are not called by code.
// They look like they are called by a person during an interactive debugging session.
// Extracted from server-db.js

/**
 * Find the agent name given the agent information
 * @param {type} Agents
 * @param {type} agent
 * @returns {unresolved} Not used
 */
function findAgentName(Agents, agent) {
	for (var i = 0; i < Agents.length; i++) {
		if (Agents[i].agent == agent)
			return Agents[i].name;
	}
}

/**
 * Find agent by name and queue
 * @param {type} Agents
 * @param {type} agent
 * @param {type} queue
 * @returns {unresolved}
 */
function findAgentInQueue(Agents, agent, queue) { // find agent by name (extension) and queue
	logger.debug("findAgentInQueue() Entering:  agent= " + agent + ", queue= " + queue);
	for (var i = 0; i < Agents.length; i++) {
		logger.debug(Agents[i]);
		if ((Agents[i].agent === agent) && (Agents[i].queue === queue)) {
			logger.debug("findAgentInQueue(): found Agent " + agent + ", queue:" + queue);
			return Agents[i];
		} else if ((Agents[i].agent === agent) && (Agents[i].queue === "--")) { // queue not set
			logger.debug("findAgentInQueue(): empty queue");
			return Agents[i];
		}
	}
	return null;
}

/**
 * Display agent information in the array
 * @param {type} Agents
 * @returns {undefined} Not used
 */
function printAgent(Agents) {
	logger.debug("Entering printAgent() ");
	for (var i = 0; i < Agents.length; i++) {
		logger.debug(Agents[i]);
	}
}

/**
 * Initialize Agent Call map (total calls taken)
 * @param {type} Asterisk_queuenames
 * @param {type} obj Map
 * @returns {undefined} Not used
 */
function setCallMap(Asterisk_queuenames, map) {
	for (var i = 0; i < Asterisk_queuenames.length; i++) {
		map.set(Asterisk_queuenames[i], 0); // set the total call to 0
	}
}

/**
 * Display the content of agent call map
 * @param {type} obj Map
 * @returns {undefined} Not used
 */
function printCallMap(m) {
	m.forEach(function (call, queue) {
		logger.debug("printCallMap(): " + queue + " " + call);
	});
}

/**
 * Display event detail information
 * @param {type} evt Event to display
 * @returns {undefined} Not used
 */
function showEvent(evt) {
	if (evt) {
		logger.debug('Event: ' + evt.event);
	}
}
