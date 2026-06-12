const axios = require('axios');
const fs = require('fs');
const path = require('path');

const TSJE_BASE = 'https://resultados.tsje.gov.py/publicacion';
const CERTIFICADO_ENDPOINT = `${TSJE_BASE}/dinamics/certificado.ajax.php`;

async function run() {
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
    
    if (res.data.jpeg) {
      const buf = Buffer.from(res.data.jpeg, 'base64');
      const outputPath = path.join(__dirname, 'mesa1_acta.jpg');
      fs.writeFileSync(outputPath, buf);
      console.log("Saved acta image to:", outputPath);
    } else {
      console.log("No jpeg found in response");
    }
  } catch (err) {
    console.error("Error:", err.message);
  }
}
run();
