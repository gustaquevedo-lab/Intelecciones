const Database = require('better-sqlite3');
const path = require('path');
const db = new Database(path.join(__dirname, 'intellecciones.db'));

// Let's mimic a JEFE_CAMPANA from CONCEPCION
const d = 'CONCEPCION';
const filterSql = ` AND (
  u.distrito = ? OR 
  EXISTS (SELECT 1 FROM lists l2 WHERE l2.id = u.assigned_list_id AND l2.ciudad = ?) OR 
  EXISTS (SELECT 1 FROM campaigns c2 WHERE c2.id = u.assigned_campaign_id AND c2.distrito = ?)
)`;
const filterParams = [d, d, d];

const padrinoSql = `
  SELECT u.id, u.nombre, u.username, u.ci, u.telefono, u.photo_url, u.status, u.distrito,
         u.assigned_list_id, l.list_number, l.candidate_alias,
         (SELECT COUNT(*) FROM users u2 WHERE u2.parent_id = u.id AND u2.role IN ('COORDINADOR', 'MIEMBRO_DE_MESA')) AS coordinator_count,
         
         ((SELECT COUNT(*) FROM elector_captures ec WHERE ec.coordinator_id = u.id) + 
          (SELECT COUNT(*) FROM elector_captures ec WHERE ec.coordinator_id IN (SELECT id FROM users WHERE parent_id = u.id))) AS total_captures,
         
         ((SELECT COUNT(*) FROM elector_captures ec WHERE ec.coordinator_id = u.id AND ec.needs_transport = 1) + 
          (SELECT COUNT(*) FROM elector_captures ec WHERE ec.coordinator_id IN (SELECT id FROM users WHERE parent_id = u.id) AND ec.needs_transport = 1)) AS needs_transport,
         
         ((SELECT COUNT(*) FROM elector_captures ec WHERE ec.coordinator_id = u.id AND ec.traffic_light = 'GREEN') + 
          (SELECT COUNT(*) FROM elector_captures ec WHERE ec.coordinator_id IN (SELECT id FROM users WHERE parent_id = u.id) AND ec.traffic_light = 'GREEN')) AS green,
         
         ((SELECT COUNT(*) FROM elector_captures ec WHERE ec.coordinator_id = u.id AND ec.traffic_light = 'YELLOW') + 
          (SELECT COUNT(*) FROM elector_captures ec WHERE ec.coordinator_id IN (SELECT id FROM users WHERE parent_id = u.id) AND ec.traffic_light = 'YELLOW')) AS yellow,
         
         ((SELECT COUNT(*) FROM elector_captures ec WHERE ec.coordinator_id = u.id AND ec.traffic_light = 'RED') + 
          (SELECT COUNT(*) FROM elector_captures ec WHERE ec.coordinator_id IN (SELECT id FROM users WHERE parent_id = u.id) AND ec.traffic_light = 'RED')) AS red,
         
         ((SELECT COUNT(*) FROM elector_captures ec WHERE ec.coordinator_id = u.id AND ec.traffic_light = 'PURPLE') + 
          (SELECT COUNT(*) FROM elector_captures ec WHERE ec.coordinator_id IN (SELECT id FROM users WHERE parent_id = u.id) AND ec.traffic_light = 'PURPLE')) AS purple
   FROM users u
   LEFT JOIN lists l ON u.assigned_list_id = l.id
   WHERE u.role IN ('PADRINO', 'SUBJEFE') ${filterSql}
   ORDER BY u.nombre
`;

console.log("Explaining Padrinos Query...");
const plan = db.prepare(`EXPLAIN QUERY PLAN ${padrinoSql}`).all(...filterParams);
console.log(JSON.stringify(plan, null, 2));

console.log("Running Padrinos Query...");
const start = performance.now();
const rows = db.prepare(padrinoSql).all(...filterParams);
const end = performance.now();
console.log(`Padrinos Query took ${(end - start).toFixed(2)}ms, returned ${rows.length} rows`);
