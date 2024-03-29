import { v4 as uuidv4 } from 'uuid';
import { WebSocketServer as Server } from 'ws';
import { config } from './config-api.js';
import { SocketHelpers } from './db.js';

class WebSocketServer {

    projects = new Map();
    db = new SocketHelpers();

    constructor(server) {
        this.populateProjects();

        this.server = server;
        this.wss = new Server({ noServer: true, path: '/ws' });

        this.wss.on('connection', (ws, request, client) => {
            ws.on('message', (msg) => {
                let parsed_msg = new Message(msg);
                this.broadcast(client.project_id, client.user_id, parsed_msg);
                if (parsed_msg.type === 'UM'){
                    this.db.updateMetadata(JSON.parse(parsed_msg.msg))
                    .catch(e => console.log("error updating metadata: %s", e));
                }
            });
        });

        this.server.on('upgrade', (request, socket, head) => {
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

        if (!creds) {
            cont('no credentials: ' + creds.toString(), null);
            return; 
        }

        creds = creds.split(',').map(s => s.trim());
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
        updateMetadata: 'UM'
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
