import { getProject, getTrack, newProject, putTrack } from './db.js';
import { config } from './config-api.js';
import { WebSocketServer, Message } from './websockets.js'
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const url = require('url');

// set up express
const express = require('express');
const cors = require('cors')
const app = express();
const ws = new WebSocketServer();
const bodyParser = require('body-parser');

app.use(bodyParser.json({limit: '50mb'}));
app.use(cors());
app.listen(3001);

//toDo: delete this test, put in real tests :P
app.get('/test', (req, res) => {
    getProject('testproject')
    .then((data) => res.send(data))
    .catch((err) => {console.log(stack); throw err;});
});

app.get('/newsesh', (req, res) => {
    // toDo: block ddos here, maybe with browser fingerprinting
    newProject()
    .then((seshdata) => {
        ws.register_project(seshdata.ProjectID, seshdata.expires);
        res.send(seshdata);
    })
    .catch((err) => {throw err});
});

app.get('/loop', (req, res) => {
    let qs = url.parse(req.url,true).query;
    console.log("ProjectID: %s", qs.ProjectID);
    getProject(qs.ProjectID)
    .then((data) => {
        let user_id = ws.register_user(qs.ProjectID)
        res.send({
            user: user_id,
            data: data,
        });
    })
    .catch((err => {console.log(err); throw err}));
});

app.post('/addtrack', (req, res) => {
    console.log('body: %s', req.body);
    if (req.body.name === config.newLoopIdentifier)
        throw Error('reserved name');
    putTrack(req.body.ProjectID, req.body.name, req.body.metadata, req.body.audio)
    .then((data) => {
        ws.broadcast(req.body.ProjectID, req.body.userID, new Message(req.body.name, 'newLoop'));
    })
    .catch((err) => {throw err});
    res.send('ok');
});

app.get('/getTrack', (req, res) => {
    getTrack(req.body.ProjectID, req.body.loopID)
    .then((data) => res.send(data));
});