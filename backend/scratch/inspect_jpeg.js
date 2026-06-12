const axios = require('axios');
const TSJE_BASE = 'https://resultados.tsje.gov.py/publicacion';
const CERTIFICADO_ENDPOINT = `${TSJE_BASE}/dinamics/certificado.ajax.php`;

async function testMesa() {
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
    console.log("jpeg type:", typeof res.data.jpeg);
    if (res.data.jpeg) {
      console.log("jpeg snippet (first 100 chars):", res.data.jpeg.substring(0, 100));
      console.log("jpeg length:", res.data.jpeg.length);
    }
  } catch (err) {
    console.error(err.message);
  }
}
testMesa();
