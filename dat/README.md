The color_config.json default_color_config.json files must be copied to the /home/centos/dat folder to take affect. default_color_config.json is now a 508 compliant color scheme.

For dynamic updating of Busylight status colors, make sure this parameter in managementportal/config.json is set:

"acedirect": {
  "url": "https://<ACE Direct Private IP>:<ACE Direct Port>"
},

