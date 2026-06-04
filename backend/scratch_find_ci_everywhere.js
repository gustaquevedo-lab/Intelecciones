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

const allDbs = findDbs('c:\\Users\\Gustavo Quevedo\\OneDrive\\Dev\\Intelecciones');
console.log(`Found ${allDbs.length} DB files:`);

for (const dbInfo of allDbs) {
  console.log(`\nDB: ${dbInfo.path} (${dbInfo.size} bytes)`);
  if (dbInfo.size === 0) continue;
  try {
    const db = new Database(dbInfo.path);
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
    console.log('  Tables:', tables.map(t => t.name));
    for (const tableObj of tables) {
      const table = tableObj.name;
      if (['electors', 'elector_captures', 'users', 'campaigns'].includes(table)) {
        try {
          const count = db.prepare(`SELECT count(*) as c from ${table}`).get().c;
          console.log(`    - ${table}: ${count} rows`);
        } catch (e) {
          console.log(`    - ${table}: error (${e.message})`);
        }
      }
    }
    // Also search for elector 4388985 specifically
    try {
      const hasElectors = tables.some(t => t.name === 'electors');
      if (hasElectors) {
        const elector = db.prepare('SELECT * FROM electors WHERE ci = ?').get('4388985');
        if (elector) {
          console.log('    [FOUND] elector in electors:', elector);
        }
      }
      const hasCaptures = tables.some(t => t.name === 'elector_captures');
      if (hasCaptures) {
        const capture = db.prepare('SELECT * FROM elector_captures WHERE elector_ci = ?').get('4388985');
        if (capture) {
          console.log('    [FOUND] capture in elector_captures:', capture);
        }
      }
    } catch (e) {
      console.log('    Error searching CI 4388985:', e.message);
    }
    db.close();
  } catch (err) {
    console.log('  Failed to open:', err.message);
  }
}
