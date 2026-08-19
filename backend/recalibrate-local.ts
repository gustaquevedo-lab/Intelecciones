import Database from 'better-sqlite3';
import path from 'path';

const dbPath = path.join(process.cwd(), 'intellecciones.db');
console.log('--- RECALIBRACIÓN DE MESAS Y ORDEN LOCAL ---');
console.log('Base de datos:', dbPath);

const db = new Database(dbPath);
db.pragma('journal_mode = WAL');
db.pragma('synchronous = NORMAL');

console.log('Obteniendo locales de votación...');
const locals = db.prepare("SELECT DISTINCT local_votacion FROM electors WHERE local_votacion IS NOT NULL AND local_votacion != ''").all() as { local_votacion: string }[];
console.log(`Total locales encontrados: ${locals.length}`);

const updateStmt = db.prepare('UPDATE electors SET mesa = ?, orden = ? WHERE ci = ?');

let totalElectorsProcessed = 0;
const start = Date.now();

db.transaction(() => {
  for (let i = 0; i < locals.length; i++) {
    const loc = locals[i].local_votacion;
    const electores = db.prepare(
      'SELECT ci FROM electors WHERE local_votacion = ? ORDER BY CAST(mesa AS INTEGER) ASC, CAST(orden AS INTEGER) ASC, ci ASC'
    ).all(loc) as { ci: string }[];

    for (let j = 0; j < electores.length; j++) {
      const newMesa = Math.floor(j / 350) + 1;
      const newOrden = (j % 350) + 1;
      updateStmt.run(newMesa, newOrden, electores[j].ci);
    }

    totalElectorsProcessed += electores.length;
    if ((i + 1) % 50 === 0 || i === locals.length - 1) {
      console.log(`[${i + 1}/${locals.length}] Locales procesados. Electores actualizados: ${totalElectorsProcessed}`);
    }
  }
})();

console.log('Haciendo checkpoint WAL para asegurar persitencia completa...');
db.pragma('wal_checkpoint(TRUNCATE)');

const duration = ((Date.now() - start) / 1000).toFixed(2);
console.log(`\n✅ RECALIBRACIÓN COMPLETADA EXITOSAMENTE en ${duration}s.`);
console.log(`Total de electores recalibrados a 350 electores/mesa: ${totalElectorsProcessed}`);

// Verificación CI 3657834 (Pedro J. Caballero - Argaña)
const sample = db.prepare('SELECT ci, nombre, apellido, local_votacion, mesa, orden FROM electors WHERE ci = ?').get('3657834');
console.log('\n--- VERIFICACIÓN GUSTAVO QUEVEDO (CI 3657834) ---');
console.log(JSON.stringify(sample, null, 2));
