import { createRequire } from 'module';
import { v4 as uuidv4 } from 'uuid';
import { config } from './config-api.js';

//toDo: move rabbit stuff out of db.js and up a level into api.js so shit is less confusing
import { newq, Message, addRabbitUser } from './rabbit.js';

const require = createRequire(import.meta.url);

//set up AWS
const AWS = require('aws-sdk');
AWS.config.getCredentials(function(err) {
    if (err) console.log(err.stack);
    else {
        console.log("Access key:", AWS.config.credentials.accessKeyId);
    }
});

AWS.config.update({region: 'us-east-1'});
// toDo: add exponential backoff to dynamo requests
let db_client = new AWS.DynamoDB.DocumentClient();

let expiresFromCurrentTime = () => Math.round((Date.now() + 86400) / 1000).toString();
let newLoopIdentifier = 'xxxLOOPxxx';

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
                try{
                    for (const i of data.Items){
                        let found = false;
                        if (i.LoopID === newLoopIdentifier){
                            newRabbitUser(i.metadata.queue).then((credentials) => {
                                resolve({
                                    loops: data.Items,
                                    rabbitCreds: credentials,
                                });
                            }).catch((err) => reject(err))
                            found = true;
                            break;
                        }
                        if (!found)
                            reject(Error('Bad loop - no initial loop found...'));
                    }
                    resolve(data.Items);
                }catch (err){
                    console.log(err);
                    reject(err);
                }
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
        let ProjectID = uuidv4();
        newq().then((q) => {
            let params = {
                TableName: config.dynamodb.looper_table,
                Item: {
                    'ProjectID': ProjectID,
                    'LoopID': newLoopIdentifier,
                    'expires': expiresFromCurrentTime(),
                    'metadata': {
                        queue: q,
                    }
                },
            };
            db_client.put(params, function(err, data) {
                if (err) reject(err); // an error occurred
                else {
                    newRabbitUser(q)
                    .then((credentials) => {
                        resolve({
                            'ProjectID': ProjectID,
                            'Queue': q,
                            'RabbitCreds': credentials,
                        });
                    })
                    .catch((err) => reject(err));
                }
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


// log queues and users for future deletion via lambda
let newRabbitUser = (username) => {
    return new Promise((resolve, reject) => {
        let params = {
            Key: {
                'name': {
                    S: username,
                },
            },
            TableName: 'config.dynamodb.looper-rabbit',
            AttributeUpdates: {
                expires: {
                    Action: 'ADD',
                    Value: {
                        N: expiresFromCurrentTime(),
                    }
                },
                'type': {
                    Action: 'ADD',
                    Value: {
                        S: 'user',
                    }
                },            },
        };
        db_client.updateItem(params, function(err, data) {
            if (err) {
                console.log(err);
                reject(err); 
            } else {
                resolve(data);
            }
        });
    });
};

let newRabbitQueue = (queue) => {
    return new Promise((resolve, reject) => {
        let params = {
            Key: {
                'name': {
                    S: queue,
                },
            },
            TableName: 'config.dynamodb.looper-rabbit',
            AttributeUpdates: {
                expires: {
                    Action: 'ADD',
                    Value: {
                        N: expiresFromCurrentTime(),
                    }
                },
                'type': {
                    Action: 'ADD',
                    Value: {
                        S: 'queue',
                    }
                },            },
        };
        db_client.updateItem(params, function(err, data) {
            if (err) {
                console.log(err);
                reject(err); 
            } else {
                resolve(data);
            }
        });
    });
};

export {
    getProject, 
    getTrack, 
    newProject, 
    putTrack, 
    newRabbitUser, 
    newRabbitQueue
};