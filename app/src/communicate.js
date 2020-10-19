let amqp = require('amqplib/callback_api');

import { config, rabbitUrl } from './config-app.js'



class Communication {
    // toDo: https!!!
    constructor(rabbit_info) {
        this.rabbit_info = rabbit_info;
        this.subscribeQueue();
    }

    subscribeQueue(rabbit_info) {
        // toDo: persistent connections?
        amqp.connect(rabbitUrl(this.rabbit_info.user, this.rabbit_info.pass), function(error0, connection) {
            if (error0) {
                throw error0;
            }
            connection.createChannel(function(error1, channel) {
                if (error1) {
                    throw error1;
                }

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
            if (error0) {
                throw error0;
            }
            connection.createChannel(function(error1, channel) {
                if (error1) {
                    throw error1;
                }

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