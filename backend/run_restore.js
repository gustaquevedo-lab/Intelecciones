const Database = require('better-sqlite3');
const path = require('path');
const db = new Database(path.join(__dirname, 'intellecciones.db'));

console.log("=== RUNNING CORRECTED CONFLICT RESTORE ===");
let inserted = 0;
let marked = 0;

try {
  db.transaction(() => {
    const r1 = db.prepare(`
      INSERT INTO capture_conflicts (capture_id, capture_id_b, elector_ci, list_id_a, list_id_b, conflict_type, status)
      SELECT 
        dups.capture_id, dups.capture_id_b, dups.elector_ci,
        ea.list_id as list_id_a, eb.list_id as list_id_b,
        CASE WHEN ea.list_id = eb.list_id THEN 'INTERNAL' ELSE 'INTER_LIST' END as conflict_type,
        'PENDING'
      FROM (
        SELECT MIN(id) as capture_id, MAX(id) as capture_id_b, elector_ci
        FROM elector_captures
        WHERE elector_ci IS NOT NULL AND elector_ci != ''
          AND elector_ci IN (SELECT elector_ci FROM elector_captures GROUP BY elector_ci HAVING COUNT(*) > 1)
          AND elector_ci NOT IN (SELECT elector_ci FROM capture_conflicts WHERE status = 'PENDING' OR status = 'WAITING_CONSENT')
        GROUP BY elector_ci
      ) dups
      INNER JOIN elector_captures ea ON ea.id = dups.capture_id
      INNER JOIN elector_captures eb ON eb.id = dups.capture_id_b
    `).run();
    inserted = r1.changes;
    console.log("Conflicts inserted:", inserted);

    const r2 = db.prepare(`
      UPDATE elector_captures SET is_disputed = 1
      WHERE id IN (
        SELECT capture_id FROM capture_conflicts WHERE status = 'PENDING' OR status = 'WAITING_CONSENT'
        UNION
        SELECT capture_id_b FROM capture_conflicts WHERE status = 'PENDING' OR status = 'WAITING_CONSENT'
      )
    `).run();
    marked = r2.changes;
    console.log("Captures marked as disputed:", marked);
  })();

  const total = db.prepare("SELECT COUNT(*) as c FROM capture_conflicts").get().c;
  console.log("Total conflicts now in DB:", total);
  console.log("=== RESTORE COMPLETE ===");
} catch(e) {
  console.error("RESTORE FAILED:", e.message);
}
