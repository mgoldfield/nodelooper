import AWS from 'aws-sdk';
import { v4 as uuidv4 } from 'uuid';
import { config } from './config-api.js';

AWS.config.update({region: config.aws.region});
AWS.config.getCredentials((err) => {
    if (err) console.log(err.stack);
    else {
        console.log("Access key:", AWS.config.credentials.accessKeyId);
    }
});

if (config.env == 'DEV') AWS.config.logger = console;
// toDo: add exponential backoff to dynamo requests


let expiresFromCurrentTime = () => (Math.round(Date.now() / 1000) + parseInt(config.project_persist)).toString();  // 5 days


class DataAccess {
    ddb = new Dynamo();
    s3 = new S3();

    current_projects = {}

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
            this.ddb.query(params, async (err, data) => {
                console.log(JSON.stringify(data));
                if(err) {
                    reject(err);
                }else{
                    try{
                        if (!Object.keys(this.current_projects).includes(id))
                            this.current_projects[id] = data.Items.length;

                        let found = false;
                        for (const i of data.Items){
                            console.log(i);
                            if (i.LoopID.S === config.newLoopIdentifier){
                                found = true;
                            }else{
                                // toDo - make this parallel
                                if (i.s3loc) // deal with error if it wasn't stored 
                                    i.audio = await this.s3.retreiveAudio(i.s3loc.S);   
                            }
                        }
                        let chat = await this.getChat(id);
                        if (!found)
                            reject(Error('Bad loop - no initial loop found...'));
                        else {
                            resolve({'loopData': data.Items, 'chat': chat.Items});
                        }
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
                Key: {
                    ProjectID: { S: pjid },
                    LoopID: { S: lpid }
                },
                TableName: 'looper-development',
                ConsistentRead: true,
            }; 
            this.ddb.getItem(params, (err, data) => {
                if (err) reject(err)
                else {
                    let t = data.Item;
                    this.s3.retreiveAudio(t.s3loc.S).then((audio) => {
                        t.audio = audio;
                        resolve(JSON.stringify(t));
                    }).catch((e) => reject(e));
                }
            });
        });
    };

    deleteTrack = (pjid, lpid) => {
        //toDo: retreive from s3
        return new Promise((resolve, reject) => {
            let params = {
                Key: {
                    ProjectID: { S: pjid },
                    LoopID: { S: lpid }
                },
                TableName: 'looper-development',
            }; 
            this.ddb.deleteItem(params, (err, data) => {
                if (err) reject(err)
                else resolve('ok');
            });
        });
    };

    newProject = () => {
        return new Promise((resolve, reject) => {
            let ProjectID = uuidv4(),
                expires = expiresFromCurrentTime();
            let params = {
                TableName: config.dynamodb.looper_table,
                Item: {
                    'ProjectID': {S: ProjectID},
                    'LoopID': {S:config.newLoopIdentifier},
                    'expires': {N:expires},
                    'metadata': {M: {tempo:{N:'80'}}}
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

    putTrack = (projectID, name, metadata, audio, expires) => {
        function sanitizeData(metadata, audio, projectID, name){
            return metadata;

            //todo: test this and implement it:

            if (audio.format === 'mp3'){
                if (audio.data.length > 10000000){
                    return false;
                }
            }else{
                return false; // currently not allowing 'raw' files
            }

            if (projectID.length > 36 || name.length > 36){
                return false;
            }

            let newmetadata = {};

            newmetadata['maxRepeats'] = {N: metadata.maxRepeats.N.slice(0,4)};
            newmetadata['delayedStart'] = {N: metadata.delayedStart.N.slice(0,4)}
            newmetadata['muted'] = {BOOL: metadata.muted.BOOL.slice(0,5)}
            newmetadata['looping'] = {BOOL: metadata.looping.BOOL.slice(0,5)}
            newmetadata['name'] = {S: metadata.name.S.slice(0,200)}
            newmetadata['gain'] = {N: metadata.gain.N.slice(0,4)}
            newmetadata['length'] = {N: metadata.length.N.slice(0,20)}
            newmetadata['sampleRate'] = {N: metadata.sampleRate.N.slice(0,10)}
            newmetadata['numberOfChannels'] = {N: metadata.numChannels.N.slice(0,4)}
            newmetadata['tempo'] = {N: metadata.tempo.N.slice(0,4)}

            console.log(JSON.stringify(metadata));
            console.log(JSON.stringify(newmetadata))

            return newmetadata;
        }

        // store track in s3
        return new Promise((resolve, reject) => {
            let newmetadata = sanitizeData(metadata, audio, projectID, name);
            if (!newmetadata)
                reject("bad loop data");

            if (this.current_projects[projectID] >= 50)
                reject("too many tracks in project");
            else
                this.current_projects[projectID]++;

            let s3loc = uuidv4(); // toDo: change this
            let params = {
                TableName: config.dynamodb.looper_table,            
                Item: {
                    'ProjectID': {S: projectID},
                    LoopID: {S: name},
                    expires: {N: expires},
                    's3loc': {S: s3loc},
                },
            };
            if (Object.keys(metadata).length > 0){
                params.Item['metadata'] = {M: newmetadata};
            }

            this.ddb.putItem(params, async (err, data) => {
                if (err) reject(err)
                else {
                    await this.s3.storeAudio(s3loc, audio);
                    resolve();
                }
            });
        });
    };

    getChat = (projectID) => {
        return new Promise((resolve, reject) => {
            let params = {
                TableName: config.dynamodb.chat_table,
                KeyConditionExpression: 'ProjectID = :pjid',
                ExpressionAttributeValues: {
                    ":pjid": {S:projectID},
                },
                //ProjectionExpression: 'msg, timestamp',
            };    

            console.log("getting chat:....");
            console.log(params);
            this.ddb.query(params, async (err, data) => {
                if (err) reject(err)
                else resolve(data);
            });       
        })
    }
}


class SocketHelpers {
    ddb = new Dynamo();

    registerUser(pjid, uid, expires){
        return new Promise( (resolve, reject) => {
            let params = {
                TableName: config.dynamodb.socket_ids,
                Item: {
                    projectid: {S: pjid},
                    id: {S: uid},
                    expires: {N: expires},
                }
            }
            this.ddb.putItem(params, (err, data) => {
                if (err) reject(err)
                else resolve(data)
            });
        });
    }

    getLiveProjects(){
        return new Promise ((resolve, reject) => {
            let params = {
                TableName: config.dynamodb.socket_ids,
            }
            this.ddb.scan(params, (err, data) => {
                if (err) reject(err)
                else resolve(data.Items)
            })
        })
    }

    putChat(projectID, expires, msg) {
        // store track in s3
        return new Promise((resolve, reject) => {
            let params = {
                TableName: config.dynamodb.chat_table,            
                Item: {
                    'ProjectID': {S: projectID},
                    timestamp: {N: Date.now().toString()},
                    expires: {N: expires},
                    'msg': {S: msg},
                },
            };
            this.ddb.putItem(params, (err, data) => {
                if (err) reject(err)
                else {
                    resolve(data);
                }
            });
        });
    };

    updateMetadata(data){
        return new Promise((resolve, reject) => {
            let params = {
                TableName: config.dynamodb.looper_table,
                Key: {
                    ProjectID: {S: data.ProjectID},
                    LoopID: {S: data.LoopID},
                },
                UpdateExpression: "set metadata = :m",
                ExpressionAttributeValues: {
                    ":m": { M: data.metadata }
                }
            }
            console.log("updating metadata....")
            console.log(params);
            console.log(JSON.stringify(params));
            this.ddb.updateItem(params, (err, data) => {
                if (err) reject(err)
                else resolve(data)
            })
        })
    }
}

class Dynamo {
    ddb = new AWS.DynamoDB({apiVersion: '2012-08-10'});

    putItem = (params, cont) => {
        this.ddb.putItem(params, cont);
    };

    query = (params, cont) => {
        this.ddb.query(params, cont);
    };


    // toDo: standardize/modularize exponential backoff
    getItem = (params, cont, tries=0) => {
        let backoff_cont = (err, data) => {
            if (err && tries < config.dynamodb.backoff_tries){
                setTimeout(() => this.getItem(params, cont, tries + 1), (2**tries) * 1000);
            }else{
                cont(err, data);
            }
        }

        this.ddb.getItem(params, backoff_cont);
    };

    deleteItem = (params, cont, tries=0) => {
        let backoff_cont = (err, data) => {
            if (err && tries < config.dynamodb.backoff_tries){
                setTimeout(() => this.deleteItem(params, cont, tries + 1), (2**tries) * 1000);
            }else{
                cont(err, data);
            }
        }

        this.ddb.deleteItem(params, backoff_cont);
        // toDo: delete from s3 too... not worrying about this now since it autodeletes
    };    

    scan = (params, cont) => {
        this.ddb.scan(params, cont);
    }

    updateItem = (params, cont, tries=0) => {
        let backoff_cont = (err, data) => {
            if (err && tries < config.dynamodb.backoff_tries){
                console.log(err);
                setTimeout(() => this.updateItem(params, cont, tries + 1), (2**tries) * 1000);
            }else{
                cont(err, data);
            }
        }

        this.ddb.updateItem(params, backoff_cont);
    };  
}

class S3 {
    s3 = new AWS.S3({apiVersion: '2006-03-01'});

    storeAudio(key, audio){
        return new Promise((resolve, reject) => {
            let uploadParams = {Bucket: config.s3.audioBucket, Key: key, Body: JSON.stringify(audio)};
            this.s3.upload (uploadParams, (err, data) => {
                if (err) reject(err);
                else resolve(data);
            });
        });
    }

    retreiveAudio(key, tries=0){
        return new Promise((resolve, reject) => {
            let params = {Bucket: config.s3.audioBucket, Key: key};
            this.s3.getObject(params, (err, data) => {
                if (err) {
                    if (err.code == 'NoSuchKey' && tries < config.s3.backoff_tries) {
                        console.log('retrying %s', params);
                        setTimeout(
                            () => this.retreiveAudio(key, tries + 1).then(d => resolve(d)).catch(e=>reject(e)),
                            (2**tries) * 1000);
                    }else{
                        reject(err); // an error occurred
                    }
                }
                else {
                    resolve(data.Body.toString('utf-8')); 
                }
            });
        });
    }
}


export { DataAccess, SocketHelpers };
