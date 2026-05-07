const Database = require('better-sqlite3');
const path = require('path');
const dbPath = path.join(__dirname, '..', 'intellecciones.db');
const db = new Database(dbPath);

const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();

tables.forEach(t => {
    const info = db.prepare(`PRAGMA table_info(${t.name})`).all();
    info.forEach(c => {
        const name = c.name.toLowerCase();
        if (name.includes('user') || name.includes('coord') || name.includes('veedor') || name.includes('jefe')) {
            console.log(`Potential link in Table ${t.name}, Column ${c.name}`);
        }
    });
});
