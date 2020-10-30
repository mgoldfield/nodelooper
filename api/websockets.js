import { config } from './config-api.js'
import { createRequire } from 'module';
import { v4 as uuidv4 } from 'uuid';

const require = createRequire(import.meta.url);

// toDo: security - https
const http = require('http');
const WebSocket = require('ws');

class WebSocketServer {

    // toDo: garbage collection

    projects = new Map();
    // toDo: repopulate from dynamo on server restart

    constructor() {
        this.wss = new WebSocket.Server({ noServer: true });
        this.server = http.createServer();

        this.wss.on('connection', (ws, request, client) => {
            ws.on('message', (message) => {
                console.log('broadcasting: %s to %s from %s', message, client.project_id, client.user_id);
                this.broadcast(client.project_id, client.user_id, message);
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
                    this.projects.get(client.project_id).sockets.set(client.user_id, ws);
                    this.wss.emit('connection', ws, request, client);
                });
            });
        });

        this.server.listen(config.websockets.port);
    }

    authenticate(request, cont, debug=true) {
        if (debug) console.log('request: %s \n\n', request, request.headers);
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
        this.projects.set(project_id, {
            'expires':expires,
            users: [],
            sockets: new Map(),
        });
    }

    register_user(project_id){
        // toDo: expire logins after 1 day... user dynamo somehow? 
        if (!this.projects.get(project_id)) 
            throw Error('unknown project: ' + project_id);

        let user_id = uuidv4();
        this.projects.get(project_id).users.push(user_id);
        return user_id;
    }

    broadcast(project_id, user_id, msg){
        if (!this.projects.get(project_id)) 
            throw Error('unknown project: ' + project_id);

        this.projects.get(project_id).sockets.forEach((value, key, map) => {
            if (key !== user_id)
                value.send(msg.makeMsg());
        });
    }

    destroy_project(project_id){
        // toDo
    }
}

class Message {
    msgTypes = {
        chat: 'C',
        newLoop: 'N',
        renameLoop: 'R',
    };

    divider = '|||';

    constructor(msg, type=null) {
        if (type){ // create message to send
            this.msg = msg;
            if (!Object.keys(this.msgTypes).includes(type))
                throw Error("Unknown msg type to send: " + type);
            this.type = this.msgTypes[type];
        }else{ // parse message received 
            let parts = rawMsg.split(this.divider);

            if (parts.length != 2)
                throw Error("Malformed message: " + rawMsg);
            if (!this.msgTypes.values().includes(parts[0]))
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
