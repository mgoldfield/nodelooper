import { getProject, getTrack, newProject, putTrack } from './db.js';
import { config } from './config-api.js';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const url = require('url');
// set up express
const express = require('express');
const app = express();
const port = 3001;
app.listen(port, () => {
    console.log(`Listening at http://localhost:${port}`);
});

//toDo: delete this test, put in real tests :P
app.get('/test', (req, res) => {
    getProject('testproject')
    .then((data) => res.send(data))
    .catch((err) => {console.log(stack); throw err;});
});

app.get('/newsesh', (req, res) => {
    // toDo: block ddos here, maybe with browser fingerprinting
    newProject()
    .then((seshdata) => res.send(seshdata))
    .catch((err) => {throw err});
});

app.get('/loop', (req, res) => {
    let qs = url.parse(req.url,true).query;
    getProject(qs.projectID)
    .then((data) => res.send(data))
    .catch((err => {console.log(err); throw err}));
});

app.get('/addtrack', (req, res) => {
    if (req.body.name === 'xxxLOOPxxx')
        throw Error('reserved name');
    putTrack(req.body.projectID, req.body.name, req.body.metadata, req.body.audio, req.body.queue)
    .catch((err) => {throw err});
    res.send('ok');
});

app.get('/getTrack', (req, res) => {
    getTrack(req.body.projectID, req.body.loopID)
    .then((audio) => res.send(audio));
});