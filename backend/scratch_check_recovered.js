const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, 'temp_db_95b_binary.db');
console.log('Trying to open:', dbPath);
try {
  const db = new Database(dbPath);
  const integrity = db.prepare('PRAGMA integrity_check').all();
  console.log('Integrity check:', integrity);
  const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
  console.log('Tables:', tables.map(t => t.name));
  db.close();
} catch (e) {
  console.error('Error:', e.message);
}
