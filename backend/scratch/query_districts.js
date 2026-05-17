const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, '..', 'intellecciones.db');
const db = new Database(dbPath);

console.log('--- ELECTORS COUNT ---');
const count = db.prepare("SELECT COUNT(*) as count FROM electors").get();
console.log('Total electors:', count.count);

console.log('\n--- SAMPLE ELECTORS ---');
const samples = db.prepare("SELECT ci, nombre, apellido, local_votacion, mesa, orden, ciudad, distrito FROM electors LIMIT 5").all();
console.log(JSON.stringify(samples, null, 2));

console.log('\n--- UNIQUE CITIES / DISTRICTS ---');
const districts = db.prepare("SELECT distrito, ciudad, COUNT(*) as count FROM electors GROUP BY distrito, ciudad").all();
console.log(JSON.stringify(districts, null, 2));
