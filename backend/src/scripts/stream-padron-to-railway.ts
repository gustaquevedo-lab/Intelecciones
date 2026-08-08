import Database from 'better-sqlite3';
import path from 'path';

const localDbPath = path.join(process.cwd(), 'intellecciones.db');
const localDb = new Database(localDbPath);

console.log('=== ACTUALIZACIÓN EN VIVO DE MESAS/ORDEN (OPCIÓN A - CERO DOWNTIME) ===');

async function syncMesaOrdenInChunks() {
  const REMOTE_URL = 'https://intelecciones-production.up.railway.app';
  
  // Obtenemos los electores actualizados alfabéticamente localmente
  console.log('Cargando datos recalibrados desde la base de datos local...');
  const electors = localDb.prepare('SELECT ci, mesa, orden FROM electors WHERE mesa IS NOT NULL').all() as { ci: string; mesa: number; orden: number }[];
  
  console.log(`Total electores a sincronizar: ${electors.length}`);

  const chunkSize = 2000;
  let processed = 0;

  for (let i = 0; i < electors.length; i += chunkSize) {
    const chunk = electors.slice(i, i + chunkSize);
    
    let retries = 3;
    while (retries > 0) {
      try {
        const response = await fetch(`${REMOTE_URL}/api/bulk-update-mesas`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-user-role': 'SUPERUSUARIO'
          },
          body: JSON.stringify({ updates: chunk })
        });

        if (response.ok) {
          processed += chunk.length;
          const percent = ((processed / electors.length) * 100).toFixed(1);
          console.log(`[SYNC VIVO] Progreso: ${processed}/${electors.length} (${percent}%)`);
          break;
        } else {
          const text = await response.text();
          console.warn(`[RETRY] Batch de la fila ${i} falló (${response.status}): ${text}. Reintentando...`);
          retries--;
          await new Promise(r => setTimeout(r, 2000));
        }
      } catch (err: any) {
        console.warn(`[RETRY] Error en red batch ${i}: ${err.message}. Reintentando...`);
        retries--;
        await new Promise(r => setTimeout(r, 2000));
      }
    }

    // Pequeño descanso entre batches para no saturar el servidor HTTP
    await new Promise(r => setTimeout(r, 300));
  }

  console.log('\n✅ ACTUALIZACIÓN DE MESAS EN VIVO COMPLETADA EXITOSAMENTE.');
}

syncMesaOrdenInChunks();
