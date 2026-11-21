
const http = require('node:http');
const { randomUUID } = require('node:crypto');

function requiredNumber(name) {
    const value = Number(process.env[name]);

    if (!Number.isSafeInteger(value) || value <= 0) {
        throw new Error(`Invalid or missing environment variable: ${name}`);
    }

    return value;
}

const PORT = requiredNumber('PORT');
const TODO_MAX_LENGTH = requiredNumber('TODO_MAX_LENGTH');
const MAX_REQUEST_BYTES = requiredNumber('MAX_REQUEST_BYTES');

if (PORT > 65535) {
    throw new Error('Invalid PORT');
}

// In-memory storage
const todos = [];

function sendJson(res, status, data) {
    res.writeHead(status, {
        'Content-Type': 'application/json; charset=utf-8'
    });

    res.end(JSON.stringify(data));
}

const server = http.createServer(async (req, res) => {

    // Get all todos
    if (req.method === 'GET' && req.url === '/todos') {
        return sendJson(res, 200, todos);
    }

    // Create a todo
    if (req.method === 'POST' && req.url === '/todos') {
        try {
            const chunks = [];
            let totalBytes = 0;

            for await (const chunk of req) {
                totalBytes += chunk.length;

                if (totalBytes > MAX_REQUEST_BYTES) {
                    return sendJson(res, 413, {
                        error: 'Request too large'
                    });
                }

                chunks.push(chunk);
            }

            const data = JSON.parse(Buffer.concat(chunks).toString('utf8'));

            const text = typeof data.text === 'string'
                ? data.text.trim()
                : '';

            if (!text || text.length > TODO_MAX_LENGTH) {
                return sendJson(res, 400, {
                    error: `Todo must contain 1-${TODO_MAX_LENGTH} characters`
                });
            }

            const todo = {
                id: randomUUID(),
                text
            };

            todos.push(todo);

            return sendJson(res, 201, todo);

        } catch (error) {
            return sendJson(res, 400, {
                error: 'Invalid request body'
            });
        }
    }

    sendJson(res, 404, {
        error: 'Not found'
    });
});

server.listen(PORT, () => {
    console.log(`Todo Backend listening on port ${PORT}`);
});
