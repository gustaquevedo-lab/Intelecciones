const xlsx = require('xlsx');
const path = require('path');
const fs = require('fs');

const targets = [7424600, 7170676, '7424600', '7170676'];
const files = [
  path.join(__dirname, '00 - PEDRO J. CABALLERO.xlsx'),
  path.join(__dirname, '..', '06 - CERRO CORA.xlsx')
];

for (const file of files) {
  if (!fs.existsSync(file)) {
    console.log(`File not found: ${file}`);
    continue;
  }
  console.log(`\nSearching file: ${file}`);
  try {
    const workbook = xlsx.readFile(file);
    for (const sheetName of workbook.SheetNames) {
      const sheet = workbook.Sheets[sheetName];
      const data = xlsx.utils.sheet_to_json(sheet);
      console.log(`  Sheet: ${sheetName}, rows: ${data.length}`);
      for (let i = 0; i < data.length; i++) {
        const row = data[i];
        for (const key of Object.keys(row)) {
          const val = row[key];
          if (targets.includes(val) || targets.includes(String(val).trim())) {
            console.log(`    FOUND at row ${i + 2}:`, row);
          }
        }
      }
    }
  } catch (e) {
    console.error(`Error reading ${file}:`, e.message);
  }
}
