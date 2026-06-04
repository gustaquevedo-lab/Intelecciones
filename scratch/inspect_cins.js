const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, '..', 'backend', 'intellecciones.db');
const db = new Database(dbPath);

const cis = ['7424600', '7170676'];

cis.forEach(ci => {
  console.log(`\n=== INSPECIONANDO CI: ${ci} ===`);
  
  const elector = db.prepare("SELECT * FROM electors WHERE ci = ?").get(ci);
  console.log("Elector:", elector);
  
  const captures = db.prepare("SELECT * FROM elector_captures WHERE elector_ci = ?").all(ci);
  console.log("Captures:", captures);
  
  if (captures.length > 0) {
    captures.forEach(c => {
      // Check list info
      const list = db.prepare("SELECT * FROM lists WHERE id = ?").get(c.list_id);
      console.log(`  -> List (ID ${c.list_id}):`, list);
    });
  }
});
