const Database = require('better-sqlite3');
const path = require('path');

const db = new Database(path.join(__dirname, 'intellecciones.db'));

try {
  const electors = db.prepare("SELECT * FROM electors").all();
  console.log("All electors in DB:", electors);
  
  const captures = db.prepare("SELECT * FROM elector_captures").all();
  console.log("All captures in DB:", captures);

  const users = db.prepare("SELECT * FROM users").all();
  console.log("All users in DB:", users);
} catch (e) {
  console.error("Error:", e.message);
}
