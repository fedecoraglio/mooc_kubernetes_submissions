
const http = require('node:http');
const fs = require('node:fs/promises');
const path = require('node:path');

const PORT = process.env.PORT || 3000;
const IMAGE_PATH = '/data/image.jpg';
const CACHE_DURATION = 10 * 60 * 1000; // 10 minutes

let pendingDownload = null;

async function getImage() {
    // Check if the cached image is still valid
    try {
        const stats = await fs.stat(IMAGE_PATH);
        const age = Date.now() - stats.mtimeMs;

        if (age < CACHE_DURATION) {
            return fs.readFile(IMAGE_PATH);
        }
    } catch (error) {
        if (error.code !== 'ENOENT') throw error;
    }

    // Avoid simultaneous downloads
    if (!pendingDownload) {
        pendingDownload = downloadImage()
            .finally(() => pendingDownload = null);
    }

    try {
        await pendingDownload;
    } catch (error) {
        console.error('Image download failed:', error.message);
        // Use the old image if Picsum is unavailable
    }

    return fs.readFile(IMAGE_PATH);
}

async function downloadImage() {
    const response = await fetch('https://picsum.photos/1200', {
        signal: AbortSignal.timeout(15000)
    });

    if (!response.ok) {
        throw new Error(`Picsum returned ${response.status}`);
    }

    const image = Buffer.from(await response.arrayBuffer());

    // Atomic replacement to avoid partially written images
    const tempPath = `${IMAGE_PATH}.tmp`;

    await fs.writeFile(tempPath, image);
    await fs.rename(tempPath, IMAGE_PATH);

    console.log('Image cache updated');
}

const server = http.createServer(async (req, res) => {

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
            </style>
        </head>
        <body>
            <h1>Todo App</h1>

            <img src="/image" alt="Random picture">

            <h2>New Todo</h2>

            <div class="todo-form">
                <input
                    type="text"
                    id="todo"
                    placeholder="Enter a new todo"
                    maxlength="140"
                >
                <button type="button">Send</button>
            </div>

            <h2>Todo List</h2>

            <ul>
                <li>Learn Kubernetes</li>
                <li>Complete the MOOC exercises</li>
                <li>Deploy Todo App to Kubernetes</li>
            </ul>
        </body>
        </html>
    `);
        return;
    }

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
    console.log(`Server started in port ${PORT}`);
});
