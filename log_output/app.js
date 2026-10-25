const http = require('node:http');
const { randomUUID } = require('node:crypto');

const PORT = process.env.PORT || 3000;

// Generate a random string once at startup
const randomString = randomUUID();

function getStatus() {
    return `${new Date().toISOString()}: ${randomString}`;
}

function logMessage() {
    console.log(getStatus());
}

// Print every 5 seconds
setInterval(logMessage, 5000);

// HTTP server
const server = http.createServer((req, res) => {
    if (req.method === 'GET' && req.url === '/') {
        res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end(getStatus());
        return;
    }

    res.writeHead(404);
    res.end('Not Found');
});

server.listen(PORT, () => {
    console.log(`Server started in port ${PORT}`);
});
