const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, 'intellecciones.db');
const db = new Database(dbPath);

console.log("Restoring capture conflicts in:", dbPath);

try {
  db.transaction(() => {
    // 1. Insert missing conflicts from duplicate captures
    const result = db.prepare(`
      INSERT INTO capture_conflicts (capture_id, capture_id_b, elector_ci, list_id_a, list_id_b, conflict_type, status)
      SELECT 
        MIN(id) as capture_id, 
        MAX(id) as capture_id_b, 
        elector_ci, 
        (SELECT list_id FROM elector_captures WHERE id = MIN(ec.id)) as list_id_a, 
        (SELECT list_id FROM elector_captures WHERE id = MAX(ec.id)) as list_id_b,
        CASE 
          WHEN (SELECT list_id FROM elector_captures WHERE id = MIN(ec.id)) = (SELECT list_id FROM elector_captures WHERE id = MAX(ec.id)) 
          THEN 'INTERNAL' 
          ELSE 'INTER_LIST' 
        END as conflict_type,
        'PENDING'
      FROM elector_captures ec
      WHERE elector_ci IN (
        SELECT elector_ci 
        FROM elector_captures 
        WHERE elector_ci IS NOT NULL AND elector_ci != ''
        GROUP BY elector_ci 
        HAVING COUNT(*) > 1
      )
      AND elector_ci NOT IN (SELECT elector_ci FROM capture_conflicts WHERE status = 'PENDING' OR status = 'WAITING_CONSENT')
      GROUP BY elector_ci
    `).run();

    console.log(`Inserted ${result.changes} missing conflict records.`);

    // 2. Mark captures as disputed
    const updateResult = db.prepare(`
      UPDATE elector_captures
      SET is_disputed = 1
      WHERE id IN (
        SELECT capture_id FROM capture_conflicts WHERE status = 'PENDING' OR status = 'WAITING_CONSENT'
        UNION
        SELECT capture_id_b FROM capture_conflicts WHERE status = 'PENDING' OR status = 'WAITING_CONSENT'
      )
    `).run();

    console.log(`Marked ${updateResult.changes} captures as disputed.`);
  })();
  console.log("RESTORE SUCCESSFUL");
} catch (e) {
  console.error("ERROR RESTORING:", e.message);
}
