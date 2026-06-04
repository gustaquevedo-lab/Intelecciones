const fs = require('fs');
const path = require('path');
const xlsx = require('xlsx');

function findExcels(dir, files = []) {
  if (dir.includes('node_modules') || dir.includes('.git') || dir.includes('.next')) return files;
  try {
    const list = fs.readdirSync(dir);
    for (const file of list) {
      const fullPath = path.join(dir, file);
      const stat = fs.statSync(fullPath);
      if (stat.isDirectory()) {
        findExcels(fullPath, files);
      } else if (file.endsWith('.xlsx')) {
        files.push(fullPath);
      }
    }
  } catch (e) {}
  return files;
}

const excels = findExcels('c:\\Users\\Gustavo Quevedo\\OneDrive\\Dev\\Intelecciones');
console.log(`Found ${excels.length} Excel files:`);

for (const file of excels) {
  console.log(`Searching Excel file: ${file}`);
  try {
    const workbook = xlsx.readFile(file);
    for (const sheetName of workbook.SheetNames) {
      const sheet = workbook.Sheets[sheetName];
      const data = xlsx.utils.sheet_to_json(sheet);
      for (let i = 0; i < data.length; i++) {
        const rowStr = JSON.stringify(data[i]);
        if (rowStr.includes('4388985')) {
          console.log(`  [FOUND] in sheet [${sheetName}] row [${i + 2}]:`, data[i]);
        }
      }
    }
  } catch (e) {
    console.error('Error reading Excel:', e.message);
  }
}
