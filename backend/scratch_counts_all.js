const Database = require('better-sqlite3');
const fs = require('fs');

const dbs = [
  'C:\\Users\\Gustavo Quevedo\\OneDrive\\Dev\\Intelecciones\\intellecciones.db',
  'C:\\Users\\Gustavo Quevedo\\OneDrive\\Dev\\Intelecciones\\ruvector.db',
  'C:\\Users\\Gustavo Quevedo\\OneDrive\\Dev\\Intelecciones\\temp_db_95b.db',
  'C:\\Users\\Gustavo Quevedo\\OneDrive\\Dev\\Intelecciones\\backend\\intellecciones.db',
  'C:\\Users\\Gustavo Quevedo\\OneDrive\\Dev\\Intelecciones\\backend\\recovered_intellecciones.db',
  'C:\\Users\\Gustavo Quevedo\\OneDrive\\Dev\\Intelecciones\\backend\\temp_db_95b.db',
  'C:\\Users\\Gustavo Quevedo\\OneDrive\\Dev\\Intelecciones\\backend\\temp_db_95b_binary.db',
  'C:\\Users\\Gustavo Quevedo\\OneDrive\\Dev\\Intelecciones\\backend\\test.db',
  'C:\\Users\\Gustavo Quevedo\\OneDrive\\Dev\\Intelecciones\\backend\\scratch\\intellecciones.db',
  'C:\\Users\\Gustavo Quevedo\\OneDrive\\Dev\\Intelecciones\\backend\\src\\intellecciones.db'
];

for (const dbPath of dbs) {
  if (!fs.existsSync(dbPath)) {
    console.log(`${dbPath} does not exist`);
    continue;
  }
  console.log(`Checking ${dbPath} (${fs.statSync(dbPath).size} bytes)...`);
  try {
    const db = new Database(dbPath);
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
    console.log('  Tables:', tables.map(t => t.name));
    for (const tableObj of tables) {
      const table = tableObj.name;
      try {
        const count = db.prepare(`SELECT count(*) as c from ${table}`).get().c;
        console.log(`    - ${table}: ${count} rows`);
      } catch (err) {
        console.log(`    - ${table}: failed query (${err.message})`);
      }
    }
    db.close();
  } catch (err) {
    console.log(`  Failed to open/query: ${err.message}`);
  }
}
