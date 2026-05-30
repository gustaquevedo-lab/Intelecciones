const Database = require('better-sqlite3');
const path = require('path');
const db = new Database(path.join(__dirname, '../intellecciones.db'));

const district = 'PEDRO JUAN CABALLERO';

const queryInnerJoin = `
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
  INNER JOIN electors e ON cc.elector_ci = e.ci
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

const queryElectorsFirst = `
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

  FROM electors e
  CROSS JOIN capture_conflicts cc ON cc.elector_ci = e.ci
  LEFT JOIN elector_captures ca ON cc.capture_id = ca.id
  LEFT JOIN elector_captures cb ON cc.capture_id_b = cb.id
  LEFT JOIN users ua ON ca.coordinator_id = ua.id
  LEFT JOIN users ub ON cb.coordinator_id = ub.id
  LEFT JOIN users pa ON ua.parent_id = pa.id
  LEFT JOIN users pb ON ub.parent_id = pb.id
  LEFT JOIN lists la ON ca.list_id = la.id
  LEFT JOIN lists lb ON cb.list_id = lb.id
  WHERE e.distrito = ? AND cc.status != 'RESOLVED'
`;

try {
  console.log("=== OPTION 1: INNER JOIN (Planner Choice) ===");
  const plan1 = db.prepare(`EXPLAIN QUERY PLAN ${queryInnerJoin}`).all(district);
  console.log(JSON.stringify(plan1, null, 2));
  
  const start1 = performance.now();
  const rows1 = db.prepare(queryInnerJoin).all(district);
  const end1 = performance.now();
  console.log(`INNER JOIN returned ${rows1.length} rows in ${(end1 - start1).toFixed(2)}ms`);

  console.log("\n=== OPTION 2: ELECTORS FIRST CROSS JOIN ===");
  const plan2 = db.prepare(`EXPLAIN QUERY PLAN ${queryElectorsFirst}`).all(district);
  console.log(JSON.stringify(plan2, null, 2));

  const start2 = performance.now();
  const rows2 = db.prepare(queryElectorsFirst).all(district);
  const end2 = performance.now();
  console.log(`ELECTORS FIRST CROSS JOIN returned ${rows2.length} rows in ${(end2 - start2).toFixed(2)}ms`);

} catch (err) {
  console.error("FAILED:", err.message);
}
