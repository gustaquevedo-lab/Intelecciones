const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, '..', 'ruvector.db');
console.log("Opening DB:", dbPath);
try {
  const db = new Database(dbPath);
  const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
  console.log("Tables in ruvector.db:", tables.map(t => t.name));
  for (const tableObj of tables) {
    const table = tableObj.name;
    const count = db.prepare(`SELECT COUNT(*) as count FROM ${table}`).get().count;
    console.log(`Table ${table} has ${count} rows`);
  }
} catch (e) {
  console.error("Error opening/querying ruvector.db:", e.message);
}
