const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const possiblePaths = [
    path.join(__dirname, '..', 'intellecciones.db'),
    path.join(__dirname, '..', '..', 'intellecciones.db'),
    path.join(__dirname, '..', 'database.sqlite'),
    path.join(process.cwd(), 'intellecciones.db'),
    path.join(process.cwd(), 'backend', 'intellecciones.db')
];

let db;
for (const p of possiblePaths) {
    if (fs.existsSync(p)) {
        console.log('Found DB at:', p);
        try {
            db = new Database(p);
            const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
            if (tables.some(t => t.name === 'users')) {
                console.log('Valid DB found!');
                break;
            }
        } catch (e) {
            console.log('Error opening', p, e.message);
        }
    }
}

if (!db) {
    console.error('Could not find a valid database file.');
    process.exit(1);
}

console.log('--- PADRINOS ---');
const padrinos = db.prepare("SELECT id, username, nombre, assigned_list_id, parent_id FROM users WHERE role = 'PADRINO'").all();
console.table(padrinos);

console.log('--- COORDINATORS ---');
const coords = db.prepare("SELECT id, username, nombre, parent_id FROM users WHERE role = 'COORDINADOR' LIMIT 20").all();
console.table(coords);
