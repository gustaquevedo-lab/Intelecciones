const Database = require('better-sqlite3');
const path = require('path');
const db = new Database(path.join(__dirname, '../intellecciones.db'));

const district = 'PEDRO JUAN CABALLERO';

const query = `
  SELECT 
    cc.id as conflict_id,
    cc.status as conflict_status,
    cc.conflict_type,
    cc.jefe_decision_id,
    cc.consent_a,
    cc.consent_b,
    cc.list_id_a,
    cc.list_id_b,
    cc.elector_ci as elector_ci,
    e.nombre as elector_nombre,
    e.apellido as elector_apellido,
    
    ca.id as capture_a_id,
    ca.traffic_light as tl_a,
    ca.needs_transport as transport_a,
    ca.timestamp as time_a,
    ca.lat as lat_a,
    ca.lng as lng_a,
    ua.nombre as coord_a,
    ua.photo_url as photo_a,
    pa.nombre as padrino_a,
    la.list_number as list_a,
    la.option_number as option_a,
    
    cb.id as capture_b_id,
    cb.traffic_light as tl_b,
    cb.needs_transport as transport_b,
    cb.timestamp as time_b,
    cb.lat as lat_b,
    cb.lng as lng_b,
    ub.nombre as coord_b,
    ub.photo_url as photo_b,
    pb.nombre as padrino_b,
    lb.list_number as list_b,
    lb.option_number as option_b

  FROM capture_conflicts cc
  CROSS JOIN electors e ON cc.elector_ci = e.ci
  LEFT JOIN elector_captures ca ON cc.capture_id = ca.id
  LEFT JOIN elector_captures cb ON cc.capture_id_b = cb.id
  LEFT JOIN users ua ON ca.coordinator_id = ua.id
  LEFT JOIN users ub ON cb.coordinator_id = ub.id
  LEFT JOIN users pa ON ua.parent_id = pa.id
  LEFT JOIN users pb ON ub.parent_id = pb.id
  LEFT JOIN lists la ON ca.list_id = la.id
  LEFT JOIN lists lb ON cb.list_id = lb.id
  WHERE cc.status != 'RESOLVED' AND e.distrito = ?
`;

try {
  console.log("=== EXPLAIN QUERY PLAN ===");
  const plan = db.prepare(`EXPLAIN QUERY PLAN ${query}`).all(district);
  console.log(JSON.stringify(plan, null, 2));

  console.log("\n=== RUNNING QUERY ===");
  const start = performance.now();
  const rows = db.prepare(query).all(district);
  const end = performance.now();
  console.log(`Query returned ${rows.length} rows in ${(end - start).toFixed(2)}ms`);
} catch (err) {
  console.error("FAILED:", err.message);
}
