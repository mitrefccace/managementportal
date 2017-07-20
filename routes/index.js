'use strict';

var decodeBase64 = require('../helpers/utility').decodeBase64;
var express = require('express');
var jwt = require('jsonwebtoken');
var logger = require('../helpers/logger');
var nconf = require('nconf');
var openamAgent = require('openam-agent');
var request = require('request');
var url = require('url');

var router  = express.Router();

var agent = new openamAgent.PolicyAgent({
	serverUrl : decodeBase64(nconf.get('openam:serverUrl')) + ":" + decodeBase64(nconf.get('openam:port')) + '/' +  decodeBase64(nconf.get('openam:path')),
	privateIP: decodeBase64(nconf.get('openam:privateIP')),
	errorPage: function () {
		return '<html><body><h1>Access Error</h1></body></html>';
  } 
});
var cookieShield = new openamAgent.CookieShield({ getProfiles: false, cdsso: false, noRedirect: false, passThrough: false });

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
	if (req.session.role === 'Manager') {
		res.redirect('./dashboard');
	} else if (req.session.role !== undefined) {
		res.redirect('./Logout');
	} else {
		res.render('pages/login', { csrfToken: req.csrfToken() });
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
	if (req.session.role === 'Manager') {
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
router.get('/ManagementPortal', agent.shield(cookieShield), function (req, res) {
	res.redirect('./');
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
	if (req.session.role === 'Manager') {
		res.render('pages/cdr');
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
	if (req.session.role === 'Manager') {
		res.render('pages/light');
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
	if (req.session.role === 'Manager') {
		var token = jwt.sign(
			{ id: req.session.agent_id },
			new Buffer(decodeBase64(nconf.get('jsonwebtoken:secretkey')), decodeBase64(nconf.get('jsonwebtoken:encoding'))),
			{ expiresIn: parseInt(decodeBase64(nconf.get('jsonwebtoken:timeout'))) });
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
		url: 'https://' + decodeBase64(nconf.get('openam:privateIP'))+ ':' + decodeBase64(nconf.get('openam:port')) + '/json/sessions/?_action-logout',
		headers: {
			'host' : url.parse(decodeBase64(nconf.get('openam:serverUrl'))).hostname,
			'iplanetDirectoryPro': req.session.key,
			'Content-Type': 'application/json'
		}
	}, function (error) {
		if (error) {
			logger.error("logout ERROR: " + error);
		} else {
			res.cookie('iPlanetDirectoryPro', 'cookievalue', { 
				maxAge: 0, 
				domain: decodeBase64(nconf.get('openam:domain')), 
				path: "/", 
				value: "" });
			req.session.destroy(function (err) {
				res.redirect(req.get('referer'));
			});
		}
	});
});

module.exports = router;