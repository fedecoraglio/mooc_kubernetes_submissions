
const fs = require('node:fs');
const { randomUUID } = require('node:crypto');

const randomString = randomUUID();
const FILE_PATH = '/shared/log.txt';

function writeLog() {
    const message = `${new Date().toISOString()}: ${randomString}`;

    fs.writeFileSync(FILE_PATH, message + '\n');
    console.log(message);
}

writeLog();
setInterval(writeLog, 5000);
