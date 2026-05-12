const Database = require('better-sqlite3');
const path = require('path');
const dbPath = path.join(__dirname, '..', 'intellecciones.db');
const db = new Database(dbPath);

console.log('--- PADRINOS ---');
const padrinos = db.prepare("SELECT id, username, nombre, assigned_list_id FROM users WHERE role = 'PADRINO'").all();
console.table(padrinos);

console.log('--- LISTS ---');
const lists = db.prepare("SELECT id, list_number, option_number, candidate_nombre FROM lists").all();
console.table(lists);
