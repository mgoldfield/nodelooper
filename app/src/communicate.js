import config from './config-app.js'
import {bufferToMp3} from './format_tools.js'

const http = require('http');
const https = require('https');

class Communication {
    msgDivider = '|||';
    LoopHeaderID = 'xxxLOOPxxx';

    constructor(project_id, looper) {
        this.looper = looper;
        this.project_id = project_id;
    }

    get getHttp(){
        if (config.env === 'PROD'){
            return https;
        }else{
            return http;
        }
    }

    initProject() {
        return new Promise((resolve, reject) => {
            try{
                let callback = (response) => {
                    if (response.statusCode !== 200){
                        reject(Error('Bad status code: ' + response.statusCode));
                        return;
                    }

                    let json = '';

                    //another chunk of data has been received, so append it to `str`
                    response.on('data', (chunk) => {
                        json += chunk;
                    });

                    //the whole response has been received, so we just print it out here
                    response.on('end', () => {
                        let loop_response = JSON.parse(json);
                        // toDo: fail more gracefully here if the loop doesn't exist

                        if (!loop_response) {
                            reject(Error('loop does not exist'));
                            return;
                        }
                        this.user = loop_response.user;
                        this.socket = new WebSocket(config.ws_url, this.project_id + ":" + this.user);
                        this.socket.addEventListener('open', () => console.log("connection open"));
                        this.socket.addEventListener('message', this.handleMsg);
                        for (const c of loop_response.data.chat){ // toDo: make this less brittle
                            this.handleRcvdChat(c.msg.S.split(this.msgDivider)[1]);                        
                        }
                        resolve(loop_response.data.loopData);
                    });
                }
                let url = ((config.env==='PROD') ? 'https://' : 'http://');
                url += config.api.url + ':' + config.api.port + config.api.path;
                url += '/loop?ProjectID=' + this.project_id
                this.getHttp.get(url, callback).end();
            }catch(e){
                reject(e);
            }
        });
    }

    handlePing = () => {
        if (this.last_ping && Date.now() - this.last_ping > 60000){
            alert("Server connection lost :(. Reloading page to regain connection...");
            window.location.reload();
        } 
        this.last_ping = Date.now();
    }

    handleMsg = (msg) => {
        if (msg.data === 'ping'){  // for some reason it doesn't fire an event on a 'ping'...?
            this.handlePing();
            return;
        }

        let parts = msg.data.split(this.msgDivider);
        if (parts.length !== 2)
            throw Error("malformed message " + parts.toString());

        let headers = parts[0],
            body = parts[1];

        if (headers === 'C'){ // chat
            this.handleRcvdChat(body);
        }else if (headers === 'N'){ // new loop
            this.handleRcvdLoop(body);
        }else if (headers === 'D'){ // delete loop
            this.looper.deleteLoop(body, false);
        }else if (headers === 'UM'){// update metadata
            let new_data = JSON.parse(body);
            this.looper.updateMetadata(new_data);
        }else{
            throw Error("malformed message: " + msg);
        }
    }

    handleRcvdChat = (msg) => {
        this.looper.updateChat(msg);
    }

    sendChat = (msg) => {
        this.socket.send('C' + this.msgDivider + msg);
    }

    postDataToApi(data, endpoint){
        return new Promise((resolve, reject) => {
            let options = {
                hostname: config.api.url,
                port: config.api.port,
                path: config.api.path + '/' + endpoint,
                method: 'POST',
                headers: {
                'Content-Type': 'application/json',
                'Content-Length': data.length
                }
            };
            let req = this.getHttp.request(options, res => {
                if (res.statusCode !== 200){
                    console.log("post data status code: %s", res.statusCode);
                    reject("bad status code from api");
                }
                let response_data = '';
                res.on('data', d => {
                    response_data += d;
                });

                res.on('end', () => resolve(response_data));
            });

            req.on('error', error => {
                reject(error);
            });

            req.write(data);
            req.end();
        });
    }

    handleRcvdLoop(loop_id){  // get new loop received from other users
        let postdata = JSON.stringify({
            ProjectID: this.project_id,
            LoopID: loop_id,
        });
        this.postDataToApi(postdata, 'getTrack')
        .then((l) => {
            l = JSON.parse(l);
            this.looper.counter++;
            this.looper.setState({'processing': true});
            this.looper.loadLoopFromDynamoData(l); 
            console.log("received new loop");
            console.log(l);
        }).catch((e) => {throw e});
    }

    sendMsg(msg) {
        this.socket.send(msg);
    }

    sendLoop = async (loop) => { // send
        let postdata = {
            'ProjectID': this.project_id,
            'userID': this.user,
            'name': loop.id,
            'metadata': loop.getMetadata(),
        };

        if (config.lossyCompress) {
            postdata.audio = {
                format:'mp3',
                data: await bufferToMp3(loop.buffer),
            }
            this.looper.setState({'processing': false});
        }else{
            postdata.audio = {
                format:'raw',
                L: Buffer.from(loop.buffer.getChannelData(0).buffer).toString('base64'),
                R: Buffer.from(loop.buffer.getChannelData(1).buffer).toString('base64'),
            };
        }

        postdata = JSON.stringify(postdata);
        this.postDataToApi(postdata, 'addTrack').catch((e) => {throw(e)});
    }

    broadcastMetadata(id, metadata){
        let data = JSON.stringify({
            ProjectID: this.project_id,
            LoopID: id,
            metadata: metadata
        });
        this.socket.send('UM' + this.msgDivider + data);
    }

    deleteLoop(id) {
        let postdata = JSON.stringify({
            ProjectID: this.project_id,
            LoopID: id,
        });
        this.postDataToApi(postdata, 'deleteTrack');      
    }
}

export { Communication };