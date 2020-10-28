


fetch('http://localhost:3001/newsesh')
.then(response => response.json())
.then(data => console.log(data));


if (false) {
    // Create WebSocket connection.
    const socket = new WebSocket('ws://localhost:8080', 'testproject:testuser');

    // Connection opened
    socket.addEventListener('open', function (event) {
        socket.send('Hello Server!');
    });

    // Listen for messages
    socket.addEventListener('message', function (event) {
        console.log('Message from server ', event.data);
    });
}



