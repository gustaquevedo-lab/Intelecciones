const Database = require('better-sqlite3');
const path = require('path');

const db = new Database(path.join(__dirname, '../backend/intellecciones.db'));

try {
  // Add columns to lists
  db.exec("ALTER TABLE lists ADD COLUMN photo_url TEXT");
  console.log("Added photo_url to lists");
} catch (e) {
  console.log("photo_url already exists or error:", e.message);
}

try {
  db.exec("ALTER TABLE lists ADD COLUMN goal_captures INTEGER DEFAULT 1000");
  console.log("Added goal_captures to lists");
} catch (e) {
  console.log("goal_captures already exists or error:", e.message);
}

// Add new settings
db.exec("INSERT OR IGNORE INTO settings (key, value) VALUES ('app_name', 'INTELECCIONES 2026')");
db.exec("INSERT OR IGNORE INTO settings (key, value) VALUES ('app_logo_url', '')");

console.log("Migration complete!");
db.close();
