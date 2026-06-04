const Database = require('better-sqlite3');
const path = require('path');

const db = new Database(path.join(__dirname, 'intellecciones.db'));

try {
  const electors = db.prepare("SELECT * FROM electors").all();
  console.log("Electors in DB:", electors);
} catch (e) {
  console.log("Error querying electors:", e.message);
}
