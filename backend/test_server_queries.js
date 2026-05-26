const Database = require('better-sqlite3');
const path = require('path');
const db = new Database(path.join(__dirname, 'intellecciones.db'));

console.log("=== TESTING OPTIMIZED SERVER QUERIES ===");

// 1. Test /api/structure/padrinos query
try {
  console.log("\n1. Testing /api/structure/padrinos CTE query...");
  // Simulate security filter for CONCEPCION
  const district = 'CONCEPCION';
  const secSql = "AND (u.distrito = ? OR EXISTS (SELECT 1 FROM lists l2 WHERE l2.id = u.assigned_list_id AND l2.ciudad = ?) OR EXISTS (SELECT 1 FROM campaigns c2 WHERE c2.id = u.assigned_campaign_id AND c2.distrito = ?))";
  const secParams = [district, district, district];

  const query = `
    WITH team_map AS (
      SELECT id as member_id,
             CASE WHEN role IN ('PADRINO','SUBJEFE') THEN id ELSE parent_id END as padrino_id
      FROM users
      WHERE role IN ('PADRINO','SUBJEFE','COORDINADOR','MIEMBRO_DE_MESA')
    ),
    padrino_stats AS (
      SELECT tm.padrino_id,
             COUNT(ec.id) as total_captures,
             SUM(CASE WHEN ec.needs_transport = 1 THEN 1 ELSE 0 END) as needs_transport,
             SUM(CASE WHEN ec.traffic_light = 'GREEN' THEN 1 ELSE 0 END) as green,
             SUM(CASE WHEN ec.traffic_light = 'YELLOW' THEN 1 ELSE 0 END) as yellow,
             SUM(CASE WHEN ec.traffic_light = 'RED' THEN 1 ELSE 0 END) as red,
             SUM(CASE WHEN ec.traffic_light = 'PURPLE' THEN 1 ELSE 0 END) as purple
      FROM team_map tm
      INNER JOIN elector_captures ec ON ec.coordinator_id = tm.member_id
      GROUP BY tm.padrino_id
    )
    SELECT u.id, u.nombre, u.photo_url, u.telefono, u.assigned_list_id,
           l.list_number, l.option_number,
           (SELECT COUNT(*) FROM users u2 WHERE u2.parent_id = u.id AND u2.role IN ('COORDINADOR', 'MIEMBRO_DE_MESA')) AS coordinator_count,
           COALESCE(ps.total_captures, 0) AS total_electors,
           COALESCE(ps.needs_transport, 0) AS transport_total,
           COALESCE(ps.green, 0) AS green_total,
           COALESCE(ps.yellow, 0) AS yellow_total,
           COALESCE(ps.red, 0) AS red_total,
           COALESCE(ps.purple, 0) AS purple_total
     FROM users u
     LEFT JOIN lists l ON u.assigned_list_id = l.id
     LEFT JOIN padrino_stats ps ON ps.padrino_id = u.id
     WHERE u.role IN ('PADRINO', 'SUBJEFE') ${secSql}
     ORDER BY u.nombre
  `;

  const results = db.prepare(query).all(...secParams);
  console.log("Padrinos query ran successfully. Result count:", results.length);
  console.log("Sample padrino stats:", results[0]);
} catch (e) {
  console.error("Padrinos query FAILED:", e.message);
}

// 2. Test /api/admin/conflicts query with 'cc' security filter
try {
  console.log("\n2. Testing /api/admin/conflicts query for PJC...");
  const district = 'PEDRO JUAN CABALLERO';
  const secSql = "AND (e.ciudad = ? OR e.distrito = ? OR ua.distrito = ? OR ub.distrito = ?)";
  const secParams = [district, district, district, district];

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
      e.ci as elector_ci,
      e.nombre as elector_nombre,
      e.apellido as elector_apellido,
      
      -- Capture A
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
      
      -- Capture B
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
    LEFT JOIN electors e ON cc.elector_ci = e.ci
    LEFT JOIN elector_captures ca ON cc.capture_id = ca.id
    LEFT JOIN elector_captures cb ON cc.capture_id_b = cb.id
    LEFT JOIN users ua ON ca.coordinator_id = ua.id
    LEFT JOIN users ub ON cb.coordinator_id = ub.id
    LEFT JOIN users pa ON ua.parent_id = pa.id
    LEFT JOIN users pb ON ub.parent_id = pb.id
    LEFT JOIN lists la ON ca.list_id = la.id
    LEFT JOIN lists lb ON cb.list_id = lb.id
    WHERE cc.status != 'RESOLVED' ${secSql}
  `;

  const results = db.prepare(query).all(...secParams);
  console.log("Conflicts query ran successfully for PJC. Result count:", results.length);
  console.log("Returned conflicts:", results.map(r => ({
    id: r.conflict_id,
    type: r.conflict_type,
    ci: r.elector_ci,
    coord_a: r.coord_a,
    coord_b: r.coord_b
  })));
} catch (e) {
  console.error("Conflicts query FAILED:", e.message);
}

// 3. Test /api/structure/padrinos/:id/full-report query
try {
  console.log("\n3. Testing /api/structure/padrinos/:id/full-report coordinators query...");
  const padrinoId = 8; // Concepcion padrino
  const query = `
    WITH coord_stats AS (
      SELECT coordinator_id,
             COUNT(id) as total_electors,
             SUM(CASE WHEN traffic_light = 'GREEN' THEN 1 ELSE 0 END) as green,
             SUM(CASE WHEN traffic_light = 'YELLOW' THEN 1 ELSE 0 END) as yellow,
             SUM(CASE WHEN traffic_light = 'RED' THEN 1 ELSE 0 END) as red,
             SUM(CASE WHEN traffic_light = 'PURPLE' THEN 1 ELSE 0 END) as purple,
             SUM(CASE WHEN needs_transport = 1 THEN 1 ELSE 0 END) as transport_needed
      FROM elector_captures
      GROUP BY coordinator_id
    )
    SELECT u.id, u.nombre, u.telefono,
           COALESCE(cs.total_electors, 0) as total_electors,
           COALESCE(cs.green, 0) as green,
           COALESCE(cs.yellow, 0) as yellow,
           COALESCE(cs.red, 0) as red,
           COALESCE(cs.purple, 0) as purple,
           COALESCE(cs.transport_needed, 0) as transport_needed
    FROM users u
    LEFT JOIN coord_stats cs ON cs.coordinator_id = u.id
    WHERE u.parent_id = ? AND u.role IN ('COORDINADOR', 'MIEMBRO_DE_MESA')
  `;

  const results = db.prepare(query).all(padrinoId);
  console.log("Full-report coordinators query ran successfully. Result count:", results.length);
  console.log("Coordinators stats:", results);
} catch (e) {
  console.error("Full-report coordinators query FAILED:", e.message);
}
