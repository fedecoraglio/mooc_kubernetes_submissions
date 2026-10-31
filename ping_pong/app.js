
const http = require('node:http');
const fs = require('node:fs');

const PORT = process.env.PORT || 3000;
const COUNTER_FILE = '/data/counter.txt';

let counter = 0;

// Restore counter from persistent storage
if (fs.existsSync(COUNTER_FILE)) {
    counter = Number(fs.readFileSync(COUNTER_FILE, 'utf8')) || 0;
}

const server = http.createServer((req, res) => {
    if (req.method === 'GET' && req.url === '/pingpong') {
        const current = counter;
        counter++;

        fs.writeFileSync(COUNTER_FILE, String(counter));

        res.writeHead(200, { 'Content-Type': 'text/plain' });
        res.end(`pong ${current}`);
        return;
    }

    res.writeHead(404);
    res.end('Not Found');
});

server.listen(PORT, () => {
    console.log(`Server started in port ${PORT}`);
});
