const Database = require('better-sqlite3');
const db = new Database('/Users/gustaquevedo/Library/CloudStorage/OneDrive-Personal/Dev/Intelecciones/backend/intellecciones.db');

// Check Argaña
const argana = db.prepare("SELECT COUNT(DISTINCT mesa) as mesas, COUNT(*) as electores FROM electors WHERE local_votacion LIKE '%ARGAÑA%' AND distrito = 'PEDRO J. CABALLERO'").get();
console.log('Argaña - Mesas únicas en DB:', argana.mesas, '| Electores:', argana.electores);
console.log('Oficial: 43 mesas, 15,147 electores');

// Check all locals in Pedro J. Caballero
const locals = db.prepare("SELECT local_votacion, COUNT(DISTINCT mesa) as mesas_unicas, COUNT(*) as electores FROM electors WHERE distrito = 'PEDRO J. CABALLERO' GROUP BY local_votacion ORDER BY electores DESC").all();
console.log('\nLocales en PEDRO J. CABALLERO:');
locals.forEach(l => {
  console.log('  [' + l.mesas_unicas + ' mesas, ' + l.electores + ' elect.] ' + l.local_votacion);
});

const total = db.prepare("SELECT COUNT(DISTINCT mesa) as mesas, COUNT(*) as electores FROM electors WHERE distrito = 'PEDRO J. CABALLERO'").get();
console.log('\nTOTAL PJC: ' + total.mesas + ' mesas únicas, ' + total.electores + ' electores');
console.log('Oficial: 226 mesas, 79,200 electores');
