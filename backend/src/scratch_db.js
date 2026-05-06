const Database = require('better-sqlite3');
const path = require('path');
const dbPath = path.join(__dirname, '..', 'intellecciones.db');
const db = new Database(dbPath);

const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
console.log("Tables:", tables.map(t => t.name).join(", "));

tables.forEach(t => {
    const info = db.prepare(`PRAGMA table_info(${t.name})`).all();
    console.log(`Table ${t.name}:`, info.map(i => i.name).join(", "));
});
