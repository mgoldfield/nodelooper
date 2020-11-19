import { config } from './config-api.js'
import { createRequire } from 'module';
import { v4 as uuidv4 } from 'uuid';
import { SocketHelpers } from './db.js';
const require = createRequire(import.meta.url);
const express = require('express');
const http = require('http'); 
const cors = require('cors');
const WebSocket = require('ws');


class WebSocketServer {

    projects = new Map();
    db = new SocketHelpers();

    constructor() {
        this.populateProjects();

        this.app = express();
        this.server = this.app.listen(config.websockets.port); 
        this.wss = new WebSocket.Server({ noServer: true });

        this.wss.on('connection', (ws, request, client) => {
            ws.on('message', (msg) => {
                let parsed_msg = new Message(msg);
                console.log('broadcasting: %s to %s from %s', parsed_msg, client.project_id, client.user_id);
                this.broadcast(client.project_id, client.user_id, parsed_msg);
            });
        });

        this.server.on('upgrade', (request, socket, head) => {
            // This function is not defined on purpose. Implement it with your own logic.
            this.authenticate(request, (err, client) => {
                if (err || !client) {
                    socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
                    socket.destroy();
                    return;
                }

                this.wss.handleUpgrade(request, socket, head, (ws) => {
                    this.projects.get(client.project_id).sockets.set(client.user_id, {'socket':ws, 'lastUse':Date.now()});
                    this.wss.emit('connection', ws, request, client);
                });
            });
        });

        setInterval(this.garbage_collection, config.websockets.timeout); 
        setInterval(this.ping_sockets, 30000); // ping every 30 seconds
    }

    populateProjects() {
        this.db.getLiveProjects().then((db_proj)=>{
            for (const p of db_proj) {
                this.register_project(p.projectid.S, p.expires.N);
                this.register_user(p.projectid.S, p.id.S)
            }
        })
    }

    authenticate(request, cont) {
        let err = null,
            creds = request.headers['sec-websocket-protocol'];

        creds = creds.split(':');
        if (creds.length != 2) {
            cont('bad credentials: ' + creds.toString(), null);
            return;
        }
        let project_id = creds[0],
            user_id = creds[1];

        if (this.projects.get(project_id) && this.projects.get(project_id).users.includes(user_id)) {
            cont(null, {
                project_id: creds[0],
                user_id: creds[1]
            });
        }
    }

    register_project(project_id, expires){
        if (!this.projects.get(project_id)){
            this.projects.set(project_id, {
                'expires':expires,
                users: [],
                sockets: new Map(),
            });
        }
    }

    register_user(project_id, user_id=null){
        if (!this.projects.get(project_id)) 
            throw Error('unknown project: ' + project_id);

        if (!user_id){
            user_id = uuidv4();
            this.db.registerUser(project_id, user_id, this.projects.get(project_id).expires)
            .catch((e) => {throw e});
        }
        this.projects.get(project_id).users.push(user_id);       
        return user_id;
    }

    broadcast(project_id, user_id, msg){
        if (!this.projects.get(project_id)) 
            throw Error('unknown project: ' + project_id);

        if (msg.type == 'C')
            this.db.putChat(project_id, this.projects.get(project_id).expires, msg.makeMsg());

        this.projects.get(project_id).sockets.forEach((value, key, map) => {
            if (key !== user_id)
                value.socket.send(msg.makeMsg());
                value.lastUse = Date.now();

        });
    }

    garbage_collection = () => {
        console.log("garbage collecting...");
        this.projects.forEach((value, key, map) => {
            if (parseInt(value.expires) * 1000 < Date.now()){
                value.sockets.forEach((v, k, m) => v.socket.terminate());
                map.delete(key); // delete project if expired
            }else{
                value.sockets.forEach((v, k, m) => {
                    if (Date.now() - v.lastUse > config.websockets.timeout){
                        v.socket.terminate();
                        m.delete(k); // delete socket if timed out, but leave project
                    }
                })
            }
        })
    };

    ping_sockets = () => {
        this.projects.forEach((pv, pk, pm) => {
            pv.sockets.forEach((sv, sk, sm) => {
                sv.socket.send("ping");
            })
        })
    }
}

class Message {
    msgTypes = {
        chat: 'C',
        newLoop: 'N',
        renameLoop: 'R',
        deleteLoop: 'D',
    };

    divider = '|||';

    constructor(msg, type=null) {
        if (type){ // create message to send
            this.msg = msg;
            if (!Object.keys(this.msgTypes).includes(type))
                throw Error("Unknown msg type to send: " + type);
            this.type = this.msgTypes[type];
        }else{ // parse message received 
            let parts = msg.split(this.divider);

            if (parts.length != 2)
                throw Error("Malformed message: " + rawMsg);
            if (!Object.values(this.msgTypes).includes(parts[0]))
                throw Error("Unknown msg type received: " + parts[0]);

            this.type = parts[0];
            this.msg = parts[1];            
        }
    }

    makeMsg() {
        return this.type + this.divider + this.msg;
    }

    toString() {
        return this.makeMsg();
    }
}


export { WebSocketServer, Message };
