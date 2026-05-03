const Database = require('better-sqlite3');
const path = require('path');
const dbPath = path.join(__dirname, 'intellecciones.db');
const db = new Database(dbPath);

console.log('--- VEHICLES ---');
const vehicles = db.prepare("SELECT * FROM vehicles").all();
console.log(JSON.stringify(vehicles, null, 2));

console.log('--- LOGISTICS (ASSIGNMENTS) ---');
try {
  const logistics = db.prepare("SELECT * FROM logistics").all();
  console.log(JSON.stringify(logistics, null, 2));
} catch(e) { console.log('Logistics table error:', e.message); }

console.log('--- PENDING REQUESTS ---');
const pending = db.prepare("SELECT ci, nombre, barrio, local_votacion, needs_transport FROM electors WHERE needs_transport = 1").all();
console.log(JSON.stringify(pending, null, 2));

process.exit(0);
