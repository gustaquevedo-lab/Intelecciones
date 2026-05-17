const Database = require('better-sqlite3');
const dbPath = 'c:\\Users\\Gustavo Quevedo\\OneDrive\\Dev\\Intelecciones\\intellecciones.db';
const db = new Database(dbPath);

try {
  const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
  console.log(`\nTable Row Counts for: ${dbPath}`);
  for (const t of tables) {
    try {
      const count = db.prepare(`SELECT COUNT(*) as count FROM ${t.name}`).get().count;
      console.log(`  Table '${t.name}': ${count} rows`);
    } catch (e) {
      console.log(`  Table '${t.name}': Error: ${e.message}`);
    }
  }
} catch (e) {
  console.error("Error:", e);
}
