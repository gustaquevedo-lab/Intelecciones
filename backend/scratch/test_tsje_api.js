const axios = require('axios');

const TSJE_BASE = 'https://resultados.tsje.gov.py/publicacion';
const DIVULGACION_ENDPOINT = `${TSJE_BASE}/dinamics/divulgacion.ajax.php`;

async function testQuery(params) {
  console.log(`Querying with params: ${JSON.stringify(params)}`);
  try {
    const res = await axios.get(DIVULGACION_ENDPOINT, { 
      params,
      headers: { 'User-Agent': 'Intelecciones-TREP-Sync/1.0' }
    });
    console.log(`Status: ${res.status}`);
    const bodyType = typeof res.data;
    console.log(`Response Type: ${bodyType}`);
    if (bodyType === 'string') {
      console.log(`Response snippet (first 200 chars): ${res.data.substring(0, 200)}`);
      console.log(`Length: ${res.data.length}`);
    } else if (res.data) {
      console.log(`Response keys: ${Object.keys(res.data)}`);
      if (res.data.totales) {
        console.log(`Total votos: ${res.data.totales.totalVotos}`);
      }
    } else {
      console.log("Empty or null response data");
    }
  } catch (err) {
    console.error("Error:", err.message);
  }
  console.log("-----------------------------------------");
}

async function run() {
  // Test 1: Cargo 3 (National) - No filters
  await testQuery({ codeleccion: 45, candidatura: 3 });

  // Test 2: Cargo 3 (National) - Departamento 13
  await testQuery({ codeleccion: 45, candidatura: 3, departamento: 13 });

  // Test 3: Cargo 3 (National) - Departamento 13, Distrito 0
  await testQuery({ codeleccion: 45, candidatura: 3, departamento: 13, distrito: 0 });

  // Test 4: Cargo 3 (National) - Departamento 13, Distrito 1
  await testQuery({ codeleccion: 45, candidatura: 3, departamento: 13, distrito: 1 });
}

run();
