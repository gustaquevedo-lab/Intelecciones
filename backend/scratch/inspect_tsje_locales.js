const axios = require('axios');
const TSJE_BASE = 'https://resultados.tsje.gov.py/publicacion';
const CATALOG_URL = (name) => `${TSJE_BASE}/statics/json/certificado/${name}.json`;

async function tryCatalog(name) {
  try {
    const res = await axios.get(CATALOG_URL(name));
    console.log(`\n--- CATALOG: ${name} (status: ${res.status}) ---`);
    const data = res.data;
    if (typeof data === 'object') {
      console.log('Keys:', Object.keys(data).slice(0, 5));
      console.log('Sample:', JSON.stringify(data).substring(0, 300));
    } else {
      console.log('Text sample:', String(data).substring(0, 300));
    }
    return true;
  } catch (e) {
    console.log(`Catalog ${name} not found: ${e.message}`);
    return false;
  }
}

async function run() {
  await tryCatalog('locales');
  await tryCatalog('local');
  await tryCatalog('geografia');
  await tryCatalog('estructura');
}
run();
