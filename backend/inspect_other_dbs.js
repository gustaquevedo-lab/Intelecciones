const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

const dbs = ['intellecciones.db', 'recovered_intellecciones.db', 'temp_db_95b.db'];

for (const dbName of dbs) {
  const dbPath = path.join(__dirname, dbName);
  if (!fs.existsSync(dbPath)) {
    console.log(`\n=== Database ${dbName} does not exist ===`);
    continue;
  }
  
  console.log(`\n=== Database: ${dbName} ===`);
  const db = new Database(dbPath);
  const tables = ['users', 'electors', 'elector_captures', 'capture_conflicts'];
  
  for (const table of tables) {
    try {
      const row = db.prepare(`SELECT COUNT(*) as count FROM ${table}`).get();
      console.log(`${table}: ${row.count}`);
    } catch (e) {
      console.log(`${table}: Error - ${e.message}`);
    }
  }
}
