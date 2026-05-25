const Database = require('better-sqlite3');
const path = require('path');
const db = new Database(path.join(__dirname, 'intellecciones.db'));

console.log("=== INSPECTING PJC CAPTURES & CONFLICTS ===");

// Check campaigns
const campaigns = db.prepare("SELECT * FROM campaigns").all();
console.log("Campaigns:", campaigns);

// Check electors count in PJC
const pjcElectors = db.prepare("SELECT COUNT(*) as count FROM electors WHERE distrito = 'PEDRO JUAN CABALLERO'").get().count;
console.log("Electors in PJC:", pjcElectors);

// Check elector captures in PJC (either by elector district or coordinator district)
const pjcCaptures = db.prepare(`
  SELECT COUNT(ec.id) as count
  FROM elector_captures ec
  LEFT JOIN electors e ON ec.elector_ci = e.ci
  LEFT JOIN users u ON ec.coordinator_id = u.id
  WHERE e.distrito = 'PEDRO JUAN CABALLERO' OR u.distrito = 'PEDRO JUAN CABALLERO'
`).get().count;
console.log("Captures in PJC:", pjcCaptures);

// Check capture conflicts in PJC
const pjcConflicts = db.prepare(`
  SELECT COUNT(cc.id) as count
  FROM capture_conflicts cc
  LEFT JOIN elector_captures ec ON cc.capture_id = ec.id
  LEFT JOIN electors e ON ec.elector_ci = e.ci
  WHERE e.distrito = 'PEDRO JUAN CABALLERO'
`).get().count;
console.log("Conflicts in PJC:", pjcConflicts);

// Check if any capture is marked as is_disputed = 1
const disputedCaptures = db.prepare(`
  SELECT COUNT(*) as count FROM elector_captures WHERE is_disputed = 1
`).get().count;
console.log("Total is_disputed = 1 captures:", disputedCaptures);

// Check total conflicts in database
const totalConflicts = db.prepare("SELECT COUNT(*) as count FROM capture_conflicts").get().count;
console.log("Total conflicts in database:", totalConflicts);
