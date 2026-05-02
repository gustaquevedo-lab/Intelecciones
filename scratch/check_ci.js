const Database = require('better-sqlite3');
const path = require('path');
const db = new Database(path.join(__dirname, 'backend/intellecciones.db'));

try {
  const sample = db.prepare('SELECT ci FROM electors LIMIT 5').all();
  console.log("Sample CIs:", sample);
} catch (err) {
  console.error(err.message);
}
