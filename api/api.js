import { DataAccess } from './db.js';
import { config } from './config-api.js';
import { WebSocketServer, Message } from './websockets.js'
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const url = require('url');
const express = require('express');
const bodyParser = require('body-parser');
const fs = require('fs');
const app = express();
const ws = new WebSocketServer();
const da = new DataAccess();
let cors = null;
if (config.env === 'DEV'){
    cors = require('cors');
    app.use(cors()); // toDo: is this needed    
}

app.use(bodyParser.json({limit: '500mb'}));
app.listen(3001);


function getStaticHtml(filename){
    return new Promise((resolve, reject) => {
        fs.readFile(filename, 'utf8', function(err, page) {
            if (err) reject(err)
            else resolve(page);
        });        
    })
}

app.get('/test', (req, res) => {
    res.send("boop");
});

app.get('/', (req, res) =>{
    getStaticHtml('html/front-page.html')
    .then((page) => {
        res.type('html');
        res.send(page.replace(/APIURL/g, config.base_api_url));        
    }).catch((e)=>{throw e});
});

app.get('/faq', (req, res) =>{
    getStaticHtml('html/faq.html')
    .then((page) => {
        res.type('html');
        res.send(page.replace(/APIURL/g, config.base_api_url));        
    }).catch((e)=>{throw e});
});


app.get('/newsesh', (req, res) => {
    da.newProject()
    .then((seshdata) => {
        ws.register_project(seshdata.ProjectID, seshdata.expires);
        res.redirect(config.base_loop_url + '?ProjectID=' + seshdata.ProjectID);
    })
    .catch((err) => {throw err});
});

app.get('/loop', (req, res) => {
    let qs = url.parse(req.url,true).query;
    console.log("ProjectID: %s", qs.ProjectID);
    da.getProject(qs.ProjectID)
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
    if (req.body.name === config.newLoopIdentifier)
        throw Error('reserved name');
    let pdata = ws.projects.get(req.body.ProjectID);
    if (!pdata) {throw Error('project not found: ' + req.body.ProjectID)}

    da.putTrack(req.body.ProjectID, 
        req.body.name, 
        req.body.metadata, 
        req.body.audio, 
        pdata.expires)
    .then((data) => {
        ws.broadcast(req.body.ProjectID, req.body.userID, new Message(req.body.name, 'newLoop'));
    })
    .catch((err) => {throw err});
    res.send('ok');
});

app.post('/deleteTrack', (req, res) => {
    if (req.body.name === config.newLoopIdentifier)
        throw Error('reserved name');

    let pdata = ws.projects.get(req.body.ProjectID);
    if (!pdata) {throw Error('project not found: ' + req.body.ProjectID)}

    da.deleteTrack(req.body.ProjectID, req.body.LoopID)
    .then((data) => {
        ws.broadcast(req.body.ProjectID, req.body.userID, new Message(req.body.LoopID, 'deleteLoop'));
    })
    .catch((err) => {throw err});
    res.send('ok');
});

app.post('/getTrack', (req, res) => {
    da.getTrack(req.body.ProjectID, req.body.LoopID)
    .then((data) => res.send(data));
});