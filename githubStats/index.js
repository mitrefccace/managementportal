var express = require('express'),
    mysql   = require('mysql'),
    https   = require('https'),
    github = require('octonode'),
    request = require('request');

  request('http://www.google.com', function (error, response, body) {
  console.log('error:', error); // Print the error if one occurred
  console.log('statusCode:', response && response.statusCode); // Print the response status code if a response was received
  console.log('body:', body); // Print the HTML for the Google homepage.
});



// //Connect nodejs to mysql database
// var connection = mysql.createConnection({
//     host:"localhost",
//     user:"root",
//     password:"Billiejean1",
//     database:"githubStats"
// });
// connection.connect(function(err) {
//   if (err) throw err;
//   console.log("Connected!");
//   connection.query("CREATE DATABASE IF NOT EXISTS githubStats", function (err, result) {
//         if (err) throw err;
//         var sql = "CREATE TABLE customers (name VARCHAR(255), address VARCHAR(255)";
//     });
// });
//Create a schema for mysql database
//set up database

//Connect to github API
    //loop
        //get all of the information we want
        //store this information to the mysql database
            //check if the information already exists in the database
                //if it does update it
                //else put it in there
        
        

