const Database = require('better-sqlite3');
const db = new Database('backend/intellecciones.db');

try {
  const electorsCount = db.prepare('SELECT COUNT(*) as count FROM electors').get();
  const mesasCount = db.prepare("SELECT COUNT(DISTINCT local_votacion || '-' || mesa) as count FROM electors").get();
  const locales = db.prepare('SELECT local_votacion, COUNT(DISTINCT mesa) as mesas FROM electors GROUP BY local_votacion').all();
  
  console.log('Electors:', electorsCount.count);
  console.log('Total Mesas:', mesasCount.count);
  console.log('Locales:', JSON.stringify(locales, null, 2));
} catch (err) {
  console.error(err);
}
