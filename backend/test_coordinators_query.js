const Database = require('better-sqlite3');
const path = require('path');
const db = new Database(path.join(__dirname, 'intellecciones.db'));

console.log("=== TESTING OPTIMIZED COORDINATORS QUERY ===");

try {
  const district = 'CONCEPCION';
  const filterSql = "AND (u.distrito = ? OR EXISTS (SELECT 1 FROM lists l2 WHERE l2.id = u.assigned_list_id AND l2.ciudad = ?) OR EXISTS (SELECT 1 FROM campaigns c2 WHERE c2.id = u.assigned_campaign_id AND c2.distrito = ?))";
  const filterParams = [district, district, district];

  const query = `
    SELECT u.id, u.nombre, u.username, u.ci, u.telefono, u.photo_url, u.status, u.distrito,
           u.parent_id,
           (SELECT COUNT(*) FROM elector_captures ec WHERE ec.coordinator_id = u.id) AS total_captures,
           (SELECT COUNT(*) FROM elector_captures ec WHERE ec.coordinator_id = u.id AND ec.traffic_light = 'GREEN') AS green,
           (SELECT COUNT(*) FROM elector_captures ec WHERE ec.coordinator_id = u.id AND ec.traffic_light = 'YELLOW') AS yellow,
           (SELECT COUNT(*) FROM elector_captures ec WHERE ec.coordinator_id = u.id AND ec.traffic_light = 'RED') AS red,
           (SELECT COUNT(*) FROM elector_captures ec WHERE ec.coordinator_id = u.id AND ec.traffic_light = 'PURPLE') AS purple,
           (SELECT COUNT(*) FROM elector_captures ec WHERE ec.coordinator_id = u.id AND ec.needs_transport = 1) AS needs_transport
    FROM users u
    WHERE u.role IN ('COORDINADOR', 'MIEMBRO_DE_MESA') ${filterSql}
    ORDER BY u.nombre
  `;

  const start = performance.now();
  const results = db.prepare(query).all(...filterParams);
  const end = performance.now();

  console.log(`Query ran successfully in ${(end - start).toFixed(2)}ms.`);
  console.log("Returned records count:", results.length);
  console.log("Sample records:", results);
} catch (e) {
  console.error("Coordinators query FAILED:", e.message);
}
