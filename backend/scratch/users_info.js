const Database = require('better-sqlite3');
const path = require('path');
const db = new Database(path.join(__dirname, '../intellecciones.db'));

try {
  console.log("=== users columns ===");
  console.log(db.prepare("PRAGMA table_info(users)").all());

  console.log("=== users indexes ===");
  console.log(db.prepare("PRAGMA index_list(users)").all());
  
  console.log("=== users count ===");
  console.log(db.prepare("SELECT COUNT(*) as count FROM users").get());
} catch (err) {
  console.error("FAILED:", err.message);
}
