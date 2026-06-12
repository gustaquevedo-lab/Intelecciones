const axios = require('axios');
const TSJE_BASE = 'https://resultados.tsje.gov.py/publicacion';
const CERTIFICADO_ENDPOINT = `${TSJE_BASE}/dinamics/certificado.ajax.php`;

async function testMesa() {
  // Let's get one mesa from Amambay PJC (13, 0)
  // From our previous inspect_seguridad we know:
  // eleccion: 45, departamento: 13, distrito: 0, zona: 295, local: 2, mesa: 1, codigo: 14297264 (which was for cargo 3)
  // Let's find the code for cargo 4 (Directorio Nacional) from the first mesa of PJC:
  // In inspect_seguridad.js output, the codes were:
  // { '1': 88940542, '2': 20498727, '3': 14297264, '4': 53357707, '5': 22771814, '6': 80033589, '7': 94018444 }
  // So code for cargo 4 is 53357707, code for cargo 5 is 22771814.
  
  try {
    const res = await axios.get(CERTIFICADO_ENDPOINT, {
      params: {
        eleccion: 45,
        candidatura: 4,
        departamento: 13,
        distrito: 0,
        zona: '295',
        local: '2',
        mesa: '1',
        codigo: 53357707
      }
    });
    console.log("Status:", res.status);
    console.log("Data keys:", Object.keys(res.data));
    console.log("Cabecera:", res.data.cabecera);
    console.log("First detail row:", res.data.detalle?.[0]);
    console.log("Details count:", res.data.detalle?.length);
    console.log("Full first detail row:", JSON.stringify(res.data.detalle?.[0], null, 2));
  } catch (err) {
    console.error(err.message);
  }
}
testMesa();
