const Database = require('better-sqlite3');
const path = require('path');

const dbPath = 'c:\\Users\\Gustavo Quevedo\\OneDrive\\Dev\\Intelecciones\\backend\\intellecciones.db';
console.log("Opening active database at:", dbPath);
const db = new Database(dbPath);

try {
  const allConflicts = db.prepare('SELECT * FROM capture_conflicts').all();
  console.log(`\nTotal conflicts in capture_conflicts table: ${allConflicts.length}`);
  for (const c of allConflicts.slice(0, 10)) {
    console.log(`  ID: ${c.id}, ci: ${c.elector_ci}, status: ${c.status}, capture_id: ${c.capture_id}, capture_id_b: ${c.capture_id_b}, winner: ${c.winner_capture_id}`);
  }
  
  const disputedCaptures = db.prepare('SELECT id, elector_ci, coordinator_id, list_id, is_disputed, timestamp FROM elector_captures WHERE is_disputed = 1').all();
  console.log(`\nTotal captures with is_disputed = 1: ${disputedCaptures.length}`);
  for (const cap of disputedCaptures.slice(0, 10)) {
    const user = db.prepare('SELECT nombre FROM users WHERE id = ?').get(cap.coordinator_id);
    console.log(`  ID: ${cap.id}, ci: ${cap.elector_ci}, coordinator: ${user ? user.nombre : 'Unknown'}, list: ${cap.list_id}, time: ${cap.timestamp}`);
  }

  // Check count of duplicates in elector_captures
  const duplicates = db.prepare(`
    SELECT elector_ci, COUNT(*) as count 
    FROM elector_captures 
    GROUP BY elector_ci 
    HAVING COUNT(*) > 1
  `).all();
  console.log(`\nTotal electors with multiple captures: ${duplicates.length}`);
  for (const d of duplicates.slice(0, 10)) {
    console.log(`  Elector CI: ${d.elector_ci}, Captures Count: ${d.count}`);
    const captures = db.prepare('SELECT id, coordinator_id, list_id, is_disputed FROM elector_captures WHERE elector_ci = ?').all(d.elector_ci);
    for (const c of captures) {
      const user = db.prepare('SELECT nombre FROM users WHERE id = ?').get(c.coordinator_id);
      console.log(`    -> Capture ID: ${c.id}, Coord: ${user ? user.nombre : 'Unknown'}, List: ${c.list_id}, disputed: ${c.is_disputed}`);
    }
  }

} catch (e) {
  console.error("Error running query:", e);
}
