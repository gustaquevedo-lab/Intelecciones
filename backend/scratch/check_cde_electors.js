const Database = require('better-sqlite3');
const path = require('path');

const dbs = [
  path.join(__dirname, '..', 'intellecciones.db'),
  path.join(__dirname, '..', 'recovered_intellecciones.db'),
  path.join(__dirname, '..', 'temp_db_95b.db'),
  path.join(__dirname, '..', '..', 'intellecciones.db')
];

for (const dbPath of dbs) {
  console.log('\n=========================================');
  console.log('Opening DB at:', dbPath);
  try {
    const db = new Database(dbPath);
    
    // Check if table electors exists
    const tableCheck = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='electors'").get();
    if (!tableCheck) {
      console.log('No electors table found.');
      db.close();
      continue;
    }

    // 1. Search for CI 6020750
    const row = db.prepare("SELECT * FROM electors WHERE ci = ?").get('6020750');
    if (row) {
      console.log('SUCCESS! Found CI 6020750 in this DB:');
      console.log(JSON.stringify(row, null, 2));
    } else {
      console.log('CI 6020750 not found in this DB.');
    }

    // 2. Statistics
    const stats = db.prepare(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN orden IS NULL OR orden = 0 THEN 1 ELSE 0 END) as empty_orden,
        SUM(CASE WHEN mesa IS NULL OR mesa = 0 THEN 1 ELSE 0 END) as empty_mesa
      FROM electors
    `).get();
    console.log('General Stats:', stats);

    // 3. Search CDE
    const cdeStats = db.prepare(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN orden IS NULL OR orden = 0 THEN 1 ELSE 0 END) as empty_orden,
        SUM(CASE WHEN mesa IS NULL OR mesa = 0 THEN 1 ELSE 0 END) as empty_mesa
      FROM electors
      WHERE UPPER(distrito) LIKE '%ESTE%' OR UPPER(ciudad) LIKE '%ESTE%'
    `).get();
    console.log('Ciudad del Este Stats:', cdeStats);

    db.close();
  } catch (e) {
    console.error('Error opening DB:', e.message);
  }
}
