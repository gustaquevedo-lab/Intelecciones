const XLSX = require('xlsx');
const path = require('path');

const workbook = XLSX.readFile(path.join(__dirname, '../../MESARIOS 2026.xlsx'));

const sheetsToProcess = workbook.SheetNames.filter(name => !['Hoja1', 'EJEMPLO'].includes(name));

const apoderados = [];
const miembros = [];

for (const sheetName of sheetsToProcess) {
  const sheet = workbook.Sheets[sheetName];
  const data = XLSX.utils.sheet_to_json(sheet, { header: 1 });
  
  let currentLocal = sheetName.replace(' (2)', '').trim();
  
  // Try to find the exact local name from the 'LOCAL:' cell
  for (let r = 0; r < Math.min(20, data.length); r++) {
    const row = data[r];
    if (row && row[0] && typeof row[0] === 'string' && row[0].toUpperCase().includes('LOCAL')) {
      if (row[1]) {
        currentLocal = String(row[1]).trim();
      }
      break;
    }
  }

  let inApoderadosSection = false;
  let inMiembrosSection = false;

  for (let r = 0; r < data.length; r++) {
    const row = data[r];
    if (!row || !row.length) continue;

    const col0 = String(row[0] || '').toUpperCase().trim();
    
    // Check Apoderados
    if (col0.includes('APODERADO DE LOCAL')) {
      const name = String(row[1] || '').trim();
      const ci = String(row[2] || '').trim().replace(/\D/g, '');
      let phone = String(row[3] || '').trim();
      if (name && ci) {
        apoderados.push({ local: currentLocal, name, ci, phone });
      }
      continue;
    }

    // Check Miembros start
    if (col0.includes('MIEMBROS DE  MESAS') || col0.includes('MIEMBROS DE MESA') || col0 === 'N°') {
      inMiembrosSection = true;
      continue;
    }

    if (inMiembrosSection) {
      // Typically Col 0 is an integer, Col 1 is Name, Col 2 is CI, Col 4 is Mesa, Col 5 is Phone
      const idx = parseInt(col0);
      if (!isNaN(idx)) {
        const name = String(row[1] || '').trim();
        const ci = String(row[2] || '').trim().replace(/\D/g, '');
        const roleDesc = String(row[3] || '').toUpperCase();
        const mesa = parseInt(row[4]);
        const phone = String(row[5] || '').trim();

        if (name && ci && !isNaN(mesa)) {
          let tableRole = 'VOCAL';
          if (roleDesc.includes('PTE') || roleDesc.includes('PRESIDENT')) tableRole = 'PRESIDENTE';
          
          miembros.push({ local: currentLocal, name, ci, mesa, tableRole, phone });
        }
      }
    }
  }
}

console.log(`Total Apoderados encontrados: ${apoderados.length}`);
console.log(`Total Miembros encontrados: ${miembros.length}`);
console.log('\nEjemplo de Apoderados:');
console.log(apoderados.slice(0, 3));
console.log('\nEjemplo de Miembros:');
console.log(miembros.slice(0, 3));
