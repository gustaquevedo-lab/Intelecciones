const Database = require('better-sqlite3');
const path = require('path');

const db = new Database(path.join(__dirname, 'intellecciones.db'));
const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();

console.log("Row counts for all tables in backend/intellecciones.db:");
for (const tableObj of tables) {
  const table = tableObj.name;
  try {
    const count = db.prepare(`SELECT COUNT(*) as count FROM ${table}`).get().count;
    if (count > 0) {
      console.log(`- ${table}: ${count} rows`);
    }
  } catch (e) {
    console.log(`- ${table}: query failed (${e.message})`);
  }
}
