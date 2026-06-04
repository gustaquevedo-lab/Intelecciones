const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

function findDbs(dir, files = []) {
  if (dir.includes('node_modules') || dir.includes('.git') || dir.includes('.next')) return files;
  try {
    const list = fs.readdirSync(dir);
    for (const file of list) {
      const fullPath = path.join(dir, file);
      const stat = fs.statSync(fullPath);
      if (stat.isDirectory()) {
        findDbs(fullPath, files);
      } else if (file.endsWith('.db')) {
        files.push({ path: fullPath, size: stat.size });
      }
    }
  } catch (e) {}
  return files;
}

const allDbs = findDbs('C:\\Users\\Gustavo Quevedo\\OneDrive\\Dev');
console.log(`Found ${allDbs.length} DB files:`);
for (const dbInfo of allDbs) {
  console.log(`${dbInfo.path} (${dbInfo.size} bytes)`);
}
