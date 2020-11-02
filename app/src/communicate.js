import config from './config-app.js'

const http = require('http');
// toDo: aac with const Fdkaac = require("node-fdkaac").Fdkaac


class Communication {
    msgDivider = '|||';
    LoopHeaderID = 'xxxLOOPxxx';

    // toDo: https!!!
    constructor(project_id, looper) {
        this.looper = looper;
        this.project_id = project_id;
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
                        resolve(loop_response.data);
                    });
                }
                http.get('http://' + config.api.url + ':' + config.api.port + '/loop?ProjectID=' + this.project_id, callback).end();
            }catch(e){
                reject(e);
            }
        });
    }

    handleMsg = (msg) => {
        console.log(msg.data);
        let parts = msg.data.split(this.msgDivider);
        if (parts.length !== 2)
            throw Error("malformed message " + parts.toString());

        let headers = parts[0],
            body = parts[1];

        if (headers === 'C'){ // chat
            console.log(msg);
        }else if (headers === 'N'){ // new loop
            console.log(msg);
            this.handleRcvdLoop(body);
        }else if (headers === 'R'){ // rename loop 
            console.log(msg);
        }else{
            throw Error("malformed message: " + msg);
        }
    }

    postDataToApi(data, endpoint){
        return new Promise((resolve, reject) => {
            let options = {
                hostname: config.api.url,
                port: config.api.port,
                path: '/' + endpoint,
                method: 'POST',
                headers: {
                'Content-Type': 'application/json',
                'Content-Length': data.length
                }
            };
            let req = http.request(options, res => {
                console.log(`statusCode: ${res.statusCode}`);
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
        });
    }

    sendMsg(msg) {
        this.socket.send(msg);
    }

    sendLoop(loop) { // send
        let postdata = JSON.stringify({
            'ProjectID': this.project_id,
            'userID': this.user,
            'name': loop.name,
            'metadata': {
                'length': {N: loop.buffer.length.toString()},
                'sampleRate': {N: loop.buffer.sampleRate.toString()},
                'numChannels': {N: loop.buffer.numberOfChannels.toString()},
            },
            // toDo: compress audio
            'audio': {
                L: Buffer.from(loop.buffer.getChannelData(0).buffer).toString('base64'),
                R: Buffer.from(loop.buffer.getChannelData(1).buffer).toString('base64'),
            },

        });

        this.postDataToApi(postdata, 'addTrack')
        .then((d) => {
            console.log("got data %s", d);
        }).catch((e) => {throw(e)});
    }
}

export { Communication };