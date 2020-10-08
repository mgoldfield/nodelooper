import { createRequire } from 'module';
const require = createRequire(import.meta.url);

//set up AWS
const AWS = require('aws-sdk');
AWS.config.getCredentials(function(err) {
    if (err) console.log(err.stack);
        // credentials not loaded
    else {
        console.log("Access key:", AWS.config.credentials.accessKeyId);
    }
});
AWS.config.update({region: 'us-east-1'});


let params = {
    TableName: 'looper-development',
    KeyConditionExpression: '#pj = :pjid',
    ExpressionAttributeNames: {
        '#pj': 'ProjectID',
    },
    ExpressionAttributeValues: {
        ":pjid": 'placeholder',
    }
};

let db_client = new AWS.DynamoDB.DocumentClient();
let getProject = (id) => {
	// toDo: add exponential backoff
	// no need to sanitize because we're not parsing the data...
	params['ExpressionAttributeValues'][':pjid'] = id;

	return new Promise((resolve, reject) => {
		db_client.query(params, (err, data) => {
	        if(err) {
	        	console.log(err);
	        	reject(err);
	        }else{
	            resolve(data);
	        }
	    });
	});
};    

export {getProject}