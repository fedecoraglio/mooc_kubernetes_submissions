
const { randomUUID } = require('node:crypto');

// Generate a random string once at startup
const randomString = randomUUID();

function logMessage() {
    console.log(`${new Date().toISOString()}: ${randomString}`);
}

// Print every 5 seconds
setInterval(logMessage, 5000);
