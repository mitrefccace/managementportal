<<<<<<< HEAD
# managementportal

### This repository started with the p4s2 baseline.

## NOTE!

* To run this portal: pm2 start server-db.js
* Make sure no other server-db.js is running!
* Access the portal: http://<hostname>:<port number>

## Node module installation

Run this to install required node modules: npm install
Note: the node_modules folder is not versioned. Add all required modules in package.json (e.g. npm install somepackage --save).

## Configuration

config_TEMPLATE.json and config-aws.json_TEMPLATE are the default configuration files versioned in Git. Copy them to the same name without "_TEMPLATE". Make any structure changes to the _TEMPLATE versions. The effective config files are not versioned. The config file must be named: config.json

Add the asterisk host and provider host information.

## Asterisk

; in queues.conf
[StandardQueue](!)
autofill=no    ; calls come from Asterisk serially
strategy=rrmemory
joinempty=yes
leavewhenempty=no
ringinuse=no
wrapuptime=25  ; When a member hangs up, how many seconds does queue wait before assigning another caller.  Default is 0.
setqueuevar=yes
eventwhencalled=yes

## Notes

* Zendesk uses the email address as the key. If the email address is NOT in Zendesk, Zendesk associates the incoming first name with that email address and stores both. If the email address IS in Zendesk, Zendesk retrieves the first name that was stored originally.
=======
# managementportal

### This repository started with the acrdemo-p4s2 baseline.

## NOTE!

* To run this portal: pm2 start server-db.js
* Make sure no other server-db.js is running!
* Access the portal: http://insert portal hostname:1234

## Node module installation

Run this to install required node modules: npm install
Note: the node_modules folder is not versioned. Add all required modules in package.json (e.g. npm install somepackage --save).

## Configuration

config_TEMPLATE.json and config-aws_TEMPLATE.json are the default configuration files versioned in Git. Copy them to the same name without "_TEMPLATE". Make any structure changes to the _TEMPLATE versions. The effective config files are not versioned. The config file must be named: config.json

Add the asterisk host and provider host information.

## Asterisk

; in queues.conf
[StandardQueue](!)
autofill=no    ; calls come from Asterisk serially
strategy=rrmemory
joinempty=yes
leavewhenempty=no
ringinuse=no
wrapuptime=25  ; When a member hangs up, how many seconds does queue wait before assigning another caller.  Default is 0.
setqueuevar=yes

## Notes

* Zendesk uses the email address as the key. If the email address is NOT in Zendesk, Zendesk associates the incoming first name with that email address and stores both. If the email address IS in Zendesk, Zendesk retrieves the first name that was stored originally.
>>>>>>> 44399afd5ba6e4c310655cf33adeefc7564c2e13
