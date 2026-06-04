const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, '..', 'intellecciones.db');
console.log('Opening DB at:', dbPath);
const db = new Database(dbPath);

const ci = '4388985';

console.log('--- Checking Elector Table ---');
const elector = db.prepare('SELECT * FROM electors WHERE ci = ?').get(ci);
console.log('Elector details:', elector);

console.log('--- Checking Elector Captures Table ---');
const captures = db.prepare('SELECT * FROM elector_captures WHERE elector_ci = ?').all(ci);
console.log('Captures count:', captures.length);
console.log('Captures:', captures);

console.log('--- Checking Conflicts Table ---');
const conflicts = db.prepare('SELECT * FROM capture_conflicts WHERE elector_ci = ?').all(ci);
console.log('Conflicts count:', conflicts.length);
console.log('Conflicts:', conflicts);
