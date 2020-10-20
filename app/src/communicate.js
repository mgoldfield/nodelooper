let amqp = require('amqplib/callback_api');

import { config, rabbitUrl } from './config-app.js'


class Communication {
    // toDo: https!!!
    constructor(project_id, handleLoops) {
        let options = {
            host: config.api_url,
            path: '/loop?projectID=' + project_id,
        };

        callback = (response) => {
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
                    if (i.LoopID == "xxxLOOPxxx"){ // toDo: move xxxLOOPxxx to config
                        this.rabbit_info['queue'] = i.metadata.M.queue.S;
                        break;
                    }
                }
                this.subscribeQueue();
                handleLoops(data.loops);
            });
        }
        http.request(options, callback).end();        
    }

    subscribeQueue(rabbit_info) {
        // toDo: persistent connections?
        amqp.connect(rabbitUrl(this.rabbit_info.user, this.rabbit_info.pass), function(error0, connection) {
            if (error0) 
                throw error0;
            connection.createChannel(function(error1, channel) {
                if (error1)
                    throw error1;
                channel.assertQueue(this.rabbit_info.queue, {durable: true});
                channel.consume(queue, this.handleMsg, {noAck: true});
            });
        });
    }

    handleMsg = (msg) => {
        console.log(msg);
    };

    sendMsg(msg) {
        amqp.connect(rabbitUrl(this.rabbit_info.user, this.rabbit_info.pass), function(error0, connection) {
            if (error0) 
                throw error0;
            connection.createChannel(function(error1, channel) {
                if (error1)
                    throw error1;
                channel.assertQueue(this.rabbit_info.queue, {durable: true});
                channel.sendToQueue(queue, Buffer.from(msg));
            });
            setTimeout(function() {
                connection.close();
                // toDo: fail more gracefully
                throw Error("rabbit connection timed out")
            }, 500);
        });
    }


    handleChunk(id, chunk) {
        return;
    }
}

export { Communication };