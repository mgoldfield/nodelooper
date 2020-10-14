import { createRequire } from 'module';
import { v4 as uuidv4 } from 'uuid';
import { config } from './config.js';
import { newq, Message } from './rabbit.js';

const require = createRequire(import.meta.url);

//set up AWS
const AWS = require('aws-sdk');
AWS.config.getCredentials(function(err) {
    if (err) console.log(err.stack);
    else {
        console.log("Access key:", AWS.config.credentials.accessKeyId);
    }
});

// toDo: is this right to have localhost?? 
AWS.config.update({region: 'us-east-1', endpoint: "http://localhost:8000"});
let db_client = new AWS.DynamoDB.DocumentClient();

let expiresFromCurrentTime = () => Math.round((Date.now() + 86400) / 1000).toString();

// toDo: add exponential backoff
let getProject = (id) => {
    // no need to sanitize because we're not parsing the data...
    return new Promise((resolve, reject) => {
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
        db_client.query(params, (err, data) => {
            if(err) {
                reject(err);
            }else{
                resolve(data.Items);
            }
        });
    });
};


let getTrack = (pjid, lpid) => {
    return new Promise((resolve, reject) => {
        let params = {
            Key: [{
                'ProjectID': {
                    S: pjid,
                }, 
                'LoopID': {
                    S: lpid,
                },
            }],             
            TableName:'looper-development',
        };        
        db_client.GetItem(params, function(err, data) {
            if (err) reject(err)
            else {
                let records = data.Responses['looper-development'];
                if (records.length === 0) {
                    reject('Loop does not exist');
                }else{
                    resolve(data.Responses['looper-development'][0].audio.B);
                }
            }
        });
    });
};

let newProject = () => {
    return new Promise((resolve, reject) => {
        let projectID = uuidv4();
        newq().then((q) => {
            let params = {
                TableName: config.dynamodb.looper_table,
                Item: {
                    'ProjectID': projectID,
                    'LoopID': 'xxxLOOPxxx',
                    'expires': expiresFromCurrentTime(),
                    'metadata': {
                        queue: q,
                    }

                },
            };
            db_client.put(params, function(err, data) {
                if (err) reject(err); // an error occurred
                else resolve({
                    'ProjectID': ProjectID,
                    'Queue': q,
                    'data': data,
                });
            });
        });
    });
};


let putTrack = (projectID, name, metadata, audio, q) => {
    return new Promise((resolve, reject) => {
        let params = {
            Key: {
                'ProjectID': {
                    S: projectID,
                },
                'LoopID': {
                    S: name,
                }
            },
            TableName: config.dynamodb.looper_table,
            AttributeUpdates: {
                expires: {
                    Action: 'ADD',
                    Value: {
                        N: expiresFromCurrentTime(),
                    }
                },
                'metadata': {
                    Action: 'ADD',
                    Value: {
                        M: metadata,
                    }
                },
                audio: {
                    Action: 'ADD',
                    Value: {
                        B: audio, 
                    }
                },
            },
        };
        db_client.updateItem(params, function(err, data) {
            if (err) reject(err); 
            else {
                let msg = new Message(q, metadata.toString(), 'newLoop');
                msg.send().catch((err) => reject(err));
                resolve(data);
            }
        });
    });
};

export {getProject, getTrack, newProject, putTrack}