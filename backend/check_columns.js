const Database = require('better-sqlite3');
const path = require('path');
const dbPath = path.join(__dirname, 'intellecciones.db');
const db = new Database(dbPath);

console.log('--- VEHICLES COLUMNS ---');
const info = db.prepare("PRAGMA table_info(vehicles)").all();
console.log(JSON.stringify(info, null, 2));

process.exit(0);
