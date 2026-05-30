const Database = require('better-sqlite3');
const path = require('path');
const db = new Database(path.join(__dirname, '../intellecciones.db'));

const district = 'PEDRO JUAN CABALLERO';

const activeQuery = `
  WITH active_conflicts AS MATERIALIZED (
    SELECT * FROM capture_conflicts WHERE status != 'RESOLVED'
  ),
  active_conflicts_with_elector AS MATERIALIZED (
    SELECT 
      cc.*,
      e.nombre as elector_nombre,
      e.apellido as elector_apellido,
      e.distrito as distrito
    FROM active_conflicts cc
    LEFT JOIN electors e ON cc.elector_ci = e.ci
  )
  SELECT 
    e.id as conflict_id,
    e.status as conflict_status,
    e.conflict_type,
    e.jefe_decision_id,
    e.consent_a,
    e.consent_b,
    e.list_id_a,
    e.list_id_b,
    e.elector_ci as elector_ci,
    e.elector_nombre,
    e.elector_apellido,
    
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

  FROM active_conflicts_with_elector e
  LEFT JOIN elector_captures ca ON e.capture_id = ca.id
  LEFT JOIN elector_captures cb ON e.capture_id_b = cb.id
  LEFT JOIN users ua ON ca.coordinator_id = ua.id
  LEFT JOIN users ub ON cb.coordinator_id = ub.id
  LEFT JOIN users pa ON ua.parent_id = pa.id
  LEFT JOIN users pb ON ub.parent_id = pb.id
  LEFT JOIN lists la ON ca.list_id = la.id
  LEFT JOIN lists lb ON cb.list_id = lb.id
  WHERE 1=1 AND e.distrito = ?
`;

try {
  console.log("=== EXPLAIN QUERY PLAN ===");
  const plan = db.prepare(`EXPLAIN QUERY PLAN ${activeQuery}`).all(district);
  console.log(JSON.stringify(plan, null, 2));
} catch (err) {
  console.error("EXPLAIN FAILED:", err.message);
}
