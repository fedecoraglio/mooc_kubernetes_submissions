
const http = require('node:http');
const fs = require('node:fs');

const PORT = process.env.PORT || 3000;
const FILE_PATH = '/shared/log.txt';

const server = http.createServer((req, res) => {
    if (req.method === 'GET' && req.url === '/') {
        try {
            const content = fs.readFileSync(FILE_PATH, 'utf8');

            res.writeHead(200, {
                'Content-Type': 'text/plain; charset=utf-8'
            });
            res.end(content);
        } catch (error) {
            if (error.code === 'ENOENT') {
                res.writeHead(503);
                res.end('Waiting for log file...');
                return;
            }

            res.writeHead(500);
            res.end('Unable to read log file');
        }
        return;
    }

    res.writeHead(404);
    res.end('Not Found');
});

server.listen(PORT, () => {
    console.log(`Server started in port ${PORT}`);
});
