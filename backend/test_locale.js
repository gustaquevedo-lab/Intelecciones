const axios = require('axios');

async function test() {
  try {
    const res = await axios.put('http://localhost:5000/api/locales/101', {
      nombre: 'Test',
      lat: -22.5,
      lng: -55.7,
      ciudad: 'PEDRO JUAN CABALLERO'
    });
    console.log(res.data);
  } catch (err) {
    console.error(err.response ? err.response.data : err.message);
  }
}

test();
