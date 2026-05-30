const Database = require('better-sqlite3');
const path = require('path');
const db = new Database(path.join(__dirname, '../intellecciones.db'));

try {
  console.log("=== elector_captures columns ===");
  console.log(db.prepare("PRAGMA table_info(elector_captures)").all());
  
  console.log("=== lists columns ===");
  console.log(db.prepare("PRAGMA table_info(lists)").all());

  console.log("=== lists indexes ===");
  console.log(db.prepare("PRAGMA index_list(lists)").all());
} catch (err) {
  console.error("FAILED:", err.message);
}
