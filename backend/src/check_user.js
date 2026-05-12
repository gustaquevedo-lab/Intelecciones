const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(process.cwd(), 'intellecciones.db');
const db = new Database(dbPath);

const user = db.prepare('SELECT * FROM users WHERE username = ?').get('4500001');
console.log('User 4500001:', user);

const lists = db.prepare('SELECT * FROM lists').all();
console.log('Available Lists:', lists);
