const Database = require('better-sqlite3');
const path = require('path');
const db = new Database(path.join(__dirname, '../intellecciones.db'));

console.log("=== VERIFYING NEWLY OPTIMIZED QUERIES ===");

const district = 'PEDRO JUAN CABALLERO';

// Mock getSecurityFilter SQL for table u
const sec_u = {
  sql: ` AND (
    u.distrito = ? OR 
    EXISTS (SELECT 1 FROM lists l2 WHERE l2.id = u.assigned_list_id AND l2.ciudad = ?) OR 
    EXISTS (SELECT 1 FROM campaigns c2 WHERE c2.id = u.assigned_campaign_id AND c2.distrito = ?)
  )`,
  params: [district, district, district]
};

// Mock getSecurityFilter SQL for table cc (conflicts)
const sec_cc = {
  sql: ` AND e.distrito = ?`,
  params: [district]
};

function runTest(name, query, params) {
  const start = performance.now();
  try {
    const rows = db.prepare(query).all(...params);
    const end = performance.now();
    console.log(`[${name}] SUCCESS: ${rows.length} rows in ${(end - start).toFixed(2)}ms`);
    if (rows.length > 0) {
      console.log("  Sample row:", JSON.stringify(rows[0]).substring(0, 150));
    }
  } catch (err) {
    console.error(`[${name}] FAILED:`, err.message);
  }
}

// 1. /api/users standard fallback
const usersQuery = `
  WITH filtered_users AS (
    SELECT * FROM users u
    WHERE 1=1 ${sec_u.sql}
    LIMIT -1
  )
  SELECT 
    u.*, 
    l.list_number, 
    l.type as list_type, 
    COALESCE(c1.id, c2.id) as effective_campaign_id,
    COALESCE(c1.name, c2.name) as campaign_name,
    p.nombre as parent_name
  FROM filtered_users u
  LEFT JOIN lists l ON u.assigned_list_id = l.id
  LEFT JOIN campaigns c1 ON l.campaign_id = c1.id
  LEFT JOIN campaigns c2 ON u.assigned_campaign_id = c2.id
  LEFT JOIN users p ON u.parent_id = p.id
  WHERE 1=1
`;
runTest("1. Users Query (Fallback)", usersQuery, sec_u.params);

// 2. /api/admin/conflicts
const conflictsQuery = `
  WITH active_conflicts AS (
    SELECT * FROM capture_conflicts WHERE status != 'RESOLVED' LIMIT -1
  ),
  active_conflicts_with_elector AS (
    SELECT 
      cc.*,
      e.nombre as elector_nombre,
      e.apellido as elector_apellido,
      e.distrito as distrito
    FROM active_conflicts cc
    LEFT JOIN electors e ON cc.elector_ci = e.ci
    LIMIT -1
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

  FROM active_conflicts_with_elector e
  LEFT JOIN elector_captures ca ON e.capture_id = ca.id
  LEFT JOIN elector_captures cb ON e.capture_id_b = cb.id
  LEFT JOIN users ua ON ca.coordinator_id = ua.id
  LEFT JOIN users ub ON cb.coordinator_id = ub.id
  LEFT JOIN users pa ON ua.parent_id = pa.id
  LEFT JOIN users pb ON ub.parent_id = pb.id
  LEFT JOIN lists la ON ca.list_id = la.id
  LEFT JOIN lists lb ON cb.list_id = lb.id
  WHERE 1=1 ${sec_cc.sql}
`;
runTest("2. Conflicts Query", conflictsQuery, sec_cc.params);

// 3. /api/admin/conflicts/history
const conflictsHistoryQuery = `
  WITH resolved_conflicts AS (
    SELECT * FROM capture_conflicts WHERE status = 'RESOLVED' LIMIT -1
  ),
  resolved_conflicts_with_elector AS (
    SELECT 
      cc.*,
      e.ci as elector_ci_ref,
      e.nombre as elector_nombre,
      e.apellido as elector_apellido,
      e.local_votacion as local_votacion,
      e.mesa as mesa,
      e.distrito as distrito,
      e.ciudad as ciudad
    FROM resolved_conflicts cc
    LEFT JOIN electors e ON cc.elector_ci = e.ci
    LIMIT -1
  )
  SELECT 
    e.id as conflict_id,
    e.status as conflict_status,
    e.resolved_at,
    COALESCE(e.elector_ci_ref, e.elector_ci) as elector_ci,
    COALESCE(e.elector_nombre, 'ELECTOR') as elector_nombre,
    COALESCE(e.elector_apellido, 'NO REGISTRADO') as elector_apellido,
    COALESCE(e.local_votacion, 'REGISTRO DE CAMPO') as local_votacion,
    COALESCE(e.mesa, 0) as mesa,
    
    COALESCE(u_win_1.nombre, u_win_2.nombre) as winner_name,
    COALESCE(u_win_1.role, u_win_2.role) as winner_role,
    p_win.nombre as padrino_name
  FROM resolved_conflicts_with_elector e
  LEFT JOIN elector_captures ec_win_1 ON e.winner_capture_id = ec_win_1.id
  LEFT JOIN elector_captures ec_win_2 ON e.jefe_decision_id = ec_win_2.id
  LEFT JOIN users u_win_1 ON ec_win_1.coordinator_id = u_win_1.id
  LEFT JOIN users u_win_2 ON ec_win_2.coordinator_id = u_win_2.id
  LEFT JOIN users p_win ON COALESCE(u_win_1.parent_id, u_win_2.parent_id) = p_win.id
  WHERE 1=1 ${sec_cc.sql}
`;
runTest("3. Conflicts History Query", conflictsHistoryQuery, sec_cc.params);

// 4. /api/admin/activity (First occurrence)
const activityFirstQuery = `
  WITH filtered_users AS (
    SELECT id, nombre, photo_url FROM users u
    WHERE 1=1 ${sec_u.sql}
    LIMIT -1
  )
  SELECT al.*, u.nombre as user_name, u.photo_url as user_photo
  FROM filtered_users u
  JOIN audit_logs al ON al.user_id = u.id
  ORDER BY al.timestamp DESC LIMIT 50
`;
runTest("4. Activity Audit Logs Query", activityFirstQuery, sec_u.params);

// 5. /api/admin/activity (Second occurrence union query)
const activitySecondQuery = `
  WITH filtered_users AS (
    SELECT id, nombre FROM users u
    WHERE 1=1 ${sec_u.sql}
    LIMIT -1
  )
  SELECT 'CAPTURE' as type, ec.timestamp, u.nombre as user_name, COALESCE(e.nombre || ' ' || e.apellido, 'ELECTOR') as entity_name, 'Nueva Captura' as detail
  FROM elector_captures ec
  LEFT JOIN electors e ON ec.elector_ci = e.ci
  JOIN filtered_users u ON ec.coordinator_id = u.id
  
  UNION ALL
  
  SELECT 'REQUEST' as type, r.timestamp, u.nombre as user_name, r.type as entity_name, r.description as detail
  FROM field_requests r
  JOIN filtered_users u ON r.coordinator_id = u.id
  
  UNION ALL
  
  SELECT 'CONFLICT' as type, cc.timestamp, 'Sistema' as user_name, COALESCE(e.nombre || ' ' || e.apellido, 'ELECTOR') as entity_name, 'Doble Captura' as detail
  FROM capture_conflicts cc
  LEFT JOIN electors e ON cc.elector_ci = e.ci
  JOIN elector_captures ec ON cc.capture_id = ec.id
  JOIN filtered_users u ON ec.coordinator_id = u.id
  
  ORDER BY timestamp DESC
  LIMIT 20
`;
runTest("5. Activity Unified Union Query", activitySecondQuery, sec_u.params);
