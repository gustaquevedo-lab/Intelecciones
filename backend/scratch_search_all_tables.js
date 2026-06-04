const Database = require('better-sqlite3');
const db = new Database('c:\\Users\\Gustavo Quevedo\\OneDrive\\Dev\\Intelecciones\\backend\\intellecciones.db');

const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
console.log('Tables and row counts:');
for (const { name } of tables) {
  try {
    const count = db.prepare(`SELECT count(*) as c FROM "${name}"`).get().c;
    console.log(`- ${name}: ${count} rows`);
  } catch (e) {
    console.log(`- ${name}: error (${e.message})`);
  }
}

console.log('\nSearching for "4388985" in all tables...');
for (const { name } of tables) {
  try {
    const cols = db.prepare(`PRAGMA table_info("${name}")`).all();
    for (const col of cols) {
      const colName = col.name;
      const query = `SELECT * FROM "${name}" WHERE CAST("${colName}" AS TEXT) LIKE '%4388985%'`;
      const matches = db.prepare(query).all();
      if (matches.length > 0) {
        console.log(`[MATCH] Table: ${name}, Column: ${colName}`);
        console.log(matches);
      }
    }
  } catch (e) {
    // console.log(`Error searching in table ${name}:`, e.message);
  }
}
db.close();
