
const http = require('node:http');
const { Pool } = require('pg');

function requiredEnv(name) {
    const value = process.env[name];

    if (!value) {
        throw new Error(`Missing environment variable: ${name}`);
    }

    return value;
}

const PORT = Number(requiredEnv('PORT'));

const pool = new Pool({
    host: requiredEnv('PGHOST'),
    port: Number(requiredEnv('PGPORT')),
    user: requiredEnv('PGUSER'),
    password: requiredEnv('PGPASSWORD'),
    database: requiredEnv('PGDATABASE'),
    connectionTimeoutMillis: Number(requiredEnv('DB_TIMEOUT_MS'))
});

pool.on('error', error => {
    console.error('PostgreSQL connection error:', error);
});

// Initialize database
async function initializeDatabase() {
    await pool.query(`
        CREATE TABLE IF NOT EXISTS ping_pong_counter (
            id INTEGER PRIMARY KEY,
            value BIGINT NOT NULL DEFAULT 0
        )
    `);

    await pool.query(`
        INSERT INTO ping_pong_counter (id, value)
        VALUES (1, 0)
        ON CONFLICT (id) DO NOTHING
    `);

    console.log('Database initialized');
}

const server = http.createServer(async (req, res) => {
    try {
        // Increment counter atomically
        if (req.method === 'GET' && req.url === '/pingpong') {
            const result = await pool.query(`
                UPDATE ping_pong_counter
                SET value = value + 1
                WHERE id = 1
                RETURNING value - 1 AS previous_count
            `);

            const count = result.rows[0].previous_count;

            res.writeHead(200, {
                'Content-Type': 'text/plain'
            });

            res.end(`pong ${count}`);
            return;
        }

        // Get current counter
        if (req.method === 'GET' && req.url === '/count') {
            const result = await pool.query(`
                SELECT value
                FROM ping_pong_counter
                WHERE id = 1
            `);

            res.writeHead(200, {
                'Content-Type': 'text/plain'
            });

            res.end(String(result.rows[0].value));
            return;
        }

        res.writeHead(404);
        res.end('Not Found');

    } catch (error) {
        console.error('Database operation failed:', error);

        res.writeHead(503);
        res.end('Database unavailable');
    }
});

// Start HTTP server only after database initialization
initializeDatabase()
    .then(() => {
        server.listen(PORT, () => {
            console.log(`Ping pong listening on port ${PORT}`);
        });
    })
    .catch(error => {
        console.error('Database initialization failed:', error);
        process.exit(1);
    });
