const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, '..', 'intellecciones.db');
console.log('Opening DB at:', dbPath);
const db = new Database(dbPath);

console.log('--- Original Query Plan ---');
try {
  const plan = db.prepare(`
    EXPLAIN QUERY PLAN
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
  `).all();
  console.log(plan);
} catch (e) {
  console.error(e);
}

console.log('--- Optimized Query Plan (on elector_ci) ---');
try {
  const planOpt = db.prepare(`
    EXPLAIN QUERY PLAN
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
  `).all();
  console.log(planOpt);
} catch (e) {
  console.error(e);
}
