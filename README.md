![](images/acesmall.png)

# ACE Management Portal Project

The ACE Management Portal consists of two components, the Management and Call Detail Record (CDR) dashboards. These dashboards present the manager with information about the operations of the call center and information about incoming calls.

### SSL Configuration
1. ACE software uses SSL which requires a valid key and certificate
1. The location of the SSL key and certificate can be specified in the config.json by using the https:certificate and https:private_key parameters in the form of folder/file (e.g., ssl/mycert.pem and ssl/mykey.pem)
1. Additional information can be found in the ACE Direct Platform Release document

### Getting Started
To install the management portal, follow the README.md file in the autoinstall folder. The instructions for manual install are also provided below for reference.
1. Clone this repository
1. Download and install or update [Node.js](https://nodejs.org/en/)
1. Install the required Node.js modules: cd into the managementportal directory, run `npm install`
1. In an elevated command prompt, run `npm install -g bower`
1. Install the required bower modules: cd into the managementportal directory, run `bower install`
1. To start the ACE Management Portal node server manually, run `node server-db.js`

### Configuration
1. The ACE Direct configuration file is _config.json_. All values in the file are hashed using Base64 encoding for protection of sensitive information.
1. Use the _Hashconfig_ tool to modify values in the config.json file. This tool is available in a separate repo.
1. The _config.json_ file includes the following parameters:
    * _debuglevel_ - The debug level (ALL | TRACE | DEBUG | INFO | WARN | ERROR | FATAL | OFF)
    * _environment_ - ACE Direct (AD) or ACE Connect Lite (ACL)
    * _https:port-dashboard_ - The port to use for ACE Management Portal
    * _asterisk*:sip:host_ - Hostname or IP address of the ACE Direct Asterisk
    * _asterisk*:sip:websocket_ - Replace the hostname with the appropriate Asterisk hostname for ACE Direct
    * _asterisk*:ami:id_ - Username for the ACE Direct Asterisk server
    * _asterisk*:ami:passwd_ - Password for the ACE Direct Asterisk server
    * _asterisk*:ami:port_ - Listen port number for the ACE Direct Asterisk server
    * _queues:complaint:number_ - Phone number associated with the complaints queue
    * _acr-cdr:url_ - Replace with the URL of the REST service to retrieve all CDR records
    * _dashboard:queuesACL_ - Replace with the name of the queue used by ACE Connect Lite
    * _dashboard:queuesAD_ - Replace with the name of the queues used by ACE Direct
    * _dashboard:pollInterval_ - Replace with the polling interval in ms
    * _vrscheck:url_ - Replace with the URL of the REST service that performs VRS checks
    * _aceconnectlite:url_ - Replace with the URL of the ACE Connect Lite application
    * _acedirect:url_ - Replace with the URL of the ACE Direct application
    * _acedirect:zendesk_ - Replace with the URL of the Zendesk application
    * _agentservice:url_ - Replace with the URL of the REST service that performs agent validation
    * _jsonwebtoken:encoding_ - Encoding scheme
    * _jsonwebtoken:secretkey_ - Secret key used for authentication/token signing
    * _jsonwebtoken:timeout_ - Token timeout in ms,connection must be established before timeout
    * _jsonwebtoken:handshake_ - Boolean that indicates if token is accessible in the handshake
    * _session:secretKey_  - Secret key used to sign the session ID.
    * _resave_ - Forces the session to be saved back to the session store.
    * _saveUninitialized_ - Forces a sessiion that is "uninitialized" to be saved to the store.
    * _ maxAge_ - Time in ms to use when calculating the expiration datetime

### Accessing the Portal
1. ACE Management Portal, go to: http://`<hostname:port>`/dashboard.html
