import { getProject, getLoop, newProject } from './db.js';
import { config } from './config.js';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);

// set up express
const express = require('express');
const app = express();
const port = 3001;
app.listen(port, () => {
    console.log(`Listening at http://localhost:${port}`);
});


//toDo: delete this test, put in real tests :P
app.get('/', (req, res) => {
    getProject('testproject')
    .then((data) => res.send(data))
    .catch((err, stack) => {console.log(stack); throw(err);});
});


app.get('/newsesh', (req, res) => {
    // toDo: block ddos here, maybe with browser fingerprinting
    newProject()
    .then((pid) => res.send(config.base_loop_url + '/loop?' + 'p=' + pid))
    .catch((err, stack) => {console.log(stack); throw(err)});
});

app.get('/loop', (req, res) => {
    // send back current data
    res.send('boop');
});
