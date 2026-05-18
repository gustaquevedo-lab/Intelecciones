const axios = require('axios');

async function test() {
  try {
    const res = await axios.get('http://localhost:5000/api/my-team/reports', {
      headers: {
        'x-user-id': '6', // Gustavo Quevedo
        'x-user-role': 'SUPERUSUARIO',
        'x-district': 'CONCEPCION'
      }
    });
    console.log("SUCCESS:", res.status);
    console.log("keys:", Object.keys(res.data));
    console.log("district:", res.data.district);
    console.log("padrinos:", res.data.padrinos.length);
  } catch (err) {
    console.log("ERROR:", err.response ? err.response.status : err.message);
    if (err.response) {
      console.log("DATA:", err.response.data);
    }
  }
}

test();
