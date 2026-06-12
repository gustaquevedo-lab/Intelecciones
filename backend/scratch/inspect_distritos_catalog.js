const axios = require('axios');
const TSJE_BASE = 'https://resultados.tsje.gov.py/publicacion';
const CATALOG_URL = (name) => `${TSJE_BASE}/statics/json/certificado/${name}.json`;

async function run() {
  const res = await axios.get(CATALOG_URL('distritos'), { transformResponse: r => r });
  const text = String(res.data ?? '');
  const cleaned = text.replace(/^\s*var\s+\w+\s*=\s*/, '').replace(/;\s*$/, '');
  const distritos = JSON.parse(cleaned);
  
  console.log("=== Elecciones available in distritos ===");
  console.log(Object.keys(distritos));
  
  // Let's inspect eleccion 45, departamento 13
  const amambay45 = distritos["45"]?.["13"];
  console.log("Amambay (eleccion 45):", amambay45);
  
  const amambay44 = distritos["44"]?.["13"];
  console.log("Amambay (eleccion 44):", amambay44);
}
run();
