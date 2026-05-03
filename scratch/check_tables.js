const Database = require('better-sqlite3');
const db = new Database('backend/intellecciones.db');

try {
  const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
  console.log('Tables:', tables.map(t => t.name));
  
  if (tables.find(t => t.name === 'results')) {
    const resultsCount = db.prepare('SELECT COUNT(*) as count FROM results').get();
    console.log('Results records:', resultsCount.count);
  } else {
    console.log('Table "results" does not exist.');
  }
} catch (err) {
  console.error(err);
}
