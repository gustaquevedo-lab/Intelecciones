const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const p = path.join(__dirname, '..', 'temp_db_95b.db');
if (fs.existsSync(p)) {
    console.log('Found temp DB at:', p);
    const db = new Database(p);
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
    console.log('Tables:', tables.map(t => t.name).join(', '));
    
    if (tables.some(t => t.name === 'users')) {
        console.log('--- PADRINOS ---');
        const padrinos = db.prepare("SELECT id, username, nombre, assigned_list_id FROM users WHERE role = 'PADRINO'").all();
        console.table(padrinos);

        console.log('--- LISTS ---');
        const lists = db.prepare("SELECT id, list_number, option_number, candidate_nombre FROM lists").all();
        console.table(lists);
    }
} else {
    console.error('temp_db_95b.db not found');
}
