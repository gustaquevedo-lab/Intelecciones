const Database = require('better-sqlite3');
const db = new Database('intellecciones.db');

console.log("=== SEARCHING ELECTORS FOR 6351215 ===");
const electors = db.prepare("SELECT * FROM electors WHERE ci LIKE '%6351215%'").all();
console.log(JSON.stringify(electors, null, 2));

console.log("\n=== SEARCHING CAPTURES FOR 6351215 ===");
const captures = db.prepare(`
  SELECT ec.*, u.nombre as coordinator_name, u.role as coordinator_role, u.distrito as coordinator_distrito
  FROM elector_captures ec
  LEFT JOIN users u ON ec.coordinator_id = u.id
  WHERE ec.elector_ci LIKE '%6351215%'
`).all();
console.log(JSON.stringify(captures, null, 2));

console.log("\n=== SEARCHING CONFLICTS FOR 6351215 ===");
const conflicts = db.prepare("SELECT * FROM capture_conflicts WHERE elector_ci LIKE '%6351215%'").all();
console.log(JSON.stringify(conflicts, null, 2));

db.close();
