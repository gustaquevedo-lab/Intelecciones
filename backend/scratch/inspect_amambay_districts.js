const axios = require('axios');
const TSJE_BASE = 'https://resultados.tsje.gov.py/publicacion';
const CATALOG_URL = (name) => `${TSJE_BASE}/statics/json/certificado/${name}.json`;

async function run() {
  const res = await axios.get(CATALOG_URL('seguridad'), { transformResponse: r => r });
  const text = String(res.data ?? '');
  const cleaned = text.replace(/^\s*var\s+\w+\s*=\s*/, '').replace(/;\s*$/, '');
  const seguridad = JSON.parse(cleaned);
  const amambay = seguridad?.["45"]?.["13"];
  if (amambay) {
    console.log("Distritos in Amambay:", Object.keys(amambay));
    for (const dist of Object.keys(amambay)) {
      let mesaCount = 0;
      for (const zone of Object.keys(amambay[dist])) {
        for (const local of Object.keys(amambay[dist][zone])) {
          mesaCount += Object.keys(amambay[dist][zone][local]).length;
        }
      }
      console.log(`District ${dist}: ${mesaCount} mesas`);
    }
  }
}
run();
