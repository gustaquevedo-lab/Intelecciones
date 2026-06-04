const Database = require('better-sqlite3');
const path = require('path');

const db = new Database(path.join(__dirname, 'intellecciones.db'));
const targets = ['7424600', '7170676'];

const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();

for (const target of targets) {
  console.log(`\nSearching for: ${target}`);
  let found = false;

  for (const tableObj of tables) {
    const table = tableObj.name;
    if (table.startsWith('sqlite_')) continue;

    try {
      const columns = db.prepare(`PRAGMA table_info(${table})`).all();
      for (const col of columns) {
        const colName = col.name;
        // Construct query to find target in this column
        const query = `SELECT * FROM ${table} WHERE CAST(${colName} AS TEXT) LIKE ? LIMIT 5`;
        const rows = db.prepare(query).all(`%${target}%`);
        if (rows.length > 0) {
          console.log(`  Found in table: [${table}], column: [${colName}]`);
          console.log(`  Rows:`, rows);
          found = true;
        }
      }
    } catch (e) {
      // Ignore errors for virtual tables etc
    }
  }

  if (!found) {
    console.log(`  Not found anywhere in the DB.`);
  }
}
