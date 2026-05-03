const Database = require('better-sqlite3');
const path = require('path');
const dbPath = path.join(__dirname, 'intellecciones.db');
const db = new Database(dbPath);

console.log('--- ELECTOR DISTRIBUTION ---');
const stats = db.prepare('SELECT local_votacion, COUNT(*) as count FROM electors GROUP BY local_votacion').all();
stats.forEach(s => console.log(` - ${s.local_votacion}: ${s.count} electors`));
