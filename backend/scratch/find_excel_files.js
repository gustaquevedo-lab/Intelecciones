const fs = require('fs');
const path = require('path');

function searchExcel(dir) {
  let files;
  try {
    files = fs.readdirSync(dir);
  } catch (e) {
    return;
  }
  for (const f of files) {
    if (f === 'node_modules' || f === '.git' || f === 'dist' || f === '.gemini') continue;
    const fullPath = path.join(dir, f);
    try {
      const stat = fs.statSync(fullPath);
      if (stat.isDirectory()) {
        searchExcel(fullPath);
      } else if (f.endsWith('.xlsx')) {
        console.log('FOUND EXCEL FILE:', fullPath, 'Size:', (stat.size / (1024 * 1024)).toFixed(2), 'MB');
      }
    } catch (e) {}
  }
}

console.log('Searching for .xlsx files in workspace...');
searchExcel('c:\\Users\\Gustavo Quevedo\\OneDrive\\Dev\\Intelecciones');
