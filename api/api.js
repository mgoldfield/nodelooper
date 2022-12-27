import bodyParser from 'body-parser';
import cors from 'cors';
import express from 'express';
import fs from 'fs';
import * as https from 'https';
import url from 'url';
import { config } from './config-api.js';
import { DataAccess } from './db.js';
import { Message, WebSocketServer } from './websockets.js';

const app = express();
const da = new DataAccess();

app.use(bodyParser.json({limit: '500mb'}));
if (config.env === 'DEV'){
    app.use(cors())     
}else{
    app.use(cors({
        origin: config.base_loop_url,
        optionsSuccessStatus: 200
    }))
}

let server;
if (config.env === 'DEV') {
    server = app.listen(3001);
} 
if (config.env === 'PROD'){
    server = https.createServer({
        key: fs.readFileSync(config.ssl.key, 'utf-8'),
        cert: fs.readFileSync(config.ssl.cert, 'utf-8')
    }, app).listen(443, () => console.log('listening at 443'));
}

const ws = new WebSocketServer(server);

function getStaticHtml(filename){
    return new Promise((resolve, reject) => {
        fs.readFile(filename, 'utf8', function(err, page) {
            if (err) reject(err)
            else resolve(page);
        });        
    })
}

// app.use('/project', express.static('app/build'))

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

app.get('/', async (req, res) =>{
    const page = await getStaticHtml('html/front-page.html');
    res.type('html');
    res.send(page.replace(/APIURL/g, config.base_api_url));
});

app.get('/faq', async (req, res) =>{
    const page = await getStaticHtml('html/faq.html');
    res.type('html');
    res.send(page.replace(/APIURL/g, config.base_api_url));
});


app.get('/newsesh', async (req, res) => {
    const seshdata = await da.newProject();
    ws.register_project(seshdata.ProjectID, seshdata.expires);
    res.redirect(config.base_loop_url + '?ProjectID=' + seshdata.ProjectID);
});

app.get('/loop', async (req, res) => {
    try {
        const qs = url.parse(req.url,true).query;
        const data = await da.getProject(qs.ProjectID);
        const user_id = ws.register_user(qs.ProjectID);
        res.send({
            user: user_id,
            data: data,
        });
    } catch (err) {
        console.log(err);
        throw err;
    }
});

app.post('/addtrack', async (req, res) => {
    if (req.body.name === config.newLoopIdentifier)
        throw Error('reserved name');
    let pdata = ws.projects.get(req.body.ProjectID);
    if (!pdata) {throw Error('project not found: ' + req.body.ProjectID)}

    await da.putTrack(req.body.ProjectID, 
        req.body.name, 
        req.body.metadata, 
        req.body.audio, 
        pdata.expires);
    ws.broadcast(req.body.ProjectID, req.body.userID, new Message(req.body.name, 'newLoop'));
    res.send('ok');
});

app.post('/deleteTrack', async (req, res) => {
    if (req.body.name === config.newLoopIdentifier)
        throw Error('reserved name');

    let pdata = ws.projects.get(req.body.ProjectID);
    if (!pdata) {throw Error('project not found: ' + req.body.ProjectID)}

    const data = await da.deleteTrack(req.body.ProjectID, req.body.LoopID);
    ws.broadcast(req.body.ProjectID, req.body.userID, new Message(req.body.LoopID, 'deleteLoop'));
    res.send('ok');
});

app.post('/getTrack', async (req, res) => {
    const data = await da.getTrack(req.body.ProjectID, req.body.LoopID);
    res.send(data);
});
