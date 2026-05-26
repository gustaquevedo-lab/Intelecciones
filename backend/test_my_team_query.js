const Database = require('better-sqlite3');
const path = require('path');
const db = new Database(path.join(__dirname, 'intellecciones.db'));

console.log("=== TESTING OPTIMIZED MY-TEAM QUERY ===");

try {
  // Simulate security filter for CONCEPCION
  const district = 'CONCEPCION';
  const filterSql = "AND (u.distrito = ? OR EXISTS (SELECT 1 FROM lists l2 WHERE l2.id = u.assigned_list_id AND l2.ciudad = ?) OR EXISTS (SELECT 1 FROM campaigns c2 WHERE c2.id = u.assigned_campaign_id AND c2.distrito = ?))";
  const filterParams = [district, district, district];

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
             SUM(CASE WHEN ec.needs_transport = 1 THEN 1 ELSE 0 END) as needs_transport
      FROM team_map tm
      INNER JOIN elector_captures ec ON ec.coordinator_id = tm.member_id
      GROUP BY tm.padrino_id
    )
    SELECT u.id, u.nombre, u.username, u.ci, u.telefono, u.photo_url, u.status,
           u.assigned_list_id, l.list_number, l.candidate_alias,
           (SELECT COUNT(*) FROM users u2 WHERE u2.parent_id = u.id AND u2.role IN ('COORDINADOR', 'MIEMBRO_DE_MESA')) AS coordinator_count,
           COALESCE(ps.total_captures, 0) AS total_captures,
           COALESCE(ps.needs_transport, 0) AS needs_transport
     FROM users u
     LEFT JOIN lists l ON u.assigned_list_id = l.id
     LEFT JOIN padrino_stats ps ON ps.padrino_id = u.id
     WHERE u.role IN ('PADRINO', 'SUBJEFE') ${filterSql}
     ORDER BY u.nombre
  `;

  const start = performance.now();
  const results = db.prepare(query).all(...filterParams);
  const end = performance.now();

  console.log(`Query ran successfully in ${(end - start).toFixed(2)}ms.`);
  console.log("Returned records count:", results.length);
  console.log("Sample records:", results);
} catch (e) {
  console.error("My-team query FAILED:", e.message);
}
