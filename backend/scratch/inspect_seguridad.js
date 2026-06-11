const axios = require('axios');

const TSJE_BASE = 'https://resultados.tsje.gov.py/publicacion';
const CATALOG_URL = (name) => `${TSJE_BASE}/statics/json/certificado/${name}.json`;

async function run() {
  console.log("Fetching seguridad catalog...");
  try {
    const res = await axios.get(CATALOG_URL('seguridad'), { transformResponse: r => r });
    const text = String(res.data ?? '');
    const cleaned = text.replace(/^\s*var\s+\w+\s*=\s*/, '').replace(/;\s*$/, '');
    const seguridad = JSON.parse(cleaned);
    
    // Let's look at one district's first mesa (e.g. Amambay=13, Pedro Juan Caballero=0)
    const pjc = seguridad?.["45"]?.["13"]?.["0"];
    if (pjc) {
      console.log("PJC district found in catalog.");
      const zones = Object.keys(pjc);
      console.log("Zones in PJC:", zones);
      if (zones.length > 0) {
        const firstZone = pjc[zones[0]];
        const locales = Object.keys(firstZone);
        console.log("Locales in zone:", locales);
        if (locales.length > 0) {
          const firstLocal = firstZone[locales[0]];
          const mesas = Object.keys(firstLocal);
          console.log("Mesas in local:", mesas);
          if (mesas.length > 0) {
            const firstMesa = firstLocal[mesas[0]];
            console.log("Cargos available in first mesa of PJC:");
            console.log(firstMesa);
          }
        }
      }
    } else {
      console.log("PJC (13-0) not found in catalog.");
    }
  } catch (err) {
    console.error("Error:", err.message);
  }
}

run();
