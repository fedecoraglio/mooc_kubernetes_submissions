
const http = require('node:http');
const fs = require('node:fs');

const PORT = process.env.PORT || 3000;
const LOG_FILE = '/shared/log.txt';
const PING_PONG_URL = 'http://ping-pong-svc:2345/count';
const INFO_FILE = '/config/information.txt';

const server = http.createServer(async (req, res) => {
    if (req.method === 'GET' && req.url === '/') {
        try {
            const info = fs.readFileSync(INFO_FILE, 'utf8').trim();
            const message = process.env.MESSAGE;
            const log = fs.readFileSync(LOG_FILE, 'utf8').trim();

            const response = await fetch(PING_PONG_URL, {
                signal: AbortSignal.timeout(2000)
            });

            if (!response.ok) {
                throw new Error(`Ping pong returned ${response.status}`);
            }

            const counter = (await response.text()).trim();

            res.writeHead(200, {
                'Content-Type': 'text/plain; charset=utf-8'
            });

            res.end(
                `file content: ${info}\n` +
                `env variable: MESSAGE=${message}\n` +
                `${log}\n` +
                `Ping / Pongs: ${counter}\n`
            );
        } catch (error) {
            console.error(error);
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
