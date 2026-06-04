const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, 'intellecciones.db');
console.log('Opening DB at:', dbPath);
const db = new Database(dbPath);

const ci = '6894333';

const elector = db.prepare('SELECT * FROM electors WHERE ci = ?').get(ci);
console.log('Elector details:', elector);

const capture = db.prepare('SELECT * FROM elector_captures WHERE elector_ci = ?').all(ci);
console.log('Capture details:', capture);

const conflicts = db.prepare('SELECT * FROM capture_conflicts WHERE elector_ci = ?').all(ci);
console.log('Conflicts details:', conflicts);
