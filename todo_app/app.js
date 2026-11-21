const http = require('node:http');
const fs = require('node:fs/promises');

function requiredEnv(name) {
    const value = process.env[name];

    if (!value) {
        throw new Error(`Missing environment variable: ${name}`);
    }

    return value;
}

function numberEnv(name) {
    const value = Number(requiredEnv(name));

    if (!Number.isSafeInteger(value) || value <= 0) {
        throw new Error(`Invalid environment variable: ${name}`);
    }

    return value;
}

const PORT = numberEnv('PORT');
const IMAGE_PATH = requiredEnv('IMAGE_PATH');
const IMAGE_URL = requiredEnv('IMAGE_URL');
const CACHE_DURATION_MS = numberEnv('CACHE_DURATION_MS');
const IMAGE_TIMEOUT_MS = numberEnv('IMAGE_TIMEOUT_MS');
const BACKEND_TIMEOUT_MS = numberEnv('BACKEND_TIMEOUT_MS');
const TODO_MAX_LENGTH = numberEnv('TODO_MAX_LENGTH');
const TODO_BACKEND_URL = requiredEnv('TODO_BACKEND_URL')
    .replace(/\/+$/, '');

if (PORT > 65535) {
    throw new Error('Invalid PORT');
}

let pendingDownload = null;

async function getImage() {
    try {
        const stats = await fs.stat(IMAGE_PATH);
        const age = Date.now() - stats.mtimeMs;

        if (age < CACHE_DURATION_MS) {
            return fs.readFile(IMAGE_PATH);
        }
    } catch (error) {
        if (error.code !== 'ENOENT') throw error;
    }

    if (!pendingDownload) {
        pendingDownload = downloadImage()
            .finally(() => {
                pendingDownload = null;
            });
    }

    try {
        await pendingDownload;
    } catch (error) {
        console.error('Image download failed:', error.message);
    }

    return fs.readFile(IMAGE_PATH);
}

async function downloadImage() {
    const response = await fetch(IMAGE_URL, {
        signal: AbortSignal.timeout(IMAGE_TIMEOUT_MS)
    });

    if (!response.ok) {
        throw new Error(`Image service returned ${response.status}`);
    }

    const image = Buffer.from(await response.arrayBuffer());
    const tempPath = `${IMAGE_PATH}.tmp`;

    await fs.writeFile(tempPath, image);
    await fs.rename(tempPath, IMAGE_PATH);

    console.log('Image cache updated');
}

const server = http.createServer(async (req, res) => {

    // Proxy requests to Todo Backend
    if (req.url === '/todos' &&
        (req.method === 'GET' || req.method === 'POST')) {
        try {
            let body;

            if (req.method === 'POST') {
                const chunks = [];

                for await (const chunk of req) {
                    chunks.push(chunk);
                }

                body = Buffer.concat(chunks);
            }

            const response = await fetch(`${TODO_BACKEND_URL}/todos`, {
                method: req.method,
                headers: req.method === 'POST'
                    ? { 'Content-Type': 'application/json' }
                    : {},
                body,
                signal: AbortSignal.timeout(BACKEND_TIMEOUT_MS)
            });

            const result = await response.text();

            res.writeHead(response.status, {
                'Content-Type': 'application/json; charset=utf-8'
            });
            res.end(result);

        } catch (error) {
            console.error('Backend error:', error);
            res.writeHead(502, {
                'Content-Type': 'application/json'
            });
            res.end(JSON.stringify({
                error: 'Backend unavailable'
            }));
        }
        return;
    }

    // Serve HTML
    if (req.method === 'GET' && req.url === '/') {
        res.writeHead(200, {
            'Content-Type': 'text/html; charset=utf-8'
        });

        res.end(`
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Todo App</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            max-width: 650px;
            margin: 40px auto;
            padding: 0 20px;
        }

        img {
            width: 100%;
            border-radius: 8px;
        }

        .todo-form {
            display: flex;
            gap: 10px;
            margin-top: 20px;
        }

        input {
            flex: 1;
            padding: 10px;
        }

        button {
            padding: 10px 20px;
            cursor: pointer;
        }

        li {
            margin: 10px 0;
        }

        #error {
            color: red;
        }
    </style>
</head>
<body>
    <h1>Todo App</h1>

    <img src="/image" alt="Random picture">

    <h2>New Todo</h2>

    <form id="todo-form" class="todo-form">
        <input
            type="text"
            id="todo"
            placeholder="Enter a new todo"
            maxlength="${TODO_MAX_LENGTH}"
            required
        >
        <button type="submit">Send</button>
    </form>

    <p id="error" role="alert"></p>

    <h2>Todo List</h2>
    <ul id="todo-list"></ul>

    <script>
        const form = document.getElementById('todo-form');
        const input = document.getElementById('todo');
        const list = document.getElementById('todo-list');
        const error = document.getElementById('error');

        async function loadTodos() {
            const response = await fetch('/todos');

            if (!response.ok) {
                throw new Error('Could not load todos');
            }

            const todos = await response.json();
            list.replaceChildren();

            todos.forEach(todo => {
                const item = document.createElement('li');
                item.textContent = todo.text;
                list.appendChild(item);
            });
        }

        form.addEventListener('submit', async event => {
            event.preventDefault();

            const text = input.value.trim();
            if (!text) return;

            try {
                const response = await fetch('/todos', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ text })
                });

                if (!response.ok) {
                    throw new Error('Could not create todo');
                }

                input.value = '';
                error.textContent = '';

                await loadTodos();
            } catch (err) {
                error.textContent = err.message;
            }
        });

        loadTodos().catch(err => {
            error.textContent = err.message;
        });
    </script>
</body>
</html>
        `);
        return;
    }

    // Serve cached image
    if (req.method === 'GET' && req.url === '/image') {
        try {
            const image = await getImage();

            res.writeHead(200, {
                'Content-Type': 'image/jpeg',
                'Cache-Control': 'no-store'
            });

            res.end(image);
        } catch (error) {
            console.error('Unable to load image:', error);
            res.writeHead(503);
            res.end('Image unavailable');
        }
        return;
    }

    res.writeHead(404);
    res.end('Not Found');
});

server.listen(PORT, () => {
    console.log(`Todo App listening on port ${PORT}`);
});
