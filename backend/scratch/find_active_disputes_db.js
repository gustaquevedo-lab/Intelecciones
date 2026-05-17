const Database = require('better-sqlite3');
const fs = require('fs');

const dbs = [
  'c:\\Users\\Gustavo Quevedo\\OneDrive\\Dev\\Intelecciones\\intellecciones.db',
  'c:\\Users\\Gustavo Quevedo\\OneDrive\\Dev\\Intelecciones\\backend\\intellecciones.db',
  'c:\\Users\\Gustavo Quevedo\\OneDrive\\Dev\\Intelecciones\\backend\\recovered_intellecciones.db',
  'c:\\Users\\Gustavo Quevedo\\OneDrive\\Dev\\Intelecciones\\backend\\temp_db_95b.db'
];

for (const dbPath of dbs) {
  if (!fs.existsSync(dbPath)) {
    console.log(`\nPath does not exist: ${dbPath}`);
    continue;
  }
  
  console.log(`\n==========================================`);
  console.log(`Checking database: ${dbPath}`);
  console.log(`Size: ${(fs.statSync(dbPath).size / 1024).toFixed(2)} KB`);
  
  try {
    const db = new Database(dbPath);
    
    // Check if capture_conflicts table exists
    const tableCheck = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='capture_conflicts'").get();
    if (!tableCheck) {
      console.log("  Table 'capture_conflicts' does not exist!");
      continue;
    }
    
    const conflictsCount = db.prepare('SELECT COUNT(*) as count FROM capture_conflicts').get().count;
    const activeConflictsCount = db.prepare("SELECT COUNT(*) as count FROM capture_conflicts WHERE status != 'RESOLVED'").get().count;
    const disputedCount = db.prepare('SELECT COUNT(*) as count FROM elector_captures WHERE is_disputed = 1').get().count;
    
    console.log(`  Total conflicts inside capture_conflicts: ${conflictsCount}`);
    console.log(`  Active conflicts: ${activeConflictsCount}`);
    console.log(`  Elector captures with is_disputed = 1: ${disputedCount}`);
    
    const duplicates = db.prepare(`
      SELECT COUNT(*) as count FROM (
        SELECT elector_ci FROM elector_captures GROUP BY elector_ci HAVING COUNT(*) > 1
      )
    `).get().count;
    console.log(`  Electors with duplicate captures: ${duplicates}`);
    
    if (activeConflictsCount > 0) {
      console.log(`  !!! FOUND ACTIVE DISPUTES !!!`);
      const sample = db.prepare("SELECT * FROM capture_conflicts WHERE status != 'RESOLVED' LIMIT 3").all();
      for (const s of sample) {
        console.log(`    Conflict ID: ${s.id}, CI: ${s.elector_ci}, status: ${s.status}, A: ${s.capture_id}, B: ${s.capture_id_b}`);
      }
    }
  } catch (e) {
    console.log(`  Error querying database: ${e.message}`);
  }
}
