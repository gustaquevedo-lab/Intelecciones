import Database from 'better-sqlite3';
import path from 'path';

const dbPath = path.join(process.cwd(), 'intellecciones.db');
console.log('--- RECALIBRACIÓN POR ORDEN ALFABÉTICO (APELLIDO, NOMBRE) ---');

const db = new Database(dbPath);
db.pragma('journal_mode = WAL');
db.pragma('synchronous = NORMAL');

console.log('Obteniendo locales de votación...');
const locals = db.prepare("SELECT DISTINCT local_votacion FROM electors WHERE local_votacion IS NOT NULL AND local_votacion != ''").all() as { local_votacion: string }[];
console.log(`Total locales: ${locals.length}`);

const updateStmt = db.prepare('UPDATE electors SET mesa = ?, orden = ? WHERE ci = ?');

let totalElectorsProcessed = 0;
const start = Date.now();

db.transaction(() => {
  for (let i = 0; i < locals.length; i++) {
    const loc = locals[i].local_votacion;
    // ORDEN ALFABÉTICO REAL POR APELLIDO Y NOMBRE DENTRO DE CADA LOCAL
    const electores = db.prepare(
      'SELECT ci FROM electors WHERE local_votacion = ? ORDER BY apellido ASC, nombre ASC, ci ASC'
    ).all(loc) as { ci: string }[];

    for (let j = 0; j < electores.length; j++) {
      const newMesa = Math.floor(j / 350) + 1;
      const newOrden = (j % 350) + 1;
      updateStmt.run(newMesa, newOrden, electores[j].ci);
    }

    totalElectorsProcessed += electores.length;
  }
})();

db.pragma('wal_checkpoint(TRUNCATE)');

const duration = ((Date.now() - start) / 1000).toFixed(2);
console.log(`\n✅ RECALIBRACIÓN ALFABÉTICA COMPLETADA en ${duration}s.`);
console.log(`Total electores procesados: ${totalElectorsProcessed}`);

// Verificación CI 3657834 (Pedro J. Caballero - Argaña)
const sample = db.prepare('SELECT ci, nombre, apellido, local_votacion, mesa, orden FROM electors WHERE ci = ?').get('3657834');
console.log('\n--- VERIFICACIÓN REAL GUSTAVO QUEVEDO (CI 3657834) ---');
console.log(JSON.stringify(sample, null, 2));

// Verificación distribución en Argaña
const arganaStats = db.prepare("SELECT MAX(mesa) as max_mesa, COUNT(*) as total FROM electors WHERE local_votacion = 'LIC. CNEL. JOSE MARIA ARGAÑA'").get();
console.log('\n--- ESTADÍSTICAS ARGAÑA ---');
console.log(JSON.stringify(arganaStats, null, 2));
