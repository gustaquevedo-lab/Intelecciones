const Database = require('better-sqlite3');
const db = new Database('intellecciones.db');

try {
  const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
  for (const t of tables) {
    const count = db.prepare(`SELECT count(*) as c FROM ${t.name}`).get().c;
    console.log(`Table: ${t.name} -> Rows: ${count}`);
  }
} catch (e) {
  console.error(e);
}
db.close();
