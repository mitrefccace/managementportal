var fs = require('fs');
var randgen = require('randgen');
var mongoose = require('mongoose');
var tools = require('./tools');

//if the output file already exists then delete it
if(fs.existsSync("./gumbelmaxout.txt")){
    fs.unlink("gumbelmaxout.txt");
};

    mu = 9.02;    //continuous location parameter
    sigma = 1.1659; //continuous scale parameter
    var outfile = fs.createWriteStream('gumbelmaxout.txt');
    for(var x = 0; x < 100000; x++) {

        //creates a random sample in the range 6 < x < 23, following
        //the Gumbel Max distribution with mu, sigma
        p = randgen.runif(0,1,false);
        sample = mu - sigma * Math.log(-1 * Math.log(p));
        outfile.write(sample + '\r\n');
    }
    outfile.end(function(){
        //create an array of records from the list of values from gumbelmaxout
        var rec=tools.createArrayOfRecords();
       //insert records into mongo
        tools.addToMongo(rec,'mongodb://localhost/test');
    });
    
