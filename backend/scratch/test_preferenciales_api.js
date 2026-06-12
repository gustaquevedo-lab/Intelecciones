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
    if (typeof res.data === 'object' && res.data !== null) {
      console.log(`Keys: ${Object.keys(res.data)}`);
      if (res.data.candidatos && res.data.candidatos.length > 0) {
        const firstCand = res.data.candidatos[0];
        console.log(`First candidate: ${firstCand.nomCandidato} (${firstCand.desPartido}) - Votos: ${firstCand.votos}`);
        if (firstCand.candidatosPref) {
          console.log(`  Has candidatosPref! Count: ${firstCand.candidatosPref.length}`);
          console.log(`  First pref: ${firstCand.candidatosPref[0].nomCandidato} - Votos: ${firstCand.candidatosPref[0].votos}`);
        } else {
          console.log(`  No candidatosPref.`);
        }
      }
    } else {
      console.log(`Length: ${String(res.data).length}`);
    }
  } catch (err) {
    console.error("Error:", err.message);
  }
  console.log("-----------------------------------------");
}

async function run() {
  // Cargo 4 (Directorio Nacional) - Nacional
  await testQuery({ codeleccion: 45, candidatura: 4 });
  // Cargo 4 (Directorio Nacional) - Depto 13
  await testQuery({ codeleccion: 45, candidatura: 4, departamento: 13 });
  // Cargo 5 (Directorio Departamental) - Depto 13
  await testQuery({ codeleccion: 45, candidatura: 5, departamento: 13 });
  // Cargo 5 (Directorio Departamental) - Depto 13, Distrito 0
  await testQuery({ codeleccion: 45, candidatura: 5, departamento: 13, distrito: 0 });
}
run();
