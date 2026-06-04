const Database = require('better-sqlite3');

const dbPath = 'c:\\Users\\Gustavo Quevedo\\OneDrive\\Dev\\Intelecciones\\backend\\temp_db_95b_binary.db';
console.log('Opening database:', dbPath);

try {
  const db = new Database(dbPath);
  
  // Try to run integrity check
  try {
    const integrity = db.prepare('PRAGMA integrity_check').all();
    console.log('Integrity check:', integrity);
  } catch (e) {
    console.log('Integrity check failed:', e.message);
  }

  // Get tables
  let tables = [];
  try {
    tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
    console.log('Tables found:', tables.map(t => t.name));
  } catch (e) {
    console.log('Failed to fetch tables:', e.message);
  }

  for (const { name } of tables) {
    try {
      const count = db.prepare(`SELECT count(*) as c FROM "${name}"`).get().c;
      console.log(`Table "${name}": ${count} rows`);
      
      if (name === 'electors') {
        const row = db.prepare('SELECT * FROM electors WHERE ci = ?').get('4388985');
        console.log('  Elector 4388985:', row);
      }
      if (name === 'elector_captures') {
        const row = db.prepare('SELECT * FROM elector_captures WHERE elector_ci = ?').get('4388985');
        console.log('  Capture 4388985:', row);
      }
    } catch (e) {
      console.log(`  Error querying table "${name}":`, e.message);
    }
  }

  db.close();
} catch (e) {
  console.error('Failed to open/process database:', e.message);
}
