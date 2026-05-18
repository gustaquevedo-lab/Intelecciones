const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, '..', 'intellecciones.db');
console.log('Opening DB at:', dbPath);

try {
  const db = new Database(dbPath);
  
  // 1. Get the column list for electors table
  const tableInfo = db.prepare("PRAGMA table_info(electors)").all();
  console.log('--- electors Columns ---');
  console.table(tableInfo.map(c => ({ Name: c.name, Type: c.type })));
  
  // 2. Query elector CI 6020750
  const elector = db.prepare("SELECT * FROM electors WHERE ci = ?").get('6020750');
  console.log('\n--- Elector 6020750 ---');
  console.log(JSON.stringify(elector, null, 2));

  // 3. Query all electors where ci is '6020750' or let's search in electors general count
  const count = db.prepare("SELECT COUNT(*) as count FROM electors").get().count;
  console.log('\nTotal electors in DB:', count);
  
  db.close();
} catch (e) {
  console.error('Error querying DB:', e);
}
