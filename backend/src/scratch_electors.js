const Database = require('better-sqlite3');
const path = require('path');
const dbPath = path.join(__dirname, '..', 'intellecciones.db');
const db = new Database(dbPath);

const info = db.prepare(`PRAGMA table_info(electors)`).all();
console.log(`Table electors:`, info.map(i => i.name).join(", "));
