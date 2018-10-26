# When building the container, you must pass in the http_proxy
# as a build argument (e.x.: docker build --build-arg http_proxy=<proxy>
#
FROM node:8-alpine

# Install pm2



# Start pm2.json process file
#CMD ["pm2-runtime", "start", "pm2.json"]

WORKDIR /usr/src/app

RUN if [ -n "$http_proxy" ]; then export https_proxy=$http_proxy ; \
    echo "{ \"proxy\": \"$http_proxy\", \"https-proxy\":\"$http_proxy\" }" > ~/.bowerrc  ; \
        npm config set proxy $http_proxy ;\
        npm config set https-proxy $http_proxy; fi

####RUN apk add node && npm install pm2 -g

COPY package.json .

# Need to install git for bower
#RUN apk update -y && apk add -y git
RUN apk update && apk add git

# Set proxies for bower too.
RUN npm install && npm install -g pm2 

COPY . .

EXPOSE 9036

ENTRYPOINT ["./docker-entrypoint.sh"]
#CMD [ "pm2-docker", "start", "adserver.js" ]
