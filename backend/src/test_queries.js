const Database = require('better-sqlite3');
const path = require('path');
const dbPath = path.join(__dirname, '../intellecciones.db');
console.log("Opening db at:", dbPath);
const db = new Database(dbPath);

const d = 'PEDRO JUAN CABALLERO';

// Check settings
try {
  const settings = db.prepare("SELECT * FROM settings").all();
  console.log("Database Settings:", settings);
} catch (e) {
  console.error("Failed to read settings:", e.message);
}

// Benchmark Normalization check
measure('Normalization v4 check', () => {
  return db.prepare("SELECT 1 FROM settings WHERE key = 'normalization_v4_full_done'").get();
});


function measure(name, fn) {
  const start = Date.now();
  try {
    const res = fn();
    const count = Array.isArray(res) ? res.length : (res ? 1 : 0);
    console.log(`${name}: ${Date.now() - start}ms (returned ${count} rows)`);
  } catch (err) {
    console.error(`${name} failed:`, err.message);
  }
}

// 1. Users query
measure('Users Query', () => {
  let sql = `
    SELECT 
      u.*, 
      l.list_number, 
      l.type as list_type, 
      COALESCE(c.id, u.assigned_campaign_id) as effective_campaign_id,
      c.name as campaign_name,
      p.nombre as parent_name
    FROM users u
    LEFT JOIN lists l ON u.assigned_list_id = l.id
    LEFT JOIN campaigns c ON (l.campaign_id = c.id OR u.assigned_campaign_id = c.id)
    LEFT JOIN users p ON u.parent_id = p.id
    WHERE 1=1 AND (
      u.distrito = ? OR 
      EXISTS (SELECT 1 FROM lists l2 WHERE l2.id = u.assigned_list_id AND l2.ciudad = ?) OR 
      EXISTS (SELECT 1 FROM campaigns c2 WHERE c2.id = u.assigned_campaign_id AND c2.distrito = ?)
    )
    LIMIT 1500
  `;
  return db.prepare(sql).all(d, d, d);
});

// 2. Conflicts query
measure('Conflicts Query', () => {
  let sql = `
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
      cb.id as capture_b_id,
      cb.traffic_light as tl_b
    FROM capture_conflicts cc
    LEFT JOIN electors e ON cc.elector_ci = e.ci
    LEFT JOIN elector_captures ca ON cc.capture_id = ca.id
    LEFT JOIN elector_captures cb ON cc.capture_id_b = cb.id
    LEFT JOIN users ua ON ca.coordinator_id = ua.id
    LEFT JOIN users ub ON cb.coordinator_id = ub.id
    WHERE cc.status != 'RESOLVED'
      AND (e.ciudad = ? OR e.distrito = ?)
  `;
  return db.prepare(sql).all(d, d);
});

// 3. Captures query
measure('Captures Query', () => {
  let sql = `
    SELECT 
      ec.*, 
      COALESCE(e.nombre, 'ELECTOR') as nombre, 
      COALESCE(e.apellido, 'NO REGISTRADO') as apellido, 
      COALESCE(e.local_votacion, 'REGISTRO DE CAMPO') as local_votacion, 
      COALESCE(e.mesa, 0) as mesa, 
      COALESCE(e.orden, 0) as orden, 
      u.nombre as coordinator_name, u.role as coordinator_role, 
      p.nombre as padrino_name,
      l.list_number, l.campaign_id, c.name as campaign_name
    FROM elector_captures ec
    LEFT JOIN electors e ON ec.elector_ci = e.ci
    JOIN users u ON ec.coordinator_id = u.id
    LEFT JOIN users p ON u.parent_id = p.id
    LEFT JOIN lists l ON ec.list_id = l.id
    LEFT JOIN campaigns c ON l.campaign_id = c.id
    WHERE 1=1 AND (e.ciudad = ? OR e.distrito = ?)
    ORDER BY ec.timestamp DESC LIMIT 1000
  `;
  return db.prepare(sql).all(d, d);
});

// 4. Structure Padrinos query
measure('Padrinos Query', () => {
  let sql = `
    SELECT u.id, u.nombre, u.photo_url, u.telefono, u.assigned_list_id,
           l.list_number, l.option_number,
           COALESCE(ch.coordinator_count, 0) AS coordinator_count,
           COALESCE(d.total, 0) + COALESCE(ci.total, 0) AS total_electors,
           COALESCE(d.transport, 0) + COALESCE(ci.transport, 0) AS transport_total
    FROM users u
    LEFT JOIN lists l ON u.assigned_list_id = l.id
    LEFT JOIN (
      SELECT parent_id, COUNT(*) AS coordinator_count
      FROM users
      WHERE role IN ('COORDINADOR', 'MIEMBRO_DE_MESA')
      GROUP BY parent_id
    ) ch ON ch.parent_id = u.id
    LEFT JOIN (
      SELECT coordinator_id,
        COUNT(*) AS total,
        SUM(needs_transport) AS transport
      FROM elector_captures
      GROUP BY coordinator_id
    ) d ON d.coordinator_id = u.id
    LEFT JOIN (
      SELECT uc.parent_id,
        COUNT(ec.id) AS total,
        SUM(ec.needs_transport) AS transport
      FROM users uc
      LEFT JOIN elector_captures ec ON ec.coordinator_id = uc.id
      WHERE uc.role IN ('COORDINADOR', 'MIEMBRO_DE_MESA')
      GROUP BY uc.parent_id
    ) ci ON ci.parent_id = u.id
    WHERE u.role IN ('PADRINO', 'SUBJEFE') AND (
      u.distrito = ? OR 
      EXISTS (SELECT 1 FROM lists l2 WHERE l2.id = u.assigned_list_id AND l2.ciudad = ?) OR 
      EXISTS (SELECT 1 FROM campaigns c2 WHERE c2.id = u.assigned_campaign_id AND c2.distrito = ?)
    )
    ORDER BY u.nombre
  `;
  return db.prepare(sql).all(d, d, d);
});

// 5. Audit Activity query
measure('Audit Activity Query', () => {
  let sql = `
    SELECT al.*, u.nombre as user_name, u.photo_url as user_photo
    FROM audit_logs al
    LEFT JOIN users u ON al.user_id = u.id
    WHERE 1=1 AND (
      u.distrito = ? OR 
      EXISTS (SELECT 1 FROM lists l2 WHERE l2.id = u.assigned_list_id AND l2.ciudad = ?) OR 
      EXISTS (SELECT 1 FROM campaigns c2 WHERE c2.id = u.assigned_campaign_id AND c2.distrito = ?)
    )
    ORDER BY al.timestamp DESC LIMIT 50
  `;
  return db.prepare(sql).all(d, d, d);
});

// 6. Stats Command - Captures Status Group
measure('Stats Command - Captures Status Group', () => {
  let sql = `
    SELECT traffic_light, COUNT(*) as count
    FROM elector_captures ec
    LEFT JOIN electors e ON ec.elector_ci = e.ci
    LEFT JOIN users u ON ec.coordinator_id = u.id
    LEFT JOIN lists l ON ec.list_id = l.id
    LEFT JOIN campaigns c ON l.campaign_id = c.id
    WHERE ec.is_disputed = 0 AND (e.ciudad = ? OR e.distrito = ?)
    GROUP BY traffic_light
  `;
  return db.prepare(sql).all(d, d);
});

// 7. Stats Command - Total Electors
measure('Stats Command - Total Electors', () => {
  let sql = `
    SELECT COUNT(*) as count FROM electors e
    WHERE 1=1 AND (e.ciudad = ? OR e.distrito = ?)
  `;
  return db.prepare(sql).get(d, d);
});

// 8. Stats Command - Electors Group By Local
measure('Stats Command - Electors Group By Local', () => {
  let sql = `
    SELECT local_votacion, COUNT(*) as total
    FROM electors e WHERE 1=1 AND (e.ciudad = ? OR e.distrito = ?)
    GROUP BY local_votacion
  `;
  return db.prepare(sql).all(d, d);
});

// 9. Stats Command - Live Captures Group By Local
measure('Stats Command - Live Captures Group By Local', () => {
  let sql = `
    SELECT COALESCE(e.local_votacion, 'REGISTRO DE CAMPO') as local_votacion,
      COUNT(ec.id) as total,
      SUM(CASE WHEN ec.traffic_light = 'GREEN' THEN 1 ELSE 0 END) as green
    FROM elector_captures ec
    LEFT JOIN electors e ON ec.elector_ci = e.ci
    LEFT JOIN users u ON ec.coordinator_id = u.id
    LEFT JOIN lists l ON ec.list_id = l.id
    LEFT JOIN campaigns c ON l.campaign_id = c.id
    WHERE ec.is_disputed = 0 AND (e.ciudad = ? OR e.distrito = ?)
    GROUP BY COALESCE(e.local_votacion, 'REGISTRO DE CAMPO')
  `;
  return db.prepare(sql).all(d, d);
});

