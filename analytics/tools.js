var fs = require('fs');
var randgen = require('randgen');
var mongoose = require('mongoose');

module.exports={
    createArrayOfRecords: function(){
            //Read from the newly created output file and store each entry into an array
            var distributionArray =fs.readFileSync('./gumbelmaxout.txt','utf8').toString().split("\r\n");
            //This handles the case for the very last newline character
            if(distributionArray[distributionArray.length-1]===""){
                distributionArray.pop();
            }
            //Get actual date values and set the start and end times for the day
            var startDate = new Date();
            var realDate = new Date();
            startDate.setHours(0,0,0,0);
            var counter = new Date(startDate.getTime());
            startDate/=1000;
            var endDate = new Date();
            endDate.setHours(23,59,59,0);
            endDate/=1000;
            
            //Get the range of values to create the array of seconds for the entire day
            var range =(endDate-startDate)+1;
            //Use the start date as the offset into the time index array
            var offset = startDate;

            /*Create time array and set its length to the previously found
            range; fill the array with zeroes  */
            var timeIndexArray = [];
            timeIndexArray.length=range;
            timeIndexArray.fill(0);

                for (var index = 0; index < distributionArray.length; index++) {
                    var element = distributionArray[index];
                    parseFloat(element);
                    var second = Math.floor(Math.random()*59);
                    var hour = Math.floor(element);
                    var minute = Math.floor((element - Math.floor(element))*59);

                    //create new Date Object with these generated values
                    var dateToBeInserted = new Date();
                    dateToBeInserted.setHours(hour,minute,second,0);
                    dateToBeInserted/=1000;
                    //calculate new offset for the time index array and increment the value at that offset
                    var offsetIndex = dateToBeInserted-offset;
                    timeIndexArray[offsetIndex]+=1;
                };
                console.log(timeIndexArray.indexOf(1));

            //create record collection
            var recordArray = [];
            recordArray.length=range;
                //fill the record array with instances of records
                for(var i = 0; i < recordArray.length; i++) {
                    recordArray[i] = {
                    "timestamp":0,
                    "event": "QueueSummary",
                    "queue": "ComplaintsQueue",
                    "loggedin": 0,
                    "available": 0,
                    "callers": 0,
                    "holdtime": 0,
                    "longestholdtime": 0
                };
                    counter.setSeconds(counter.getSeconds() + 1)
                    recordArray[i].timestamp=counter.getTime();
                    recordArray[i].callers=timeIndexArray[i];
                    
                }
            return recordArray;

    },
    addToMongo:function(arrayOfRecords,serverPath){
        //open a connection to the test database
        mongoose.connect(serverPath);
        //notifies a successful connection
        var db = mongoose.connection;
        db.on('error', console.error.bind(console, 'connection error:'));
        db.once('open', function() {
            // we're connected!
            var collectionName = "records";
            //insert recordArray into the database
            db.collection("records").insert(arrayOfRecords,function(){
                db.close();
                console.log('Done.');
            });
            // var dbItems = db.collection("records").find();
            // var iterator = 0;
            // var minute=1;
            // var avg=0;
            // var sum=0;
            // //open a file stream to output the averages to
            // if(fs.existsSync('averageCallsPerMin.txt')){
            //     fs.unlink('averageCallsPerMin.txt');
            // }
            // var avgFile=fs.createWriteStream('averageCallsPerMin.txt');
            // dbItems.forEach(function(item){
            //     if(iterator==60){
            //         avg=sum/60;
            //         avgFile.write("Minute: "+minute+ " Average: "+avg+'\n');
            //         sum=0;
            //         avg=0;
            //         iterator=0;
            //         minute++;
            //     }
            //     sum+=item.callers;
            //     iterator++;
            // });
        });
    }
}