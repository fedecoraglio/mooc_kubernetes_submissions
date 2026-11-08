
const http = require('node:http');
const { randomUUID } = require('node:crypto');

const PORT = process.env.PORT || 3000;

const todos = [
    { id: randomUUID(), text: 'Learn Kubernetes' },
    { id: randomUUID(), text: 'Complete the MOOC exercises' },
    { id: randomUUID(), text: 'Deploy Todo App to Kubernetes' }
];

function sendJson(res, status, data) {
    res.writeHead(status, {
        'Content-Type': 'application/json; charset=utf-8'
    });
    res.end(JSON.stringify(data));
}

const server = http.createServer(async (req, res) => {
    if (req.url === '/todos' && req.method === 'GET') {
        return sendJson(res, 200, todos);
    }

    if (req.url === '/todos' && req.method === 'POST') {
        try {
            let body = '';

            for await (const chunk of req) {
                body += chunk;
                if (body.length > 10000) {
                    return sendJson(res, 413, {
                        error: 'Request too large'
                    });
                }
            }

            const data = JSON.parse(body);
            const text = typeof data.text === 'string'
                ? data.text.trim()
                : '';

            if (!text || text.length > 140) {
                return sendJson(res, 400, {
                    error: 'Todo must contain 1-140 characters'
                });
            }

            const todo = { id: randomUUID(), text };
            todos.push(todo);

            return sendJson(res, 201, todo);
        } catch (error) {
            return sendJson(res, 400, {
                error: 'Invalid request body'
            });
        }
    }

    sendJson(res, 404, { error: 'Not found' });
});

server.listen(PORT, () => {
    console.log(`Todo backend listening on port ${PORT}`);
});
