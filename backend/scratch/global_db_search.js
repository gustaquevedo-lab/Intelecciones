const fs = require('fs');
const path = require('path');

const searchPaths = [
  'C:\\Dev',
  'c:\\Users\\Gustavo Quevedo\\OneDrive\\Dev',
  'c:\\Users\\Gustavo Quevedo\\Desktop',
  'c:\\Users\\Gustavo Quevedo\\Documents'
];

function searchDB(dir, depth = 0) {
  if (depth > 5) return;
  let files;
  try {
    files = fs.readdirSync(dir);
  } catch (e) {
    return;
  }
  for (const f of files) {
    if (f === 'node_modules' || f === '.git' || f === 'dist' || f === 'brain' || f === '.gemini') continue;
    const fullPath = path.join(dir, f);
    try {
      const stat = fs.statSync(fullPath);
      if (stat.isDirectory()) {
        searchDB(fullPath, depth + 1);
      } else if (f.endsWith('.db') || f.endsWith('.sqlite') || f === 'intellecciones.db') {
        const buffer = Buffer.alloc(16);
        try {
          const fd = fs.openSync(fullPath, 'r');
          fs.readSync(fd, buffer, 0, 16, 0);
          fs.closeSync(fd);
          if (buffer.toString().startsWith('SQLite format 3')) {
            console.log('SQLITE:', fullPath, 'Size:', (stat.size / 1024).toFixed(2), 'KB');
          } else {
            console.log('NON-SQLITE FILE WITH DB EXT:', fullPath, 'Size:', (stat.size / 1024).toFixed(2), 'KB');
          }
        } catch (err) {
          console.log('FILE ACCESS ERROR:', fullPath);
        }
      }
    } catch (e) {}
  }
}

console.log('Starting global search for database files...');
for (const p of searchPaths) {
  if (fs.existsSync(p)) {
    console.log(`\nSearching path: ${p}`);
    searchDB(p);
  }
}
