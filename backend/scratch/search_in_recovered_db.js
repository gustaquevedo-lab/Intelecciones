const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, '..', 'recovered_intellecciones.db');
console.log('Opening recovered DB at:', dbPath);

try {
  const db = new Database(dbPath);
  
  // 1. Search for CI 6020750
  console.log('\nSearching for elector CI 6020750...');
  const row = db.prepare("SELECT * FROM electors WHERE ci = ?").get('6020750');
  if (row) {
    console.log('FOUND:', JSON.stringify(row, null, 2));
  } else {
    console.log('NOT FOUND');
  }

  // 2. Count total electors by district
  console.log('\nElectors by district/city:');
  const districts = db.prepare(`
    SELECT distrito, ciudad, COUNT(*) as count 
    FROM electors 
    GROUP BY distrito, ciudad
  `).all();
  console.table(districts);

  // 3. Check some sample electors in Ciudad del Este if they exist
  console.log('\nSample CDE electors:');
  const cde = db.prepare(`
    SELECT ci, nombre, apellido, distrito, ciudad, local_votacion, mesa, orden 
    FROM electors 
    WHERE UPPER(distrito) LIKE '%ESTE%' OR UPPER(ciudad) LIKE '%ESTE%'
    LIMIT 10
  `).all();
  console.table(cde);

  db.close();
} catch (e) {
  console.error('Error:', e);
}
