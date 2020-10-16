import { v4 as uuidv4 } from 'uuid';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);

import { config } from './config.js';


var amqp = require('amqplib/callback_api');


// toDo: https://www.rabbitmq.com/production-checklist.html

let newq = () => {
	return new Promise((resolve, reject) => {
		amqp.connect(config.rabbit.url, function(error0, connection) {
		    if (error0) {
		        reject(error0);
		    }
		    connection.createChannel(function(error1, channel) {
		    	// toDo: do I always need to assert the channel's existence?
		        if (error1) {
		            reject(error1);
		        }

		        var queue = uuidv4();

		        channel.assertQueue(queue, {durable: true});
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
		return this.type + '|||' + this.msg;
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




export { newq, Message }