const Database = require('better-sqlite3');
const path = require('path');
const db = new Database(path.join(__dirname, '../intellecciones.db'));

console.log("=== BENCHMARKING MY TEAM QUERIES ===");

const district = 'PEDRO JUAN CABALLERO';
const requesterId = '8'; // Mock Padrino ID

// Mock getSecurityFilter SQL for table u
const sec_u = {
  sql: ` AND (
    u.distrito = ? OR 
    EXISTS (SELECT 1 FROM lists l2 WHERE l2.id = u.assigned_list_id AND l2.ciudad = ?) OR 
    EXISTS (SELECT 1 FROM campaigns c2 WHERE c2.id = u.assigned_campaign_id AND c2.distrito = ?)
  )`,
  params: [district, district, district]
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

// 1. my-team query for Padrino / Subjefe
const padrinoMyTeam = `
  WITH coordinator_ids AS (
    SELECT id FROM users WHERE parent_id = ? AND role IN ('COORDINADOR', 'MIEMBRO_DE_MESA')
  ),
  stats AS (
    SELECT 
      coordinator_id,
      COUNT(*) as total_captures,
      SUM(CASE WHEN traffic_light='GREEN' THEN 1 ELSE 0 END) as green,
      SUM(CASE WHEN traffic_light='YELLOW' THEN 1 ELSE 0 END) as yellow,
      SUM(CASE WHEN traffic_light='RED' THEN 1 ELSE 0 END) as red,
      SUM(CASE WHEN needs_transport=1 THEN 1 ELSE 0 END) as transport_total
    FROM elector_captures
    WHERE coordinator_id IN (SELECT id FROM coordinator_ids)
    GROUP BY coordinator_id
  )
  SELECT u.id, u.nombre, u.username, u.ci, u.telefono, u.photo_url, u.status,
         u.distrito, u.parent_id, l.list_number,
         COALESCE(s.total_captures, 0) as total_captures,
         COALESCE(s.green, 0) as green,
         COALESCE(s.yellow, 0) as yellow,
         COALESCE(s.red, 0) as red,
         COALESCE(s.transport_total, 0) as transport_total
  FROM users u
  LEFT JOIN lists l ON u.assigned_list_id = l.id
  LEFT JOIN stats s ON u.id = s.coordinator_id
  WHERE u.parent_id = ? AND u.role IN ('COORDINADOR','MIEMBRO_DE_MESA')
  ORDER BY u.nombre
`;
runTest("1. My Team Padrino Query", padrinoMyTeam, [requesterId, requesterId]);

// 2. my-team query for Jefe de Campaña / Admin (using sec_u filter)
const adminMyTeam = `
  SELECT u.id, u.nombre, u.username, u.ci, u.telefono, u.photo_url, u.status,
         u.assigned_list_id, l.list_number, l.candidate_alias,
         (SELECT COUNT(*) FROM users u2 WHERE u2.parent_id = u.id AND u2.role IN ('COORDINADOR', 'MIEMBRO_DE_MESA')) AS coordinator_count,
         ((SELECT COUNT(*) FROM elector_captures ec WHERE ec.coordinator_id = u.id) + 
          (SELECT COUNT(*) FROM elector_captures ec WHERE ec.coordinator_id IN (SELECT id FROM users WHERE parent_id = u.id))) AS total_captures,
         ((SELECT COUNT(*) FROM elector_captures ec WHERE ec.coordinator_id = u.id AND ec.needs_transport = 1) + 
          (SELECT COUNT(*) FROM elector_captures ec WHERE ec.coordinator_id IN (SELECT id FROM users WHERE parent_id = u.id) AND ec.needs_transport = 1)) AS needs_transport
   FROM users u
   LEFT JOIN lists l ON u.assigned_list_id = l.id
   WHERE u.role IN ('PADRINO', 'SUBJEFE') ${sec_u.sql}
   ORDER BY u.nombre
`;
runTest("2. My Team Admin Query", adminMyTeam, sec_u.params);
