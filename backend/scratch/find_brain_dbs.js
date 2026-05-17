const fs = require('fs');
const path = require('path');

function searchAllBrains(dir) {
  let files;
  try {
    files = fs.readdirSync(dir);
  } catch (e) {
    return;
  }
  for (const f of files) {
    const fullPath = path.join(dir, f);
    try {
      const stat = fs.statSync(fullPath);
      if (stat.isDirectory()) {
        searchAllBrains(fullPath);
      } else if (f.endsWith('.db') || f.endsWith('.sqlite')) {
        if (stat.size > 10 * 1024) { // > 10KB
          console.log('FOUND DB IN BRAIN:', fullPath, 'Size:', (stat.size / 1024).toFixed(2), 'KB');
        }
      }
    } catch (e) {}
  }
}

console.log('Searching for sqlite databases in brain directory...');
searchAllBrains('C:\\Users\\Gustavo Quevedo\\.gemini\\antigravity\\brain');
