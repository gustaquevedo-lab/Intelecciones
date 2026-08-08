const Database = require('better-sqlite3');
const path = require('path');

const TARGET_URL = process.env.RAILWAY_URL || 'https://intelecciones-production.up.railway.app/api/admin/system/import-batch';
const DB_PATH = path.join(__dirname, 'intellecciones.db');

async function streamPadron() {
  const localDbFile = require('fs').existsSync(DB_PATH) ? DB_PATH : path.join(process.cwd(), 'intellecciones.db');
  console.log('--- INICIANDO STREAMING DE PADRÓN CON NODE FETCH ---');
  console.log('Base de Datos Local:', localDbFile);
  console.log('Destino:', TARGET_URL);

  const db = new Database(localDbFile);
  const totalCount = (db.prepare('SELECT COUNT(*) as c FROM electors').get()).c;
  console.log(`Total de Electores Locales a Sincronizar: ${totalCount}`);

  const BATCH_SIZE = 5000;
  let offset = parseInt(process.env.START_OFFSET || '0', 10);
  let batchIndex = Math.floor(offset / BATCH_SIZE) + 1;

  while (offset < totalCount) {
    const rows = db.prepare(`SELECT * FROM electors LIMIT ? OFFSET ?`).all(BATCH_SIZE, offset);
    if (rows.length === 0) break;

    let success = false;
    for (let retry = 1; retry <= 10; retry++) {
      try {
        const res = await fetch(TARGET_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-user-role': 'SUPERUSUARIO'
          },
          body: JSON.stringify({ rows, reset: offset === 0 && retry === 1 })
        });
        if (res.ok) {
          success = true;
          break;
        } else {
          const errText = await res.text();
          console.warn(`⚠️ Error HTTP ${res.status} (intento ${retry}/10) en lote ${batchIndex}:`, errText);
          await new Promise(r => setTimeout(r, 5000));
        }
      } catch (err) {
        console.warn(`⚠️ Reintento ${retry}/10 para lote ${batchIndex}:`, err.message);
        await new Promise(r => setTimeout(r, 5000));
      }
    }

    if (!success) {
      console.error(`❌ Fallo crítico al sincronizar lote ${batchIndex}. Abortando.`);
      process.exit(1);
    }

    offset += rows.length;
    console.log(`[PROGRESS] Lote ${batchIndex} sincronizado: ${offset} de ${totalCount} electores (Mesa TALON + Orden 1..N).`);
    batchIndex++;
  }

  console.log('===============================================================');
  console.log('✅ ÉXITO: TODO EL PADRÓN MIGRADO FUE SINCRONIZADO A PRODUCCIÓN.');
  console.log('===============================================================');
}

streamPadron().catch(console.error);
