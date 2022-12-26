import bodyParser from 'body-parser';
import express from 'express';
import fs from 'fs';
import url from 'url';
import path from 'path';
import { config } from './config-api.js';
import { DataAccess } from './db.js';
import { Message, WebSocketServer } from './websockets.js';

const app = express();
const da = new DataAccess();

app.use(bodyParser.json({limit: '500mb'}));
if (config.env === 'DEV'){
    const cors = (await import('cors')).default;
    app.use(cors())     
}
const server = app.listen(3001);

const ws = new WebSocketServer(server);

function getStaticHtml(filename){
    return new Promise((resolve, reject) => {
        fs.readFile(filename, 'utf8', function(err, page) {
            if (err) reject(err)
            else resolve(page);
        });        
    })
}

app.use('/project', express.static('app/build'))

app.get('/test', (req, res) => {
    res.send("boop");
});

app.get('/stats', (req, res) => {
    let ts = 0;
    ws.projects.forEach((v, k, m) => ts += v.sockets.size);

    let ap = [];
    ws.projects.forEach((v, k, m) => {
        if (v.sockets.size > 0){
            ap.push(k);
        }
    });

    let stats = {
        total_projects: ws.projects.size,
        total_active_sockets: ts, 
        total_active_projects: ap.length,
        active_projects: ap,
    };
    res.send(stats);
})

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
    da.getProject(qs.ProjectID)
    .then((data) => {
        let user_id = ws.register_user(qs.ProjectID);
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
    .then(() => {
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



