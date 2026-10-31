
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
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });

        res.end(`
            <!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <title>Todo App</title>
            </head>
            <body>
                <h1>Todo App</h1>
                <p>Welcome to my Kubernetes application!</p>
                <img src="/image" alt="Random picture" width="600">
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
