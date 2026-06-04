const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, '..', 'intellecciones.db');
console.log('Opening DB at:', dbPath);
const db = new Database(dbPath);

console.time('original query');
try {
  const res = db.prepare(`
    SELECT ec.id as capture_id, ec.elector_ci, ec.telefono as elector_telefono,
           ec.traffic_light, ec.needs_transport, ec.timestamp, ec.is_disputed,
           cc.status as conflict_status
    FROM elector_captures ec
    LEFT JOIN capture_conflicts cc ON (
      (ec.id = cc.capture_id OR ec.id = cc.capture_id_b)
      AND cc.id = (
        SELECT id FROM capture_conflicts
        WHERE capture_id = ec.id OR capture_id_b = ec.id
        ORDER BY timestamp DESC LIMIT 1
      )
    )
    LIMIT 100
  `).all();
  console.log('Original query success, length:', res.length);
} catch (e) {
  console.error('Original query failed:', e);
}
console.timeEnd('original query');

console.time('optimized query');
try {
  const resOpt = db.prepare(`
    SELECT ec.id as capture_id, ec.elector_ci, ec.telefono as elector_telefono,
           ec.traffic_light, ec.needs_transport, ec.timestamp, ec.is_disputed,
           cc.status as conflict_status
    FROM elector_captures ec
    LEFT JOIN capture_conflicts cc ON (
      cc.elector_ci = ec.elector_ci
      AND cc.id = (
        SELECT id FROM capture_conflicts
        WHERE elector_ci = ec.elector_ci
        ORDER BY timestamp DESC LIMIT 1
      )
    )
    LIMIT 100
  `).all();
  console.log('Optimized query success, length:', resOpt.length);
} catch (e) {
  console.error('Optimized query failed:', e);
}
console.timeEnd('optimized query');
