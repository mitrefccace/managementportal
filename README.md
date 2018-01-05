![](images/acesmall.png)

# ACE Management Portal Project

The ACE Management Portal consists of two components, the Management and Call Detail Record (CDR) dashboards. These dashboards present the manager with information about the operations of the call center and information about incoming calls.

## SSL Configuration

1. ACE software uses SSL which requires a valid key and certificate
1. The location of the SSL key and certificate can be specified in the config.json by using the https:certificate and https:private_key parameters in the form of folder/file (e.g., ssl/mycert.pem and ssl/mykey.pem)
1. Additional information can be found in the ACE Direct Platform Release document

## Getting Started

To install the management portal, follow the README.md file in the autoinstall folder. The instructions for manual install are also provided below for reference.

1. Clone this repository
1. Download and install or update [Node.js](https://nodejs.org/en/)
1. Install the required Node.js modules: cd into the managementportal directory, run `npm install`
1. In an elevated command prompt, run `npm install -g bower`
1. Install the required bower modules: cd into the managementportal directory, run `bower install`
1. To start the ACE Management Portal node server manually, run `node server-db.js`

## Accessing the Portal

1. ACE Management Portal, go to: `http://<hostname:port>/dashboard.html`
