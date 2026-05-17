const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'temp_db_95b.db');
if (!fs.existsSync(filePath)) {
    console.error('File does not exist!');
    process.exit(1);
}

const fd = fs.openSync(filePath, 'r');
const buffer = Buffer.alloc(50);
fs.readSync(fd, buffer, 0, 50, 0);
fs.closeSync(fd);

console.log('Hex Header:', buffer.toString('hex'));
console.log('ASCII Header:', buffer.toString('ascii').replace(/[^\x20-\x7E]/g, '.'));
