const Database = require('better-sqlite3');
const path = require('path');
const dbPath = path.join(process.cwd(), 'backend', 'intellecciones.db');
const db = new Database(dbPath);

try {
  const row = db.prepare('SELECT ci, nombre, apellido FROM electors LIMIT 1').get();
  console.log("Try this CI:", row);
} catch (err) {
  console.error(err.message);
}
