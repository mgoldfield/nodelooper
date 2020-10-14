import { createRequire } from 'module';
import { v4 as uuidv4 } from 'uuid';
import { config } from './config.js';
import { newq } from './rabbit.js';

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
                resolve(data);
            }
        });
    });
};


let getTrack = (pjid, lpid) => {
    return new Promise((resolve, reject) => {
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
        dynamodb.batchGetItem(params, function(err, data) {
            if (err) reject(err, err.stack)
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
                    },
                    metadata: {
                        Action: 'ADD',
                        Value: {
                            M: {
                                queue: q,
                            }
                        }
                    },
                }
            };
            dynamodb.updateItem(params, function(err, data) {
                if (err) reject(err, err.stack); // an error occurred
                else     resolve({
                    'ProjectID': ProjectID,
                    'Queue': q,
                    'data': data,
                });
            });
        });
    });
};


let putTrack = (projectID, name, metadata, audio) => {
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
        dynamodb.updateItem(params, function(err, data) {
            if (err) reject(err, err.stack); // an error occurred
            else     resolve(data);
        });
    });
};

export {getProject, getTrack, newProject, putTrack}