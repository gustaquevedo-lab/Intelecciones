const Database = require('better-sqlite3');
const path = require('path');
const db = new Database(path.join(__dirname, '..', 'intellecciones.db'));

console.log('--- Conflicts ---');
console.log(db.prepare('SELECT * FROM capture_conflicts').all());

console.log('--- Captures ---');
console.log(db.prepare('SELECT * FROM elector_captures').all());

console.log('--- Electors ---');
console.log(db.prepare('SELECT * FROM electors').all());
