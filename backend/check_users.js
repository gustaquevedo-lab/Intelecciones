const Database = require('better-sqlite3');
const path = require('path');
const dbPath = path.join(__dirname, 'intellecciones.db');
const db = new Database(dbPath);

const users = db.prepare("SELECT username, password, role FROM users").all();
console.log(JSON.stringify(users, null, 2));
process.exit(0);
