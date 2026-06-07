// sync_lists_to_production.js
// Sincroniza las 127 listas del SQLite local a la base de datos de producción via API REST bulk
// Uso: node sync_lists_to_production.js [optional: target_url]
const Database = require('better-sqlite3');

const TARGET = process.argv[2] || 'https://intelecciones-production.up.railway.app/api';
const HEADERS = {
  'Content-Type': 'application/json',
  'x-user-role': 'SUPERUSUARIO',
};

async function main() {
  const db = new Database('intellecciones.db');
  
  // Get all local lists
  const localLists = db.prepare('SELECT * FROM lists ORDER BY id').all();
  console.log(`Local has ${localLists.length} lists`);

  // Check production first
  const prodRes = await fetch(`${TARGET}/diad/listas`, { headers: HEADERS });
  const prodLists = await prodRes.json();
  console.log(`Production currently has ${prodLists.length} lists`);
  
  // Bulk sync via new endpoint
  console.log(`\nSending bulk sync to ${TARGET}/diad/admin/sync-lists ...`);
  const syncRes = await fetch(`${TARGET}/diad/admin/sync-lists`, {
    method: 'POST',
    headers: HEADERS,
    body: JSON.stringify({ lists: localLists })
  });
  
  if (!syncRes.ok) {
    const err = await syncRes.json();
    console.error('Sync failed:', err);
    process.exit(1);
  }
  
  const result = await syncRes.json();
  console.log('Sync result:', result);
  
  // Verify
  const verifyRes = await fetch(`${TARGET}/diad/listas`, { headers: HEADERS });
  const verifyLists = await verifyRes.json();
  console.log(`\nProduction now has ${verifyLists.length} lists`);
  const byType = {};
  const byCiudad = {};
  verifyLists.forEach(l => {
    byType[l.type || 'NULL'] = (byType[l.type || 'NULL'] || 0) + 1;
    byCiudad[l.ciudad || 'EMPTY'] = (byCiudad[l.ciudad || 'EMPTY'] || 0) + 1;
  });
  console.log('By type:', byType);
  console.log('By ciudad:', byCiudad);
}

main().catch(console.error);
