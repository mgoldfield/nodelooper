


fetch('http://localhost:3001/newsesh')
.then(response => response.json())
.then(data => {
    console.log("newsesh:");
    console.log(data);
    fetch('http://localhost:3001/loop?ProjectID=' + data.ProjectID)
    .then(response => response.json())
    .then(loopdata => {
        console.log('loopdata:');
        console.log(loopdata);
        // Create WebSocket connection.
        const socket = new WebSocket('ws://localhost:8080', data.ProjectID + ":" + loopdata.user);

        // Connection opened
        socket.addEventListener('open', function (event) {
            socket.send('Hello Server!');
        });

        // Listen for messages
        socket.addEventListener('message', function (event) {
            console.log('Message from server ', event.data);
        });        
    });
});


if (false) {

}



