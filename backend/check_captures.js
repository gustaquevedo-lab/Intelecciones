const Database = require('better-sqlite3');
const path = require('path');
const dbPath = path.join(__dirname, 'intellecciones.db');
const db = new Database(dbPath);

console.log('--- ELECTOR CAPTURES ---');
const captures = db.prepare("SELECT * FROM elector_captures").all();
console.log(JSON.stringify(captures, null, 2));

process.exit(0);
