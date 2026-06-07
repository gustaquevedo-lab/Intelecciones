const Database = require('better-sqlite3');
const db = new Database('intellecciones.db');

try {
  const campaigns = db.prepare('SELECT * FROM campaigns').all();
  console.log('Current campaigns in database:', JSON.stringify(campaigns, null, 2));
} catch (e) {
  console.error('Failed to query campaigns:', e);
}
