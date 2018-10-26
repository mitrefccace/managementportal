#!/bin/sh

DIR=/usr/src/dat/; export DIR

if [ -r $DIR/config.json ]; then
	pm2-docker start app.js
else
	echo "error: unable to read ${DIR}config.json file."
fi
