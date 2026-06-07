const Database = require('better-sqlite3');
const db = new Database('intellecciones.db');

try {
  const lists = db.prepare('SELECT * FROM lists').all();
  console.log('Current lists in database:', JSON.stringify(lists, null, 2));
} catch (e) {
  console.error('Failed to query lists:', e);
}
