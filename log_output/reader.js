
const http = require('node:http');
const fs = require('node:fs');

const PORT = process.env.PORT || 3000;
const LOG_FILE = '/shared/log.txt';
const COUNTER_FILE = '/data/counter.txt';

const server = http.createServer((req, res) => {
    if (req.method === 'GET' && req.url === '/') {
        try {
            const log = fs.readFileSync(LOG_FILE, 'utf8').trim();

            const counter = fs.existsSync(COUNTER_FILE)
                ? fs.readFileSync(COUNTER_FILE, 'utf8').trim()
                : '0';

            res.writeHead(200, {
                'Content-Type': 'text/plain; charset=utf-8'
            });

            res.end(`${log}\nPing / Pongs: ${counter}\n`);
        } catch (error) {
            res.writeHead(503);
            res.end('Log output not ready');
        }
        return;
    }

    res.writeHead(404);
    res.end('Not Found');
});

server.listen(PORT, () => {
    console.log(`Server started in port ${PORT}`);
});
