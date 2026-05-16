const Database = require('better-sqlite3');
const path = require('path');
const db = new Database(path.resolve('backend/intellecciones.db'));

try {
  const rows = db.prepare('SELECT id, capture_id, capture_id_b FROM capture_conflicts LIMIT 10').all();
  console.log('Capture Conflicts Sample:', JSON.stringify(rows, null, 2));
} catch (e) {
  console.error('Error:', e.message);
}
