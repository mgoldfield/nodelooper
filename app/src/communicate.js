import config from './config-app.js'

let http = require('http');
let amqp = require('amqplib/callback_api');


class Communication {
    msgDivider = '|||';
    LoopHeaderID = 'xxxLOOPxxx';

    // toDo: https!!!
    constructor(project_id, handleLoops, looper) {
        this.looper = looper;
        this.project_id = project_id;
        // get current loops
        let callback = (response) => {
            let json = '';

            //another chunk of data has been received, so append it to `str`
            response.on('data', (chunk) => {
                json += chunk;
            });

            //the whole response has been received, so we just print it out here
            response.on('end', () => {
                let data = JSON.parse(json);
                this.rabbit_info = data.rabbitCreds;
                for (const l of data.loops) {
                    if (l.LoopID === this.LoopHeaderID){ // toDo: move xxxLOOPxxx to config
                        this.rabbit_info['queue'] = l.metadata.M.queue.S;
                        break;
                    }
                }
                this.subscribeQueue();
                handleLoops(data.loops);
            });
        }
        http.get('http://' + config.api_url + '/loop?projectID=' + project_id, callback).end();        
    }

    rabbitUrl(user, pass){
        return 'ampq://' + user + ':' + pass + '@' + config.rabbit.url + '/' + config.rabbit.vhost;
    }

    subscribeQueue(rabbit_info) {
        // toDo: persistent connections?
        amqp.connect(this.rabbitUrl(this.rabbit_info.user, this.rabbit_info.pass), function(error0, connection) {
            if (error0) 
                throw error0;
            connection.createChannel(function(error1, channel) {
                if (error1)
                    throw error1;
                channel.assertQueue(this.rabbit_info.queue, {durable: true});
                channel.consume(this.rabbit_info.queue, this.handleMsg, {noAck: true});
            });
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
        http.get('http://' + config.api_url + '/loop?projectID=' + this.project_id + '&loopID=' + loopData.loopID, 
            callback).end();        
    }

    sendMsg(msg) {
        amqp.connect(this.rabbitUrl(this.rabbit_info.user, this.rabbit_info.pass), function(error0, connection) {
            if (error0) 
                throw error0;
            connection.createChannel(function(error1, channel) {
                if (error1)
                    throw error1;
                channel.assertQueue(this.rabbit_info.queue, {durable: true});
                channel.sendToQueue(this.rabbit_info.queue, Buffer.from(msg));
            });
            setTimeout(function() {
                connection.close();
                // toDo: fail more gracefully
                throw Error("rabbit connection timed out")
            }, 500);
        });
    }

    handleLoop(loop) {
        this.sendMsg('N' + this.msgDivider + JSON.stringify({loopID:loop.state.name}));
    }
}

export { Communication };