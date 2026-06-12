const axios = require('axios');
const TSJE_BASE = 'https://resultados.tsje.gov.py/publicacion';
const CATALOG_URL = (name) => `${TSJE_BASE}/statics/json/certificado/${name}.json`;

async function testCatalog(name) {
  try {
    const res = await axios.get(CATALOG_URL(name));
    console.log(`Catalog ${name} status: ${res.status}`);
    const data = res.data;
    if (typeof data === 'string') {
      console.log(`Snippet: ${data.substring(0, 200)}`);
    } else {
      console.log(`Keys: ${Object.keys(data).slice(0, 10)}`);
    }
  } catch (e) {
    console.log(`Catalog ${name} failed: ${e.message}`);
  }
}

async function run() {
  await testCatalog('departamento');
  await testCatalog('distrito');
  await testCatalog('distritos');
  await testCatalog('zona');
}
run();
