const XLSX = require('xlsx');
const fs = require('fs');

const files = [
  '06 - CERRO CORA.xlsx',
  'CONCEPCION APODERADOS Y MIEMBROS DE MESAS - APP.xlsx',
  'MESARIOS 2026.xlsx'
];

files.forEach(f => {
  if (fs.existsSync('../' + f)) {
    try {
      const wb = XLSX.readFile('../' + f);
      console.log(`File: ${f}`);
      console.log('Sheets:', wb.SheetNames);
      wb.SheetNames.forEach(sheetName => {
        const sheet = wb.Sheets[sheetName];
        const data = XLSX.utils.sheet_to_json(sheet, { header: 1 });
        console.log(`  Sheet "${sheetName}" rows: ${data.length}`);
        if (data.length > 0) {
          console.log('  Header / First rows:', data.slice(0, 3));
        }
      });
      console.log('----------------------------');
    } catch (e) {
      console.error(`Error reading ${f}:`, e.message);
    }
  } else {
    console.log(`File not found: ${f}`);
  }
});
