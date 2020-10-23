import config from './config-app.js'

let http = require('http');


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
                    let json = '';

                    //another chunk of data has been received, so append it to `str`
                    response.on('data', (chunk) => {
                        json += chunk;
                    });

                    //the whole response has been received, so we just print it out here
                    response.on('end', () => {
                        let data = JSON.parse(json);
                        resolve(data.loops);
                    });
                }
                http.get('http://' + config.api_url + '/loop?projectID=' + this.project_id, callback).end();
            }catch(e){
                reject(e);
            }
        });
    }

    handleMsg(msg) {   
        let parts = msg.split(this.msgDivider);
        if (parts.length !== 2)
            throw Error("malformed message");

        let headers = parts[0],
            body = parts[1];

        if (headers === 'C'){ // chat
            console.log(msg);
        }else if (headers === 'N'){ // new loop
            console.log(msg);
            this.handleNewLoop(body);
        }else if (headers === 'R'){ // rename loop 
            console.log(msg);
        }else{
            throw Error("malformed message: " + msg);
        }
    }

    handleNewLoop(data){
        let loopData = JSON.parse(data);
        let callback = (response) => {
            let json = '';

            //another chunk of data has been received, so append it to `str`
            response.on('data', (chunk) => {
                json += chunk;
            });

            //the whole response has been received, so we just print it out here
            response.on('end', () => {
                let loopData = JSON.parse(json);
                this.looper.loadLoopFromDynamoData(loopData);
            });
        }
        http.get('http://' + config.api_url + '/loop?projectID=' + this.project_id + '&loopID=' + loopData.loopID.S, 
            callback).end();        
    }

    sendMsg(msg) {
        return;
    }

    handleLoop(loop) {
        return;
    }
}

export { Communication };