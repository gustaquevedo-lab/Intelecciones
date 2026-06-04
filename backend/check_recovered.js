const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, 'recovered_intellecciones.db');
console.log("Opening DB:", dbPath);
const db = new Database(dbPath);

try {
  const integrity = db.prepare("PRAGMA integrity_check").all();
  console.log("Integrity check result:", integrity);
} catch (e) {
  console.error("Integrity check failed:", e.message);
}

try {
  const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
  console.log("Tables:", tables.map(t => t.name));
  
  for (const tableObj of tables) {
    const table = tableObj.name;
    try {
      const count = db.prepare(`SELECT COUNT(*) as count FROM ${table}`).get().count;
      console.log(`Table ${table} has ${count} rows`);
    } catch (e) {
      console.log(`Table ${table} query failed: ${e.message}`);
    }
  }
} catch (e) {
  console.error("Query tables failed:", e.message);
}
