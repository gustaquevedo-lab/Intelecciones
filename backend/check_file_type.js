const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'recovered_intellecciones.db');
if (!fs.existsSync(filePath)) {
  console.log("File not found");
  process.exit(0);
}

const buffer = Buffer.alloc(100);
const fd = fs.openSync(filePath, 'r');
fs.readSync(fd, buffer, 0, 100, 0);
fs.closeSync(fd);

console.log("Hex representation:");
console.log(buffer.toString('hex'));
console.log("\nASCII representation:");
console.log(buffer.toString('ascii'));
