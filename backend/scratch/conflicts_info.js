const Database = require('better-sqlite3');
const path = require('path');
const db = new Database(path.join(__dirname, '../intellecciones.db'));

try {
  console.log("=== capture_conflicts columns ===");
  console.log(db.prepare("PRAGMA table_info(capture_conflicts)").all());

  console.log("=== capture_conflicts indexes ===");
  console.log(db.prepare("PRAGMA index_list(capture_conflicts)").all());
  
  console.log("=== capture_conflicts count ===");
  console.log(db.prepare("SELECT COUNT(*) as count FROM capture_conflicts").get());
  console.log(db.prepare("SELECT status, COUNT(*) as count FROM capture_conflicts GROUP BY status").all());
} catch (err) {
  console.error("FAILED:", err.message);
}
