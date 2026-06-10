const axios = require('axios');

const samples = [
  // Intendente
  'REC FAF99464A7005400000000D5E9A780789C636CBAC8CDAAFF8191A1F9EC814F9F1E303000003B3F0759E002080D99890733',
  // Directorio Departamental
  'REC FA9454AC81005400000000D5E9A780789C636CBAC8ECF7E50323F3518DC6499F1E30300000420E0760E002080D99890733',
  // Junta Municipal
  'REC FAAA26CE2B008800000000D5E9A780789C636CBAC813E011C0D6B7CC68150BE3AF60AF8C6B075C041A1D041CE51B1818190C19321A2C14B4040C26489C000039E60D4AE002080D99890733',
  // Presidente/Vice PLRA
  'REC FAC1AF24A6005C00000000D5E9A780789C636CBAC835EBC006C6AEC5624FD92CBAD731300832F800005E010766E002080D99890733',
  // Otros ejemplos (JLRA)
  'REC FAB680AA04005600000000FC04E1CC789C638CFBCFB4B6F103A31623CB92862D571E2830000044BB075BE002080D95764E34'
];

const api = process.env.API || 'http://localhost:5000';

(async () => {
  for (const s of samples) {
    try {
      const res = await axios.post(`${api}/api/veedor/parse-qr`, { qrData: s }, { timeout: 20000 });
      console.log('---');
      console.log('QR:', s.slice(0, 60) + '...');
      console.log('Result:', JSON.stringify(res.data, null, 2));
    } catch (err) {
      console.error('Error for sample:', s.slice(0, 60) + '...', err.message);
      if (err.response) console.error('Status:', err.response.status, 'Body:', err.response.data);
    }
  }
})();
