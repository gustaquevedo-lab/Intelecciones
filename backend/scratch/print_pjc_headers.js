const XLSX = require('xlsx');
const path = require('path');

const filePath = path.join(__dirname, '..', '00 - PEDRO J. CABALLERO.xlsx');
console.log('Reading Excel file:', filePath);

try {
  const workbook = XLSX.readFile(filePath);
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const data = XLSX.utils.sheet_to_json(sheet);
  
  console.log('Total rows:', data.length);
  if (data.length > 0) {
    console.log('Headers:', Object.keys(data[0]));
    console.log('Sample Row 1:', JSON.stringify(data[0], null, 2));
    console.log('Sample Row 2:', JSON.stringify(data[1], null, 2));
  } else {
    console.log('No data rows found.');
  }
} catch (e) {
  console.error('Error:', e.message);
}
