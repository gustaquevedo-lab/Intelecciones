const Database = require('better-sqlite3');
const path = require('path');
const dbPath = path.join(__dirname, '..', 'intellecciones.db');
const db = new Database(dbPath);

const users = db.prepare('SELECT id, nombre, username, role, distrito FROM users').all();
console.log("USERS:", users);
