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
    SELECT u.id, u.nombre, u.username, u.ci, u.telefono, u.photo_url, u.status,
           u.assigned_list_id, l.list_number, l.candidate_alias,
           (SELECT COUNT(*) FROM users u2 WHERE u2.parent_id = u.id AND u2.role IN ('COORDINADOR', 'MIEMBRO_DE_MESA')) AS coordinator_count,
           ((SELECT COUNT(*) FROM elector_captures ec WHERE ec.coordinator_id = u.id) + 
            (SELECT COUNT(*) FROM elector_captures ec WHERE ec.coordinator_id IN (SELECT id FROM users WHERE parent_id = u.id))) AS total_captures,
           ((SELECT COUNT(*) FROM elector_captures ec WHERE ec.coordinator_id = u.id AND ec.needs_transport = 1) + 
            (SELECT COUNT(*) FROM elector_captures ec WHERE ec.coordinator_id IN (SELECT id FROM users WHERE parent_id = u.id) AND ec.needs_transport = 1)) AS needs_transport
     FROM users u
     LEFT JOIN lists l ON u.assigned_list_id = l.id
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
