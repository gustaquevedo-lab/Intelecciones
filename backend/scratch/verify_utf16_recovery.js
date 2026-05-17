const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

const corruptedPath = path.join(__dirname, '..', 'temp_db_95b.db');
const recoveredPath = path.join(__dirname, '..', 'recovered_intellecciones.db');

console.log('Reading corrupted database...');
const stat = fs.statSync(corruptedPath);
console.log('Corrupted size:', stat.size, 'bytes');

const data = fs.readFileSync(corruptedPath);
if (data[0] !== 0xff || data[1] !== 0xfe) {
    console.error('File does not start with UTF-16 BOM (FF FE). Cannot recover this way.');
    process.exit(1);
}

console.log('Decoding UTF-16 LE byte mapping...');
// Create a buffer half the size (excluding the 2-byte BOM)
const recoveredLength = (data.length - 2) / 2;
const recoveredBuffer = Buffer.alloc(recoveredLength);

let perfectZeroHighBytes = true;
for (let i = 0; i < recoveredLength; i++) {
    const lowByte = data[2 + i * 2];
    const highByte = data[2 + i * 2 + 1];
    
    recoveredBuffer[i] = lowByte;
    if (highByte !== 0x00) {
        perfectZeroHighBytes = false;
    }
}

console.log('Perfect zero high bytes?', perfectZeroHighBytes);
fs.writeFileSync(recoveredPath, recoveredBuffer);
console.log('Recovered file written to:', recoveredPath, 'Size:', recoveredLength, 'bytes');

// Let's test if better-sqlite3 can open it!
try {
    const db = new Database(recoveredPath);
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
    console.log('SUCCESS! Tables in recovered database:', tables.map(t => t.name).join(', '));
    
    if (tables.some(t => t.name === 'users')) {
        const userRoles = db.prepare("SELECT role, COUNT(*) as count FROM users GROUP BY role").all();
        console.log("Users:", userRoles);
        
        // Show some users
        const sampleUsers = db.prepare("SELECT id, username, nombre, role, parent_id, distrito FROM users LIMIT 10").all();
        console.log("Sample Users:", sampleUsers);
    }
    db.close();
} catch (e) {
    console.error('ERROR opening recovered database:', e);
}
