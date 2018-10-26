var fs = require('fs');
var randgen = require('randgen');
//var mongoose = require('mongoose');
var tools = require('./tools');

//if the output file already exists then delete it
if(fs.existsSync("./gumbelmaxout.txt")){
    fs.unlink("gumbelmaxout.txt");
}

var mu = 9.02;    //continuous location parameter
var sigma = 1.1659; //continuous scale parameter
var outfile = fs.createWriteStream('gumbelmaxout.txt');
//change the number of iterations for this loop if you want more or less data
for(var x = 0; x < 10000; x++) {

    //creates a random sample in the range 6 < x < 23, following
    //the Gumbel Max distribution with mu, sigma
    var p = randgen.runif(0,1,false);
    var sample = mu - sigma * Math.log(-1 * Math.log(p));
    outfile.write(sample + '\r\n');
}
outfile.end(function(){
    //create an array of records from the list of values from gumbelmaxout
    var rec=tools.createArrayOfRecords();
    /*This line is inserting all of the data into mongo.
    The second parameter is the path to your running mongo database which can be changed
    to your personal path*/
    tools.addToMongo(rec,'mongodb://localhost/test');
});
