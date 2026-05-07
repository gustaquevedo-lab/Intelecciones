const Database = require('better-sqlite3');
const path = require('path');
const dbPath = path.join(__dirname, '..', 'intellecciones.db');
const db = new Database(dbPath);

const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();

tables.forEach(t => {
    const fk = db.prepare(`PRAGMA foreign_key_list(${t.name})`).all();
    fk.forEach(f => {
        if (f.table === 'users') {
            console.log(`Table ${t.name} references users(${f.to}) via column ${f.from}`);
        }
    });
});
