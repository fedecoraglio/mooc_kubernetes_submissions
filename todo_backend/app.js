
const http = require('node:http');
const mysql = require('mysql2/promise');

function requiredEnv(name) {
    const value = process.env[name];

    if (!value) {
        throw new Error(`Missing environment variable: ${name}`);
    }

    return value;
}

function requiredNumber(name) {
    const value = Number(requiredEnv(name));

    if (!Number.isSafeInteger(value) || value <= 0) {
        throw new Error(`Invalid environment variable: ${name}`);
    }

    return value;
}

const PORT = requiredNumber('PORT');
const TODO_MAX_LENGTH = requiredNumber('TODO_MAX_LENGTH');
const MAX_REQUEST_BYTES = requiredNumber('MAX_REQUEST_BYTES');

const pool = mysql.createPool({
    host: requiredEnv('DB_HOST'),
    port: requiredNumber('DB_PORT'),
    user: requiredEnv('DB_USER'),
    password: requiredEnv('DB_PASSWORD'),
    database: requiredEnv('DB_NAME'),
    waitForConnections: true,
    connectionLimit: 5
});

function sendJson(res, status, data) {
    res.writeHead(status, {
        'Content-Type': 'application/json; charset=utf-8'
    });

    res.end(JSON.stringify(data));
}

async function initializeDatabase() {
    await pool.query(`
        CREATE TABLE IF NOT EXISTS todos (
            id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
            text TEXT NOT NULL
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    console.log('Todos table initialized');
}

const server = http.createServer(async (req, res) => {

    // Get all todos
    if (req.method === 'GET' && req.url === '/todos') {
        try {
            const [rows] = await pool.execute(
                'SELECT id, text FROM todos ORDER BY id'
            );

            return sendJson(res, 200, rows);
        } catch (error) {
            console.error('Failed to fetch todos:', error);
            return sendJson(res, 503, {
                error: 'Database unavailable'
            });
        }
    }

    // Create a todo
    if (req.method === 'POST' && req.url === '/todos') {
        let data;

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

            data = JSON.parse(
                Buffer.concat(chunks).toString('utf8')
            );
        } catch (error) {
            return sendJson(res, 400, {
                error: 'Invalid JSON body'
            });
        }

        const text = typeof data?.text === 'string'
            ? data.text.trim()
            : '';

        if (!text || text.length > TODO_MAX_LENGTH) {
            return sendJson(res, 400, {
                error: `Todo must contain 1-${TODO_MAX_LENGTH} characters`
            });
        }

        try {
            const [result] = await pool.execute(
                'INSERT INTO todos (text) VALUES (?)',
                [text]
            );

            return sendJson(res, 201, {
                id: result.insertId,
                text
            });
        } catch (error) {
            console.error('Failed to create todo:', error);
            return sendJson(res, 503, {
                error: 'Database unavailable'
            });
        }
    }

    return sendJson(res, 404, {
        error: 'Not found'
    });
});

initializeDatabase()
    .then(() => {
        server.listen(PORT, () => {
            console.log(`Todo Backend listening on port ${PORT}`);
        });
    })
    .catch(error => {
        console.error('Database initialization failed:', error);
        process.exit(1);
    });
