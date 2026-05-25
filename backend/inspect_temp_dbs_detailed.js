const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const paths = [
  path.join(__dirname, 'temp_db_95b.db'),
  path.join(__dirname, '..', 'temp_db_95b.db'),
  path.join(__dirname, 'intellecciones.db'),
  path.join(__dirname, '..', 'intellecciones.db')
];

for (const p of paths) {
  console.log(`\n--- Inspecting: ${p} ---`);
  if (!fs.existsSync(p)) {
    console.log("File does not exist");
    continue;
  }
  const size = fs.statSync(p).size;
  console.log("Size:", size, "bytes");
  try {
    const db = new Database(p);
    const conflicts = db.prepare("SELECT COUNT(*) as count FROM capture_conflicts").get().count;
    const captures = db.prepare("SELECT COUNT(*) as count FROM elector_captures").get().count;
    console.log(`capture_conflicts: ${conflicts}, elector_captures: ${captures}`);
  } catch (e) {
    console.log("Error:", e.message);
  }
}
