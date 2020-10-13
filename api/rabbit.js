import { v4 as uuidv4 } from 'uuid';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);

import { config } from './config.js';


var amqp = require('amqplib/callback_api');

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
		        process.exit(0);
		    }, 500);
		});
	};
}


let send = (msg, queue) => {
	return new Promise((resolve, reject) => {
		amqp.connect(config.rabbit.url, function(error0, connection) {
		    if (error0) {
		        reject(error0);
		    }
		    connection.createChannel(function(error1, channel) {
		        if (error1) {
		            reject(error1);
		        }
		        channel.assertQueue(queue, {durable: true});
		        channel.sendToQueue(queue, Buffer.from(msg), {persistent: false});
		    });
		    setTimeout(function() {
		        connection.close();
		        process.exit(0);
		    }, 500);
		});
	};
}


export { newq, send }