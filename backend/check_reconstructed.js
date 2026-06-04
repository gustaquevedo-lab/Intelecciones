const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, 'temp_db_95b_binary.db');
console.log("Opening reconstructed DB:", dbPath);

try {
  const db = new Database(dbPath);
  const integrity = db.prepare("PRAGMA integrity_check").all();
  console.log("Integrity check result:", integrity);

  const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
  console.log("Tables in reconstructed DB:", tables.map(t => t.name).join(", "));
  
  for (const tableObj of tables) {
    const table = tableObj.name;
    try {
      const count = db.prepare(`SELECT COUNT(*) as count FROM ${table}`).get().count;
      console.log(`- ${table}: ${count} rows`);
    } catch (e) {
      console.log(`- ${table}: failed (${e.message})`);
    }
  }
} catch (e) {
  console.error("Error opening/querying reconstructed DB:", e.message);
}
