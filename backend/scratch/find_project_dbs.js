const fs = require('fs');
const path = require('path');

function findInProject(dir) {
  let files;
  try {
    files = fs.readdirSync(dir);
  } catch (e) {
    return;
  }
  for (const f of files) {
    if (f === 'node_modules' || f === '.git' || f === 'dist') continue;
    const fullPath = path.join(dir, f);
    try {
      const stat = fs.statSync(fullPath);
      if (stat.isDirectory()) {
        findInProject(fullPath);
      } else if (f.endsWith('.db') || f.endsWith('.sqlite') || f === 'intellecciones.db') {
        console.log('FOUND SQLITE FILE:', fullPath, 'Size:', (stat.size / 1024).toFixed(2), 'KB');
      }
    } catch (e) {}
  }
}

console.log('Searching for databases inside the project...');
findInProject('c:\\Users\\Gustavo Quevedo\\OneDrive\\Dev\\Intelecciones');
