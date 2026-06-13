const axios = require('axios');
async function run() {
  const TSJE_BASE = 'https://resultados.tsje.gov.py/publicacion';
  const CATALOG_URL = `${TSJE_BASE}/statics/json/certificado/locales.json`;
  const res = await axios.get(CATALOG_URL);
  const text = String(res.data ?? '');
  const cleaned = text.replace(/^\s*var\s+\w+\s*=\s*/, '').replace(/;\s*$/, '');
  const locales = JSON.parse(cleaned);
  
  console.log('Eleccion 44 department keys:', Object.keys(locales['44'] || {}));
  console.log('Amambay (13) in 44 districts:', Object.keys(locales['44']?.[13] || {}));
}
run().catch(console.error);
