const Database = require('better-sqlite3');
const path = require('path');

const db = new Database(path.join(__dirname, '../backend/intellecciones.db'));

try {
  // Add columns to elector_captures
  db.exec("ALTER TABLE elector_captures ADD COLUMN needs_transport BOOLEAN DEFAULT 0");
  db.exec("ALTER TABLE elector_captures ADD COLUMN vehicle_id INTEGER");
  console.log("Updated elector_captures table");
} catch (e) {
  console.log("elector_captures already updated or error:", e.message);
}

try {
  db.exec(`
    CREATE TABLE IF NOT EXISTS vehicles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      description TEXT NOT NULL,
      driver_name TEXT,
      driver_phone TEXT,
      assigned_list_id INTEGER,
      FOREIGN KEY(assigned_list_id) REFERENCES lists(id)
    )
  `);
  console.log("Created vehicles table");
} catch (e) {
  console.log("Error creating vehicles table:", e.message);
}

console.log("Migration complete!");
db.close();
