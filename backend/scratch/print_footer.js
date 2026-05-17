const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'temp_db_95b.db');
if (!fs.existsSync(filePath)) {
    console.error('File does not exist!');
    process.exit(1);
}

const stat = fs.statSync(filePath);
const size = stat.size;
const readSize = Math.min(size, 200);

const fd = fs.openSync(filePath, 'r');
const buffer = Buffer.alloc(readSize);
fs.readSync(fd, buffer, 0, readSize, size - readSize);
fs.closeSync(fd);

console.log('Footer Hex:', buffer.toString('hex'));
console.log('Footer ASCII:', buffer.toString('ascii').replace(/[^\x20-\x7E]/g, '.'));
