const Database = require('better-sqlite3');
const db = new Database('./intellecciones.db');

console.log('=== RECALIBRACION DE MESA/ORDEN POR LOCAL ===');
db.pragma('journal_mode = WAL');
db.pragma('cache_size = -64000');

// Get all unique voting locations that have electors with mesa > 200
const locals = db.prepare(`
  SELECT DISTINCT local_votacion 
  FROM electors 
  WHERE mesa > 200 
  ORDER BY local_votacion
`).all();

console.log(`Procesando ${locals.length} locales con mesas incorrectas...`);

let totalUpdated = 0;

for (let i = 0; i < locals.length; i++) {
  const loc = locals[i].local_votacion;
  
  // Get all electors in this local with mesa > 200, ordered by original mesa/orden
  const electors = db.prepare(`
    SELECT ci, mesa, orden 
    FROM electors 
    WHERE local_votacion = ? AND mesa > 200 
    ORDER BY CAST(mesa AS INTEGER), CAST(orden AS INTEGER), ci
  `).all(loc);
  
  if (electors.length === 0) continue;
  
  // Assign new mesa/orden sequentially
  const updateStmt = db.prepare(`UPDATE electors SET mesa = ?, orden = ? WHERE ci = ?`);
  
  db.transaction(() => {
    for (let j = 0; j < electors.length; j++) {
      const newMesa = Math.floor(j / 300) + 1;
      const newOrden = (j % 300) + 1;
      updateStmt.run(newMesa, newOrden, electors[j].ci);
    }
  })();
  
  totalUpdated += electors.length;
  
  if (i % 10 === 0 || i === locals.length - 1) {
    console.log(`[${i+1}/${locals.length}] ${loc.substring(0,40)} - ${electors.length} electores - Total: ${totalUpdated}`);
  }
}

// Verify result for CI 3657834
const sample = db.prepare('SELECT ci, nombre, mesa, orden, local_votacion FROM electors WHERE ci = ?').get('3657834');
console.log('\nVerificacion CI 3657834:', JSON.stringify(sample));

// Check no more mesa > 200 exist
const remaining = db.prepare('SELECT COUNT(*) as c FROM electors WHERE mesa > 200').get();
console.log('Registros con mesa > 200 restantes:', remaining.c);

console.log('\n=== RECALIBRACION COMPLETADA ===');
console.log('Total electores actualizados:', totalUpdated);
