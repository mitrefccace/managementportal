'use strict';

var getConfigVal = require('../helpers/utility').getConfigVal;
var express = require('express');
var jwt = require('jsonwebtoken');
var logger = require('../helpers/logger');
var openamAgent = require('openam-agent');
var request = require('request');
var urlparse = require('url');
var validator = require('./../utils/validator');

var router  = express.Router();

var agent = new openamAgent.PolicyAgent({
	serverUrl : 'https://' + getConfigVal('nginx:fqdn') + ":" + getConfigVal('nginx:port') + '/' +  getConfigVal('openam:path'),
	privateIP: getConfigVal('nginx:private_ip'),
	errorPage: function () {
		return '<html><body><h1>Access Error</h1></body></html>';
  }
});
var cookieShield = new openamAgent.CookieShield({ getProfiles: false, cdsso: false, noRedirect: false, passThrough: false });

//NGINX path parameter
var nginxPath = getConfigVal('nginx:mp_path');
if (nginxPath.length == 0) {
  //default for backwards compatibility
  nginxPath = "/ManagementPortal";
}

/**
 * Handles a GET request for / Checks if user has
 * a valid session, if so display dashboard else
 * display login page.
 *
 * @param {string} '/'
 * @param {function} 'agent.shield(cookieShield)'
 * @param {function} function(req, res)
 */
router.get('/', agent.shield(cookieShield),function (req, res) {
	if (req.session.role === 'Manager'||req.session.role === 'Supervisor') {
		res.redirect('./dashboard');
	} else {
		res.redirect('./Logout');
	}
});

/**
 * Handles a GET request for /dashboard. Checks user has
 * a valid session and displays dashboard page.
 *
 * @param {string} '/dashboard'
 * @param {function} 'agent.shield(cookieShield)'
 * @param {function} function(req, res)
 */
router.get('/dashboard', agent.shield(cookieShield), function (req, res) {
	if (req.session.role === 'Manager'||req.session.role === 'Supervisor') {
		res.render('pages/dashboard');
	} else if (req.session.role !== undefined) {
		console.log("bad role");
		res.redirect('./Logout');
	} else {
		res.redirect('./');
	}
});

/**
 * Handles a GET request for /dashboard. Checks user has
 * a valid session and displays dashboard page.
 *
 * @param {string} '/dashboard'
 * @param {function} 'agent.shield(cookieShield)'
 * @param {function} function(req, res)
 */
router.get(nginxPath, agent.shield(cookieShield), function (req, res) {
	res.redirect(nginxPath);
});

/**
 * Handles a GET request for /cdr. Checks user has
 * a valid session and displays CDR page.
 *
 * @param {string} '/cdr'
 * @param {function} 'agent.shield(cookieShield)'
 * @param {function} function(req, res)
 */
router.get('/cdr', agent.shield(cookieShield), function (req, res) {
	if (req.session.role === 'Manager'||req.session.role === 'Supervisor') {
		res.render('pages/cdr');
	} else {
		res.redirect('./');
	}
});

/**
 * Handles a GET request for /report. Checks user has
 * a valid session and displays report page.
 *
 * @param {string} '/report'
 * @param {function} 'agent.shield(cookieShield)'
 * @param {function} function(req, res)
 */
router.get('/report', agent.shield(cookieShield), function (req, res) {
	if (req.session.role === 'Manager'||req.session.role === 'Supervisor') {
		res.render('pages/report');
	} else {
		res.redirect('./');
	}
});

/**
 * Handles a GET request for /videomail. Checks user has
 * a valid session and displays videomail page.
 *
 * @param {string} '/videomail'
 * @param {function} 'agent.shield(cookieShield)'
 * @param {function} function(req, res)
 */
router.get('/videomail', agent.shield(cookieShield), function (req, res) {
	if (req.session.role === 'Manager'||req.session.role === 'Supervisor') {
		res.render('pages/videomail');
	} else {
		res.redirect('./');
	}
});

/**
 * Handles a GET request for /light. Checks user has
 * a valid session and displays light page.
 *
 * @param {string} '/light'
 * @param {function} 'agent.shield(cookieShield)'
 * @param {function} function(req, res)
 */
router.get('/light', agent.shield(cookieShield), function (req, res) {
	if (req.session.role === 'Manager'||req.session.role === 'Supervisor') {
		res.render('pages/light');
	} else {
		res.redirect('./');
	}
});

/**
 * Handles a GET request for /hours. Checks user has
 * a valid session and displays Hours page.
 *
 * @param {string} '/hours'
 * @param {function} 'agent.shield(cookieShield)'
 * @param {function} function(req, res)
 */
router.get('/hours', agent.shield(cookieShield), function (req, res) {
	if (req.session.role === 'Manager'||req.session.role === 'Supervisor') {
		res.render('pages/hours');
	} else {
		res.redirect('./');
	}
});

/**
 * Handles a GET request for /users. Checks user has
 * a valid session and displays Hours page.
 *
 * @param {string} '/users'
 * @param {function} 'agent.shield(cookieShield)'
 * @param {function} function(req, res)
 *
 */
router.get('/users', agent.shield(cookieShield), function (req, res) {

        if (req.session.role === 'Manager'||req.session.role === 'Supervisor') {
		/* TODO: retrieve the current agent list from aserver and populate 'users' */

		getAgentInfo(null, function (info) {

			if (info.message === "success") {
				logger.info("Returned agent data[0]" + info.data[0].username);

				// only return the info of records with role AD Agent
                		res.render('pages/users', {
					users: info.data.filter(function(item) {
                                        	return item.role === "AD Agent";
                                		})

				});
			}
		});
        } else {
                res.redirect('./');
        }
});

/**
 * Handles a GET request for /admin. Checks user has
 * a valid session and displays Administration page.
 *
 * @param {string} '/admin'
 * @param {function} 'agent.shield(cookieShield)'
 * @param {function} function(req, res)
 */
router.get('/admin', agent.shield(cookieShield), function (req, res) {
	if (req.session.role === 'Manager'||req.session.role === 'Supervisor') {
		getAgentInfo(null, function (info) {
			if (info.message === "success") {
				logger.info("Returned agent data[0]" + info.data[0].username);
				res.render('pages/admin');
			}
		});
	} else {
		res.redirect('./');
	}
});


/**
 * Handles a GET request for token and returnes a valid JWT token
 * for Manager's with a valid session.
 *
 * @param {string} '/token'
 * @param {function} 'agent.shield(cookieShield)'
 * @param {function} function(req, res)
 */
router.get('/token', agent.shield(cookieShield), function (req, res) {
	if (req.session.role === 'Manager'||req.session.role === 'Supervisor') {
		var token = jwt.sign(
			{ id: req.session.agent_id },
			new Buffer(getConfigVal('web_security:json_web_token:secret_key'), getConfigVal('web_security:json_web_token:encoding')),
			{ expiresIn: parseInt(getConfigVal('web_security:json_web_token:timeout')) });
		res.status(200).json({ message: "success", token: token });
	} else {
		req.session.destroy(function (err) {
			res.redirect('./');
		});
	}
});

/**
 * Handles a GET request for logout, destroys session
 * and redirects the user to the login page.
 *
 * @param {string} '/logout'
 * @param {function} function(req, res)
 */
router.get('/logout', function (req, res) {
	request({
		method: 'POST',
		url: 'https://' + getConfigVal('nginx:private_ip')+ ':' + getConfigVal('nginx:port') + '/json/sessions/?_action-logout',
		headers: {
			'host' : urlparse.parse('https://' + getConfigVal('nginx:fqdn')).hostname,
			'iplanetDirectoryPro': req.session.key,
			'Content-Type': 'application/json'
		}
	}, function (error) {
		if (error) {
			logger.error("logout ERROR: " + error);
		} else {
            var domaintemp = getConfigVal('nginx:fqdn');
            var n1 = domaintemp.indexOf(".");
			res.cookie('iPlanetDirectoryPro', 'cookievalue', {
				maxAge: 0,
				domain: domaintemp.substring(n1+1),
				path: "/",
				value: "" });
			req.session.destroy(function (err) {
				res.redirect(req.get('referer'));
			});
		}
	});
});

/**
 * Handles a POST from front end to add an agent
 *
 * @param {string} '/addAgent'
 * @param {function} function(req, res)
 *
 * TODO: need to add the agent into openAM DB
 */
router.post('/AddAgent', agent.shield(cookieShield), function (req, res) {
  var username = req.body.username;
  var password = req.body.password;
  var first_name = req.body.first_name;
  var last_name = req.body.last_name;
  var email = req.body.email;
  var phone = req.body.phone;
  var organization = req.body.organization;
  var extension = req.body.extension;
  var queue_id= parseInt(req.body.queue_id, 10);
  var queue2_id = parseInt(req.body.queue2_id, 10);


  logger.debug("Hit AddAgent with data: " + JSON.stringify(req.body));

  if (validator.isUsernameValid(username) && validator.isPasswordComplex(password) && validator.isNameValid(first_name) && validator.isNameValid(last_name) && validator.isEmailValid(email) && validator.isPhoneValid(phone) ) {

	getAgentInfo(username, function (info) {

		if (info.message === "success") {
			console.error("User already in DB: " + username);
			res.send({
                        	'result': 'fail',
				'message': 'Username already exists, cannot add'
                	});
		}
		else {
			// prepare added user data
        		var url = 'https://' + getConfigVal('common:private_ip') + ":" + parseInt(getConfigVal('agent_service:port')) + '/addAgents/';

			// create newAgent JSON object from inputs

			var newAgent = {
				"data": [{
					"username": username,
              				"password": password,
              				"first_name": first_name,
              				"last_name": last_name,
              				"role": "AD Agent",
              				"phone": phone,
              				"email": email,
              				"organization": organization,
              				"is_approved": 1,
              				"is_active": 1,
              				"extension_id": extension,
              				"queue_id": queue_id,
              				"queue2_id": queue2_id,
          				}]
			};

			logger.debug("New agent to be added: " + JSON.stringify(newAgent));

        		request.post({
                		url: url,
				json: true,
                		body: newAgent
        		}, function (error, response, data) {
				logger.debug("aserver call response: " + JSON.stringify(response));
				logger.debug("aserver call data: " + JSON.stringify(data));
                		if (error) {
                        		logger.error("AddAgent ERROR: " + error);
					res.send({
                        			'result': 'fail',
						'message': data.message
                			});
                		} else {
                        		logger.info("Agent added in aserver: " + data.message);

					// add user and passwd into openAM
				 	var openAMAgentInfo = {
							"operation": "addAgent",
							"username": username,
							"password": password,
							"first_name": first_name,
							"last_name": last_name,
							"email": email};
					openAMOperation(openAMAgentInfo);

					 res.send({
                        			'result': 'success',
						'message': data.message
                			});
                		}

			});
		}
	});

  }
  else {
	res.send({
         	'result': 'fail',
		'message': 'Invalid inputs, cannot add'
       });
  }
});


/**
 * Handles a POST from front end to update an agent
 *
 * @param {string} '/UpdateAgent'
 * @param {function} function(req, res)
 *
 * TODO: need to add the agent into openAM DB
 */
router.post('/UpdateAgent', agent.shield(cookieShield), function (req, res) {
  var agent_id = req.body.agent_id;
  var username = req.body.username;
  var password = req.body.password;
  var first_name = req.body.first_name;
  var last_name = req.body.last_name;
  var email = req.body.email;
  var phone = req.body.phone;
  var organization = req.body.organization;
  var extension = parseInt(req.body.extension, 10);
  var queue_id= parseInt(req.body.queue_id, 10);
  var queue2_id = parseInt(req.body.queue2_id, 10);


  if (validator.isNameValid(first_name) && validator.isNameValid(last_name) && validator.isEmailValid(email) && validator.isPhoneValid(phone)) {

	getAgentInfo(username, function (info) {

		if (info.message != "success") {
			logger.error("User does not exist in DB: " + username);
			res.send({
                        	'result': 'fail',
				'message': 'Username does not exist in DB, cannot update'
                	});
		}
		else {
			// prepare user data
        		var url = 'https://' + getConfigVal('common:private_ip') + ":" + parseInt(getConfigVal('agent_service:port')) + '/UpdateProfile/';

			// create newAgent JSON object from inputs

			var newAgent = {
					"agent_id": agent_id,
              				"first_name": first_name,
              				"last_name": last_name,
              				"role": "AD Agent",
              				"phone": phone,
              				"email": email,
              				"organization": organization,
              				"is_approved": 1,
              				"is_active": 1,
              				"extension": extension,
					"queue_id": queue_id,
					"queue2_id": queue2_id,
			};

			logger.debug("Agent data to be updated: " + JSON.stringify(newAgent));

        		request.post({
                		url: url,
				json: true,
                		body: newAgent
        		}, function (error, response, data) {
				logger.debug("aserver call response: " + JSON.stringify(response));
				logger.debug("aserver call data: " + JSON.stringify(data));
                		if (error) {
                        		logger.error("UpdateAgent ERROR: " + error);
					res.send({
                        			'result': 'fail',
						'message': data.message
                			});
                		} else {
                        		logger.info("Agent updated: " + data.message);

					// username and password are not changeable now
					var openAMAgentInfo = {
							"operation": "updateAgent",
							"username": username,
							"password": "",
							"first_name": first_name,
							"last_name": last_name,
							"email": email};
					openAMOperation(openAMAgentInfo);

					 res.send({
                        			'result': 'success',
						'message': data.message
                			});
                		}
			});
		}
	});

  }
  else {
	res.send({
         	'result': 'fail',
		'message': 'Invalid inputs, cannot update'
       });
  }
});

/**
 * Handles a POST from front end to add an agent
 *
 * @param {string} '/DeleteAgent'
 * @param {function} function(req, res)
 *
 * TODO: need to add the agent into openAM DB
 */
router.post('/DeleteAgent', agent.shield(cookieShield), function (req, res) {
  var agentId = req.body.id;
  var username = req.body.username;

  logger.info("Hit DeleteAgent with agentId: " + agentId + ", username: " + username);

  if (agentId) {

	var url = 'https://' + getConfigVal('common:private_ip') + ":" + parseInt(getConfigVal('agent_service:port')) + '/DeleteAgent/';

       	request.post({
         	url: url,
		json: true,
               	body: {agent_id: agentId}
       		}, function (error, response, data) {
			logger.debug("aserver call response: " + JSON.stringify(response));
                	if (error) {
                        	logger.error("DeleteAgent ERROR: " + error);
				res.send({
                        		'result': 'fail',
					'message': data.message
                			});
                		} else {
                        		logger.info("Agent deleteed: " + data.message);

					// delete the user from openAM
					var openAMAgentInfo = {
							"operation": "deleteAgent",
							"username": username,
							"password": "",
							"first_name": "",
							"last_name": "",
							"email": ""};
					openAMOperation(openAMAgentInfo);

					res.send({
                        			'result': 'success',
						'message': data.message
                			});
                		}
			});
	}
   else {
	res.send({
         	'result': 'fail',
		'message': 'Invalid inputs, cannot add'
       });
   }
});




/**
 * Handles a GET from front end to load an agent data
 *
 * @param {string} '/DeleteAgent'
 * @param {function} function(req, res)
 *
 */
router.get('/GetAgent', agent.shield(cookieShield), function (req, res) {
  var username = req.query.username;

  logger.info("Hit GetAgent with username: " + username);

  getAgentInfo(username, function (info) {

  if (info.message === "success") {
	logger.info("User found in DB: ");
	logger.info(JSON.stringify(info.data[0]));
	res.send(info.data[0]);
  }
 });
});


/**
 *  * Calls the RESTful service running on the provider host to retrieve agent information
 *  * username and password.
 *  *
 *  * @param {type} username Agent username, if username is null, retrieve all agent records
 *  * @param {type} callback Returns retrieved JSON
 *  * @returns {undefined} Not used
 *  */
function getAgentInfo(username, callback) {
	var url;

	if (username) {
        url = 'https://' + getConfigVal('common:private_ip') + ":" + parseInt(getConfigVal('agent_service:port')) + '/getagentrec/' + username;
	} else {
        url = 'https://' + getConfigVal('common:private_ip') + ":" + parseInt(getConfigVal('agent_service:port')) + '/getallagentrecs';
	}
	logger.info("getAgentInfo query URL: " + url);

	request({
		url: url,
		json: true
	}, function (error, response, data) {
		if (error) {
			logger.error("login ERROR: " + error);
			data = {
				"message": "failed"
			};
		} else {
			logger.info("Agent Verify: " + data.message);
		}
		callback(data);
	});
}


/**
 * Contains all openAM related operation to manage agents
 *
 * @param - none
 * @return - none: this function is invoked after aserver update which drives the response code to front end.
 * 		   openAM API calls do not generate response to front-end
 *
 * */
function openAMOperation(openAMAgentInfo) {

	logger.info("openAMOperation with info: " + JSON.stringify(openAMAgentInfo));

	// Use the approach to access openam from inside the organization network
	var urlPrefix = 'https://' + getConfigVal('openam:private_ip') + ":" + parseInt(getConfigVal('openam:port')) + '/' + getConfigVal('openam:path');

	var openAmLoginSuccess = new Promise(
		function (resolve, reject) {

			// authenticate first
			var url = urlPrefix + '/json/authenticate';

			logger.debug("openam url: " + url);
			request.post({
				url: url,
				json: true,
				headers: {
					'X-OpenAM-Username': getConfigVal('openam:user'),
					'X-OpenAM-Password': getConfigVal('openam:password'),
					'Content-Type': 'application/json',
					'host' : urlparse.parse('https://' + getConfigVal('openam:fqdn')).hostname,
					}
			}, function (error, response, data) {

				if (error) {
					logger.error("openAM ERROR: " + error);
					reject("openAM login failed");
				} else {
					logger.info("openAM no error");
					logger.debug("openam call data: " + JSON.stringify(data));
					logger.debug("openam call response: " + JSON.stringify(response));
					var openamToken = data.tokenId;
					logger.info("openam logged in successfully with tokenid: " + openamToken);
					resolve(openamToken);		// resolve Promise with token
				}
			});
		});

	var openAmChange = function (succTokenId) {
		return new Promise(
			function (resolve, reject) {

			switch(openAMAgentInfo.operation) {
			    case "addAgent":
				logger.info("openam addAgent");
				var url = urlPrefix + '/json/users/?_action=create';
				request.post({
					url: url,
					json: true,
					headers: {
						'iplanetDirectoryPro': succTokenId,
						'Content-Type': 'application/json',
						'host' : urlparse.parse('https://' + getConfigVal('openam:fqdn')).hostname,
					},
					body: {
						'username': openAMAgentInfo.username,
						'userpassword': openAMAgentInfo.password,
						'mail': [openAMAgentInfo.email],
						'givenName': [openAMAgentInfo.first_name],
						'sn': [openAMAgentInfo.last_name],
						'cn': [openAMAgentInfo.first_name + ' ' + openAMAgentInfo.last_name],
						'assignedDashboard': ["Google","AgentPortal","TicketCenter"]
					}
				}, function (error, response, data) {
					if (error) {
						logger.error("openAM ERROR addAgent: " + error);
						resolve(succTokenId);		// even when the operation fails, pass token to proceed to openam logout
					} else {
						logger.debug("openam call data: " + JSON.stringify(data));
						logger.debug("openam call response: " + JSON.stringify(response));
						logger.info("openam addAgent success username: " + openAMAgentInfo.username);
						resolve(succTokenId);
					}
				});

				break;

			    case "updateAgent":
				logger.info("openam updateAgent");
				var url = urlPrefix + '/json/users/' + openAMAgentInfo.username;
				request.put({
					url: url,
					json: true,
					headers: {
						'iplanetDirectoryPro': succTokenId,
						'Content-Type': 'application/json',
						'host' : urlparse.parse('https://' + getConfigVal('openam:fqdn')).hostname,
					},
					body: {	// username and password are not updatable for now
						'mail': [openAMAgentInfo.email],
						'givenName': [openAMAgentInfo.first_name],
						'sn': [openAMAgentInfo.last_name],
						'cn': [openAMAgentInfo.first_name + ' ' + openAMAgentInfo.last_name]
					}
				}, function (error, response, data) {
					if (error) {
						logger.error("openAM ERROR updateAgent: " + error);
						resolve(succTokenId);		// even when the operation fails, pass token to proceed to openam logout
					} else {
						logger.debug("openam call data: " + JSON.stringify(data));
						logger.debug("openam call response: " + JSON.stringify(response));
						logger.info("openam updateAgent success username: " + openAMAgentInfo.username);
						resolve(succTokenId);
					}
				});

				break;

			    case "deleteAgent":
				logger.info("opeam deleteAgent");

				var url = urlPrefix + '/json/users/' + openAMAgentInfo.username;
				request.delete({
					url: url,
					json: true,
					headers: {
						'iplanetDirectoryPro': succTokenId,
						'Content-Type': 'application/json',
						'host' : urlparse.parse('https://' + getConfigVal('openam:fqdn')).hostname,
					}
				}, function (error, response, data) {
					if (error) {
						logger.error("openAM ERROR deleteAgent: " + error);
						resolve(succTokenId);		// even when the operation fails, pass token to proceed to openam logout
					} else {
						logger.debug("openam call data: " + JSON.stringify(data));
						logger.debug("openam call response: " + JSON.stringify(response));
						logger.info("openam deleteAgent success username: " + openAMAgentInfo.username);
						resolve(succTokenId);
					}
				});

				break;
			}

		});};

		openAmLoginSuccess.then(openAmChange).then(
			function (succTokenId) {

				// logout openAM: this part should be hit as long as openAM login is successful
				// openAMChange() always resolves with the token so proper openAM logout can be performed

				var openam_logout = urlPrefix + '/json/sessions/?_action=logout';

				logger.info("openam url: " + openam_logout);
				request.post({
					url: openam_logout,
					json: true,
					headers: {
						'iplanetDirectoryPro': succTokenId,
						'Content-Type': 'application/json',
						'host' : urlparse.parse('https://' + getConfigVal('openam:fqdn')).hostname,
						}
				}, function (error, response, data) {

					if (error) {
						logger.error("openAM ERROR: " + error);
					} else {
						logger.info("openAM logout succ");
						logger.debug("openam call data: " + JSON.stringify(data));
						logger.debug("openam call response: " + JSON.stringify(response));
					}
				});
			},
			function(error) {
				// should only come here if the login fails
				logger.error("openAM login failed: " + error);
			});

}

module.exports = router;
