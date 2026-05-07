
const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, '../backend/intellecciones.db');
console.log('Opening DB at:', dbPath);
const db = new Database(dbPath);

try {
  const result = db.prepare("UPDATE electors SET distrito = 'Pedro Juan Caballero' WHERE distrito IS NULL OR distrito = ''").run();
  console.log(`Updated ${result.changes} electors to 'Pedro Juan Caballero'.`);
} catch (err) {
  console.error('Error updating electors:', err);
} finally {
  db.close();
}
