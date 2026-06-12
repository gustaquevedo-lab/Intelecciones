const axios = require('axios');
axios.get('https://resultados.tsje.gov.py/publicacion/statics/json/certificado/distritos.json').then(r => {
  const cleaned = r.data.replace(/^\s*var\s+\w+\s*=\s*/, '').replace(/;\s*$/, '');
  const json = JSON.parse(cleaned);
  console.log(JSON.stringify(json['45'], null, 2));
});
