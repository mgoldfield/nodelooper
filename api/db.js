import { createRequire } from 'module';
import { v4 as uuidv4 } from 'uuid';
import { config } from './config-api.js';

const require = createRequire(import.meta.url);

const AWS = require('aws-sdk');
AWS.config.getCredentials(function(err) {
    if (err) console.log(err.stack);
    else {
        console.log("Access key:", AWS.config.credentials.accessKeyId);
    }
});

AWS.config.update({region: 'us-east-1'});
// Create the DynamoDB service object
// toDo: add exponential backoff to dynamo requests
// toDo: class-ify
var ddb = new AWS.DynamoDB({apiVersion: '2012-08-10'});

let expiresFromCurrentTime = () => Math.round((Date.now() + 86400) / 1000).toString();

let putItem = (params, cont, debug=false) => {
    if (debug) console.log(JSON.stringify(params));
    ddb.putItem(params, cont);
}

let query = (params, cont, debug=true) => {
    if (debug) console.log(JSON.stringify(params));
    ddb.query(params, cont);
}

let getProject = (id) => {
    // no need to sanitize because we're not parsing the data...
    return new Promise((resolve, reject) => {
        let params = {
            TableName: config.dynamodb.looper_table,
            KeyConditionExpression: 'ProjectID = :pjid',
            ExpressionAttributeValues: {
                ":pjid": {S:id},
            },
        };
        console.log("querying...");
        query(params, (err, data) => {
            if(err) {
                reject(err);
            }else{
                try{
                    let found = false;
                    for (const i of data.Items){
                        console.log("data item: %s", i.LoopID.S);
                        if (i.LoopID.S === config.newLoopIdentifier){
                            // todo: retreive from s3
                            resolve(data.Items);
                            found = true;
                            break;
                        }
                    }
                    if (!found)
                        reject(Error('Bad loop - no initial loop found...'));
                }catch (err){
                    console.log(err);
                    reject(err);
                }
            }
        });
    });
};

let getTrack = (pjid, lpid) => {
    //toDo: retreive from s3
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
            TableName: config.dynamodb.looper_table,
        };        
        ddb.GetItem(params, function(err, data) {
            if (err) reject(err)
            else {
                let records = data.Responses['looper-development'];
                if (records.length === 0) {
                    reject('Loop does not exist');
                }else{
                    resolve(data.Responses['looper-development'][0]);
                }
            }
        });
    });
};

let newProject = () => {
    return new Promise((resolve, reject) => {
        let ProjectID = uuidv4(),
            expires = expiresFromCurrentTime();
        let params = {
            TableName: config.dynamodb.looper_table,
            Item: {
                'ProjectID': {S: ProjectID},
                'LoopID': {S:config.newLoopIdentifier},
                'expires': {N:expires},
            },
        };
        putItem(params, function(err, data) {
            if (err) reject(err); // an error occurred
            else resolve({
                'ProjectID': ProjectID,
                'expires':expires,
            });
        });
    });
};

let putTrack = (projectID, name, metadata, audio) => {
    // store track in s3
    return new Promise((resolve, reject) => {
        let params = {
            TableName: config.dynamodb.looper_table,            
            Item: {
                'ProjectID': {S: projectID},
                LoopID: {S: name},
                expires: {N: expiresFromCurrentTime()},
                audio: {M: audio},
            },
        };
        if (Object.keys(metadata).length > 0){
            params.Item['metadata'] = {M: metadata};
        }

        putItem(params, function(err, data) {
            if (err) reject(err); 
            else resolve(data);
        });
    });
};


export {
    getProject, 
    getTrack, 
    newProject, 
    putTrack, 
};