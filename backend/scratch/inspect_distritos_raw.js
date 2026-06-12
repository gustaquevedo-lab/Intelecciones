const axios = require('axios');
const TSJE_BASE = 'https://resultados.tsje.gov.py/publicacion';
const CATALOG_URL = (name) => `${TSJE_BASE}/statics/json/certificado/${name}.json`;

async function run() {
  const res = await axios.get(CATALOG_URL('distritos'), { transformResponse: r => r });
  const text = String(res.data ?? '');
  const cleaned = text.replace(/^\s*var\s+\w+\s*=\s*/, '').replace(/;\s*$/, '');
  const distritos = JSON.parse(cleaned);
  
  console.log("Top-level keys:", Object.keys(distritos));
  
  // Let's print the first key's contents
  const firstKey = Object.keys(distritos)[0];
  console.log(`First key (${firstKey}):`, Object.keys(distritos[firstKey]));
  
  // Let's check if "13" exists in any of them
  for (const k of Object.keys(distritos)) {
    if (distritos[k]["13"]) {
      console.log(`Found departamento 13 under key ${k}:`, distritos[k]["13"]);
    }
  }
}
run();
