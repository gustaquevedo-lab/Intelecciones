const axios = require('axios');
async function run() {
  const TSJE_BASE = 'https://resultados.tsje.gov.py/publicacion';
  const CATALOG_URL = `${TSJE_BASE}/statics/json/certificado/seguridad.json`;
  console.log('Fetching catalog...');
  const res = await axios.get(CATALOG_URL);
  const text = String(res.data ?? '');
  const cleaned = text.replace(/^\s*var\s+\w+\s*=\s*/, '').replace(/;\s*$/, '');
  const seguridad = JSON.parse(cleaned);
  
  // Amambay (dpto 13), PJC (dist 0)
  const amambayPjc = seguridad?.['45']?.[13]?.[0];
  if (!amambayPjc) {
    console.log('No data found for Amambay/PJC');
    return;
  }
  
  console.log('Zones in Amambay/PJC:', Object.keys(amambayPjc));
  for (const zona of Object.keys(amambayPjc)) {
    console.log(`Locales in Zone ${zona}:`, Object.keys(amambayPjc[zona]));
    for (const local of Object.keys(amambayPjc[zona])) {
      const mesas = Object.keys(amambayPjc[zona][local]);
      console.log(`  Local ${local} has ${mesas.length} mesas. Mesas range: ${mesas[0]} to ${mesas[mesas.length - 1]}`);
    }
  }
}
run().catch(console.error);
