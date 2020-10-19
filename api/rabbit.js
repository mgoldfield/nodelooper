import { v4 as uuidv4 } from 'uuid';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);

import { newRabbitUser, newRabbitQueue } from './db.js';
import { config } from './config-api.js';


let amqp = require('amqplib/callback_api');
let http = require('http');


// toDo: https://www.rabbitmq.com/production-checklist.html
// toDo: https://www.cloudamqp.com/blog/2017-12-29-part1-rabbitmq-best-practice.html

let newq = () => {
    return new Promise((resolve, reject) => {
        // toDo: would a persistent connection make sense here?   
        amqp.connect(config.rabbit.url, function(error0, connection) {
            if (error0) {
                reject(error0);
            }
            connection.createChannel(function(error1, channel) {
                // toDo: do I always need to assert the channel's existence?
                if (error1) {
                    reject(error1);
                }

                let queue = uuidv4();

                channel.assertQueue(queue, {durable: true, maxLength: config.rabbit.maxQueueLength});
                newRabbitQueue(queue);
                resolve(queue);
            });
            setTimeout(function() {
                connection.close();
            }, 500);
        });
    });
}

class Message {
    msgTypes = {
        chat: 'C',
        newLoop: 'N',
        renameLoop: 'R',
    };

    divider = '|||';

    constructor(q, msg, type=null) {
        this.queue = q;
        if (type){ // create message to send
            this.msg = msg;
            if (!this.msgTypes.keys().includes(msgType))
                throw Error("Unknown msg type to send: " + msgType);
            this.type = msgTypes[type];
        }else{ // parse message received 
            let parts = rawMsg.split('|||');

            if (parts.length != 2)
                throw Error("Malformed message: " + rawMsg);
            if (!this.msgTypes.values().includes(parts[0]))
                throw Error("Unknown msg type received: " + parts[0]);

            this.type = parts[0];
            this.msg = parts[1];            
        }
    }

    makeMsg = () => {
        return this.type + this.divider + this.msg;
    }

    send = () => {
        return new Promise((resolve, reject) => {
            amqp.connect(config.rabbit.url, function(error0, connection) {
                if (error0) {
                    reject(error0);
                }
                connection.createChannel(function(error1, channel) {
                    if (error1) {
                        reject(error1);
                    }
                    channel.assertQueue(this.queue, {durable: true});
                    channel.sendToQueue(this.queue, Buffer.from(this.makeMsg()), {persistent: false});
                });
                setTimeout(function() {
                    connection.close();
                }, 500);
            });
        });
    };    
}


let addRabbitUser = (queue) => {
    // toDo: configure rabbit for https and make this https
    return new Promise((resolve, reject) => {
        try {
            // create user
            let username = uuidv4();
            let password = uuidv4(); // toDo: does this take up too much space?  
            let options = {
                host: config.rabbit.url, 
                path: '/api/users/' + username,
                authorization: 'Basic ' + Buffer.from(config.rabbit.user + ':' + config.rabbit.pass).toString('base64'),
                method: 'PUT',
            };

            let req = http.request(options, () => null);
            req.on('error', (err) => reject(err));
            req.write({
                'password': password,
                'tags': 'none',
            }.toString());
            req.end();

            options.path = '/api/permissions/' + queue + '/' + username;
            req = http.request(options, () => null);
            req.on('error', (err) => reject(err));            
            req.write({
                'configure':'',
                'write': queue,
                'read': queue,
            }.toString());
            req.end();

            // log this in the db
            newRabbitUser(username);
        }catch(err){
            console.log(err.stack);
            reject(err);
        }

        resolve({
            'user': username,
            'pass': password,
        });
    });
};




export { newq, Message, addRabbitUser }