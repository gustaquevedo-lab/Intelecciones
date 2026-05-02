const Database = require('better-sqlite3');
const path = require('path');
const db = new Database(path.join(__dirname, 'backend/intellecciones.db'));

try {
  const count = db.prepare('SELECT COUNT(*) as count FROM electors').get();
  console.log("Total electors:", count.count);
  if (count.count > 0) {
    const sample = db.prepare('SELECT ci, nombre, apellido FROM electors LIMIT 5').all();
    console.log("Samples:", sample);
  }
} catch (err) {
  console.error(err.message);
}
