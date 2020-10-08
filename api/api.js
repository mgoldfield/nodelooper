import { getProject } from './db.js';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);

// set up express
const express = require('express');
const app = express();
const port = 3001;
app.listen(port, () => {
    console.log(`Listening at http://localhost:${port}`);
});

app.get('/', (req, res) => {
    getProject('testproject')
    .then((data) => res.send(data))
    .catch((err) => {throw(err);});  
});

