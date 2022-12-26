import config from './config-app.js';
import { bufferToMp3 } from './format_tools.js';

class Communication {
    msgDivider = '|||';
    LoopHeaderID = 'xxxLOOPxxx';

    constructor(project_id, looper) {
        this.looper = looper;
        this.project_id = project_id;
    }

    async initProject() {
        let url = ((config.env==='PROD') ? 'https://' : 'http://');
        url += config.api.url + ':' + config.api.port + config.api.path;
        url += '/loop?ProjectID=' + this.project_id
        const res = await fetch(url)
        const loop_response = await res.json()
        this.user = loop_response.user;
        console.log('websockets', {url: config.ws_url, pjid: this.project_id, user: this.user})
        this.socket = new WebSocket(config.ws_url, [this.project_id, this.user]);
        this.socket.addEventListener('open', () => console.log("connection open"));
        this.socket.addEventListener('message', this.handleMsg);
        for (const c of loop_response.data.chat){ // toDo: make this less brittle
            this.handleRcvdChat(c.msg.S.split(this.msgDivider)[1]);                        
        }
        return loop_response.data.loopData
    }

    handlePing = () => {
        if (this.last_ping && Date.now() - this.last_ping > 120000){
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

    async postDataToApi(data, endpoint){
        const protocol = (config.env==='PROD') ? 'https://' : 'http://'
        const res = await fetch(`${protocol}${config.api.url}:${config.api.port}${config.api.path}/${endpoint}`, {
            method: 'POST',
            body: data,
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': data.length
            }
        })
        return await res.text()
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

        if (loop.deleted) return;

        postdata = JSON.stringify(postdata);
        this.postDataToApi(postdata, 'addTrack').catch((e) => {throw(e)});
    }

    broadcastMetadata(id, metadata){
        console.log("broadcasting metadata")
        console.log(metadata);
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
