import { v4 as uuidv4 } from 'uuid';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);

import { newRabbitUser, newRabbitQueue } from './db.js';
import { config } from './config-api.js';


let amqp = require('amqplib/callback_api');
let http = require('http');


// toDo: https://www.rabbitmq.com/production-checklist.html
// toDo: https://www.cloudamqp.com/blog/2017-12-29-part1-rabbitmq-best-practice.html

let rabbitUrl = () => {
    let url = 'amqp://' + config.rabbit.user + ':' + config.rabbit.pass;
    url += '@' + config.rabbit.url + '/' + config.rabbit.vhost;
    console.log(url);
    return url;
}

let newq = () => {
    return new Promise((resolve, reject) => {
        // toDo: would a persistent connection make sense here?   
        // toDo: amqps 
        amqp.connect(rabbitUrl(), function(error0, connection) {
            if (error0) {
                reject(error0);
                return;
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
            amqp.connect(rabbitUrl(), function(error0, connection) {
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
    // toDo: this is gross - clean it up
    // toDo: configure rabbit for https and make this https
    return new Promise((resolve, reject) => {
        // create user        
        let username = uuidv4(),
            password = uuidv4(); // toDo: does this take up too much space?  

        try {
            let data = JSON.stringify({
                'password': password,
                'tags': 'none',
            });

            let auth = 'Basic ' + Buffer.from(config.rabbit.user + ':' + config.rabbit.pass).toString('base64');
            let options = {
                host: config.rabbit.url,
                port: config.rabbit.admin_port, 
                path: '/api/users/' + username,
                method: 'PUT',
                headers: {
                    Authorization:  auth,
                }
            };


            let req = http.request(options, (res) => {
                if (res.statusCode == 201){
                    data =JSON.stringify({
                        'configure':'',
                        'write': queue,
                        'read': queue,
                    })
                    options.path = '/api/permissions/' + config.rabbit.vhost + '/' + username;
                    req = http.request(options, (res) => {
                        if (res.statusCode != 201){
                            reject("could not set permissions for user " + username);
                        }
                    });
                    req.on('error', (err) => reject(err));            
                    req.write(data);
                    req.end();   
                }else{
                    reject("failed to create user: " + res.statusCode);
                }
            });
            req.on('error', (err) => reject(err));
            req.write(data);
            req.end();

            console.log("created user");

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