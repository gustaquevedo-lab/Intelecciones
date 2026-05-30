const Database = require('better-sqlite3');
const path = require('path');
const db = new Database(path.join(__dirname, '../intellecciones.db'));

try {
  console.log("=== campaigns columns ===");
  console.log(db.prepare("PRAGMA table_info(campaigns)").all());

  console.log("=== campaigns indexes ===");
  console.log(db.prepare("PRAGMA index_list(campaigns)").all());
  
  console.log("=== campaigns count ===");
  console.log(db.prepare("SELECT COUNT(*) as count FROM campaigns").get());
} catch (err) {
  console.error("FAILED:", err.message);
}
