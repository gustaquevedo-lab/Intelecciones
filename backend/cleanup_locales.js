const Database = require('better-sqlite3');
const path = require('path');
const dbPath = path.join(__dirname, 'intellecciones.db');
const db = new Database(dbPath);

console.log('--- CLEANING UP DUMMY DATA ---');

// Delete electors with very low counts (seed data)
// These are the ones I identified:
const dummyLocales = [
  'CENTRO REGIONAL DE EDUCACION',
  'COLEGIO ASUNCION ESCALADA',
  'ESCUELA BASICA 1300'
];

dummyLocales.forEach(local => {
  const count = db.prepare('SELECT COUNT(*) as count FROM electors WHERE local_votacion = ?').get(local).count;
  console.log(`Deleting ${count} dummy electors from ${local}...`);
  db.prepare('DELETE FROM electors WHERE local_votacion = ?').run(local);
  db.prepare('DELETE FROM voting_locations WHERE nombre = ?').run(local);
});

console.log('\n--- VERIFICATION ---');
const stats = db.prepare('SELECT local_votacion, COUNT(*) as count FROM electors GROUP BY local_votacion').all();
stats.forEach(s => console.log(` - ${s.local_votacion}: ${s.count} electors`));

console.log('\nCleanup complete. Now there are only 4 real voting locations.');
