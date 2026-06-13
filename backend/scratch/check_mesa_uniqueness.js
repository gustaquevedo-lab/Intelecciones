const Database = require('better-sqlite3');
const path = require('path');
const dbPath = path.join(__dirname, '../intellecciones.db');
const db = new Database(dbPath);
const count = db.prepare('SELECT COUNT(*) as count FROM electors').get();
console.log('Total electors:', count);
const districts = db.prepare('SELECT distrito, COUNT(*) as count FROM electors GROUP BY distrito').all();
console.log('Unique districts:', districts);
