![](images/acesmall.png)

# ACE Fendesk Project

Fendesk is a standalone web server that emulates the [Zendesk](https://www.zendesk.com/) ticketing system for ACE Direct or any client that needs a simple ticketing system. The software only implements the subset of Zendesk RESTful API calls that ACE Direct uses. However, it is expandable to include other API calls.

Fendesk uses a simple storage scheme. It creates, updates, and returns tickets as simple text files. The filename for a ticket follows the same naming convention as Zendesk: <ticketno>.json (e.g., 322.json). Fendesk offers RESTful API calls to test connectivity, add/update/delete/retrieve tickets, and search for all tickets with a specified VRS number.

### SSL Configuration

1. ACE software uses SSL which requires a valid key and certificate
1. The location of the SSL key and certificate is specified in the ~/dat/config.json by using the common:https:certificate and common:https:private_key parameters in the form of folder/file (e.g., /home/centos/ssl/mycert.pem and /home/centos/ssl/mykey.pem). The provided .pem files in the ssl folder are for testing purposes only. Use your own certified .pem files in production.
1. Additional information can be found in the ACE Direct Platform Release document

### App Configuration

1. To use this with the esb, the esb must recognize this requester/submitter id: *12223334444*.

### Getting Started

To install fendesk, follow the README.md file in the autoinstall folder. The instructions for manual install are also provided below for reference.
1. Clone this repository
1. Download and install [Node.js](https://nodejs.org/en/)
1. Install the required Node.js modules: cd into the userver directory, run `npm install`
1. Edit config.json
1. From the command line:
    * cd fendesk
    * npm install
    * npm install apidoc -g
    * apidoc -i routes/ -o apidoc/
    * node app.js

#### Running

Usage: nodejs app.js

#### Testing

```
user@yourmachine:~$  curl -k --request GET https://IP address:port/  # check connectivity

user@yourmachine:~$  curl -k -H "Content-Type: application/json" -X POST -d '{"ticket":{"subject":"television","description":"Big Bang Theory is inaccurate","custom_fields":[{"id":29894948,"value":null},{"id":80451187,"value": 1112223333}],"requester":{"name":"Albert","email":"al@someemail.org","phone":"1112223333","user_fields":{"last_name":"Einstein"}}}}' https://IP address:port/api/v2/tickets.json  # add

user@yourmachine:~$  curl -k -H "Content-Type: application/json" -X PUT -d '{"ticket":{"subject":"television (updated)","description":"Sheldon is funny","custom_fields":[{"id":29894948,"value":123},{"id":80451187,"value":1231231234}],"requester":{"name":"Albert","email":"al@someemail.org","phone":"1112223333","user_fields":{"last_name":"Einstein"}},"status":"new","comment":{"public":true,"body":"this is the comment body"},"resolution":"this is the resolution"}}' https://IP address:port/api/v2/tickets/1.json  # update

user@yourmachine:~$  curl -k --request GET https://IP address:port/api/v2/tickets/1.json  # get

user@yourmachine:~$  curl -k --request DELETE https://IP address:port/api/v2/tickets/1.json  # delete

user@yourmachine:~$  curl -k --request GET https://127.0.0.1:1234/api/v2/search.json?query=fieldvalue:1112223333+type:ticket  # search for all tickets with the vrsnum value as a custom field value
```
