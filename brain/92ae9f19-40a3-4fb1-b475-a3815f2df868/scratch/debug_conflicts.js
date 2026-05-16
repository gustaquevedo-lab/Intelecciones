const axios = require('axios');
const API_URL = 'http://localhost:5000/api';

async function test() {
  try {
    const res = await axios.get(`${API_URL}/admin/conflicts`, {
      headers: { 'x-user-role': 'SUPERUSUARIO', 'x-user-id': '1' }
    });
    console.log('Conflicts data:', JSON.stringify(res.data, null, 2));
  } catch (err) {
    console.error('Error:', err.message);
  }
}
test();
