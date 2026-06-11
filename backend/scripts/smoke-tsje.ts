// Smoke test del servicio de sync TSJE. Corre standalone:
//   npx ts-node-dev --transpile-only scripts/smoke-tsje.ts
import db from '../src/db';
import { syncDistrito, getResultados } from '../src/services/tsjeSync';

async function main() {
  console.log('[SMOKE] arrancando sync PLRA 2026 / Amambay (13) / PJC (0)...');
  const r = await syncDistrito(45, 13, 0, { rateLimitMs: 200 });
  console.log('[SMOKE] resultado sync:', JSON.stringify({
    syncLogId: r.syncLogId,
    cargosOk: r.cargosOk,
    cargosErr: r.cargosErr,
    details: r.details,
  }, null, 2));

  const data = getResultados(45, 13, 0);
  console.log('[SMOKE] cargos persistidos:', data.cargos.length);
  for (const c of data.cargos) {
    console.log(`  - ${c.cod_cargo} ${c.des_cargo}: mesas ${c.mesas_publicadas}/${c.total_mesas}, votos=${c.total_votos}, listas=${c.listas.length}, preferentes=${c.preferentes.length}`);
  }

  db.close();
}

main().catch(e => { console.error('[SMOKE] ERROR', e); process.exit(1); });
