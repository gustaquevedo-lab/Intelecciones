const fs = require('fs');
const path = require('path');

const corruptedPath = path.join(__dirname, 'temp_db_95b.db');
if (!fs.existsSync(corruptedPath)) {
  console.log("File not found");
  process.exit(1);
}

const buf = fs.readFileSync(corruptedPath);
console.log("Length:", buf.length);
console.log("Hex (first 100):", buf.slice(0, 100).toString('hex'));
console.log("ASCII (first 100):", buf.slice(0, 100).toString('ascii'));
console.log("UTF-16LE (first 100):", buf.slice(0, 100).toString('utf16le'));
