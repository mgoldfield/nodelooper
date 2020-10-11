import { createRequire } from 'module';
import { v4 as uuidv4 } from 'uuid';
import { config } from './config.js';

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
let db_client = new AWS.DynamoDB.DocumentClient();
let dynamodb = new AWS.DynamoDB({apiVersion: '2012-08-10'});

let expiresFromCurrentTime = () => (Date.now() + 86400).toString();

// toDo: add exponential backoff
let getProject = (id) => {
    // no need to sanitize because we're not parsing the data...
    let params = {
        TableName: 'looper-development',
        KeyConditionExpression: '#pj = :pjid',
        ExpressionAttributeNames: {
            '#pj': 'ProjectID',
        },
        ExpressionAttributeValues: {
            ":pjid": id,
        }
    };
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


let getLoop = (pjid, lpid) => {
    let params = {
        RequestItems: {
            'looper-development': {
                Keys: [{
                    'ProjectID': {
                        S: pjid,
                    }, 
                    'LoopID': {
                        S: lpid,
                    },
                }], 
            }
        }
    };
    return new Promise((resolve, reject) => {
        dynamodb.batchGetItem(params, function(err, data) {
            if (err) reject(err, err.stack)
            else resolve(data);
        });
    });
};

let newProject = () => {
    let projectID = uuidv4();
    let params = {
        Key: {
            'ProjectID': {
                S: projectID,
            },
            'LoopID': {
                S: 'newloop',
            }
        },
        TableName: config.dynamodb.looper_table,
        AttributeUpdates: {
            expires: {
                Action: 'ADD',
                Value: {
                    N: expiresFromCurrentTime(),
                }
            }
        }
    };
    return new Promise((resolve, reject) => {
        dynamodb.updateItem(params, function(err, data) {
            if (err) reject(err, err.stack); // an error occurred
            else     resolve(projectID);
        });
    });
};













export {getProject, getLoop, newProject}