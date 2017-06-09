# Description
> This is an analytics tool that currently simulates 10,000 randomly generated calls over the course of one day. The calls are used
to determine at what points in the day call traffic is highest/lowest and to give some insight as to how a typical day might look.

# Getting Started
Clone this repository!

### Node
___
#### Installation

- Download and install Node.js [here.](https://nodejs.org/en/download/)
- Navigate to your cloned directory and install the required node modules by using:
             
        $ npm install randgen
        $ npm install mongoose


### Mongo
___
#### Installation
- Download and install MongoDB [here.](https://www.mongodb.com/download-center#community)
- To get Mongo set up and ready to run, follow along with [this manual.](https://docs.mongodb.com/manual/installation/)

# Usage
> After cloning the repository, you will have 4 files (including this readme).
By default, the main.js file creates 10,000 data points (callers) but this value can be changed on **line 15**.

> This will produce a text file named 'gumbelmaxout.txt' which represents all of the randomly created call times.
The call times are used to determine call frequency, which helps visualize the queue depth at any point
in time. 

> To make sure that the program will run correctly, your mongo server must be properly configured and running. In the main.js file on 
**line 29**, the _addToMongo_ function takes two parameters, an array and a path to your mongo database. Change this path to yours. 

To start your mongo database, use the command:

        $ mongod

If this command doesn't work then you haven't properly added your mongo directory to your PATH environment variable

Instead you can navigate to */c/Program Files/MongoDB/Server/3.x/bin* and use the command:
        
        $ ./mongod.exe


Now that your database is running, we can run the program. Navigate to the same directory as main.js and use the command:

        $ node main.js
The console will show 'Done.' when the program has completed and all of your data is in your mongo database.