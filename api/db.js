import { createRequire } from 'module';
import { v4 as uuidv4 } from 'uuid';
import { config } from './config-api.js';

const require = createRequire(import.meta.url);

const { Readable } = require("stream")
const AWS = require('aws-sdk');
AWS.config.getCredentials((err) => {
    if (err) console.log(err.stack);
    else {
        console.log("Access key:", AWS.config.credentials.accessKeyId);
    }
});

AWS.config.update({region: 'us-east-1'});
// toDo: add exponential backoff to dynamo requests



class DataAccess {
    ddb = new Dynamo();
    s3 = new S3();

    expiresFromCurrentTime = () => Math.round((Date.now() + 86400) / 1000).toString();

    getProject = (id) => {
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
            this.ddb.query(params, (err, data) => {
                if(err) {
                    reject(err);
                }else{
                    try{
                        let found = false;
                        for (const i of data.Items){
                            if (i.LoopID.S === config.newLoopIdentifier){
                                found = true;
                            }else{
                                i.audio = this.s3.retreiveAudio(i.s3loc.S);
                            }
                        }
                        if (!found)
                            reject(Error('Bad loop - no initial loop found...'));
                        else 
                            resolve(data.Items);
                    }catch (err){
                        console.log(err);
                        reject(err);
                    }
                }
            });
        });
    };

    getTrack = (pjid, lpid) => {
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
            this.ddb.getItem(params, (err, data) => {
                if (err) reject(err)
                else {
                    let records = data.Responses['looper-development'];
                    if (records.length === 0) {
                        reject('Loop does not exist');
                    }else{
                        let t = data.Responses['looper-development'][0];
                        t.audio = this.s3.retreiveAudio(t.s3loc.S);
                        resolve(t);
                    }
                }
            });
        });
    };

    newProject = () => {
        return new Promise((resolve, reject) => {
            let ProjectID = uuidv4(),
                expires = this.expiresFromCurrentTime();
            let params = {
                TableName: config.dynamodb.looper_table,
                Item: {
                    'ProjectID': {S: ProjectID},
                    'LoopID': {S:config.newLoopIdentifier},
                    'expires': {N:expires},
                },
            };
            this.ddb.putItem(params, (err, data) => {
                if (err) reject(err); // an error occurred
                else resolve({
                    'ProjectID': ProjectID,
                    'expires':expires,
                });
            });
        });
    };

    putTrack = (projectID, name, metadata, audio) => {
        // store track in s3
        return new Promise((resolve, reject) => {
            let s3loc = uuidv4(); // toDo: change this
            let params = {
                TableName: config.dynamodb.looper_table,            
                Item: {
                    'ProjectID': {S: projectID},
                    LoopID: {S: name},
                    expires: {N: this.expiresFromCurrentTime()},
                    's3loc': {S: s3loc},
                },
            };
            if (Object.keys(metadata).length > 0){
                params.Item['metadata'] = {M: metadata};
            }

            this.ddb.putItem(params, (err, data) => {
                if (err) reject(err)
                else {
                    this.s3.storeAudio(s3loc, audio)
                    .then(() =>resolve(data))
                    .catch((err) => reject(err));
                }
            });
        });
    };
}

class Dynamo {
    ddb = new AWS.DynamoDB({apiVersion: '2012-08-10'});
    debug = true;

    putItem = (params, cont) => {
        if (this.debug) console.log(JSON.stringify(params));
        this.ddb.putItem(params, cont);
    };

    query = (params, cont) => {
        if (this.debug) console.log(JSON.stringify(params));
        this.ddb.query(params, cont);
    };

    getItem = (params, cont) => {
        if (this.debug) console.log(JSON.stringify(params));
        this.ddb.GetItem(params, cont);
    };
}

class S3 {
    s3 = new AWS.S3({apiVersion: '2006-03-01'});

    storeAudio(key, audio){
        return new Promise((resolve, reject) => {
            let uploadParams = {Bucket: config.audioBucket, Key: key, Body: JSON.stringify(audio)};
            this.s3.upload (uploadParams, (err, data) => {
                if (err) reject(err);
                else resolve(data);
            });
        });
    }

    retreiveAudio(key){
        return new Promise((resolve, reject) => {
            let params = {Bucket: config.audioBucket, Key: key};
            this.s3.getObject(params, (err, data) => {
                if (err) reject(err); // an error occurred
                else resolve(data); 
            });
        });
    }
}


export {DataAccess};