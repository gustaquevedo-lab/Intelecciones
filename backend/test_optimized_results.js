const Database = require('better-sqlite3');
const path = require('path');
const db = new Database(path.join(__dirname, 'intellecciones.db'));

// Mimic getSecurityFilter
function getSecurityFilter(d) {
  let sql = ` AND (
    u.distrito = ? OR 
    EXISTS (SELECT 1 FROM lists l2 WHERE l2.id = u.assigned_list_id AND l2.ciudad = ?) OR 
    EXISTS (SELECT 1 FROM campaigns c2 WHERE c2.id = u.assigned_campaign_id AND c2.distrito = ?)
  )`;
  return { sql, params: [d, d, d] };
}

const d = 'CONCEPCION';
const filter = getSecurityFilter(d);

const oldPadrinoSql = `
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
   WHERE u.role IN ('PADRINO', 'SUBJEFE') ${filter.sql}
   ORDER BY u.nombre
`;

const newPadrinoSql = `
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
  SELECT u.id, u.nombre, u.username, u.ci, u.telefono, u.photo_url, u.status, u.distrito,
         u.assigned_list_id, l.list_number, l.candidate_alias,
         (SELECT COUNT(*) FROM users u2 WHERE u2.parent_id = u.id AND u2.role IN ('COORDINADOR', 'MIEMBRO_DE_MESA')) AS coordinator_count,
         COALESCE(ps.total_captures, 0) AS total_captures,
         COALESCE(ps.needs_transport, 0) AS needs_transport,
         COALESCE(ps.green, 0) AS green,
         COALESCE(ps.yellow, 0) AS yellow,
         COALESCE(ps.red, 0) AS red,
         COALESCE(ps.purple, 0) AS purple
   FROM users u
   LEFT JOIN lists l ON u.assigned_list_id = l.id
   LEFT JOIN padrino_stats ps ON ps.padrino_id = u.id
   WHERE u.role IN ('PADRINO', 'SUBJEFE') ${filter.sql}
   ORDER BY u.nombre
`;

console.log("Fetching old padrino results...");
const oldPadrinos = db.prepare(oldPadrinoSql).all(...filter.params);

console.log("Fetching new padrino results...");
const newPadrinos = db.prepare(newPadrinoSql).all(...filter.params);

console.log("Comparing lengths:", oldPadrinos.length, newPadrinos.length);
if (oldPadrinos.length !== newPadrinos.length) {
  console.error("Mismatch in row count!");
}

let allMatch = true;
for (let i = 0; i < oldPadrinos.length; i++) {
  const o = oldPadrinos[i];
  const n = newPadrinos[i];
  
  const keys = ['id', 'nombre', 'coordinator_count', 'total_captures', 'needs_transport', 'green', 'yellow', 'red', 'purple'];
  for (const k of keys) {
    if (o[k] !== n[k]) {
      console.error(`Mismatch at row ${i}, column ${k}: old=${o[k]}, new=${n[k]}`);
      allMatch = false;
    }
  }
}

if (allMatch) {
  console.log("SUCCESS: Padrinos results match exactly!");
} else {
  console.error("FAILURE: Padrinos results mismatch!");
}

const oldCoordSql = `
  SELECT u.id, u.nombre, u.username, u.ci, u.telefono, u.photo_url, u.status, u.distrito,
         u.parent_id, p.nombre as parent_name, p.ci as parent_ci,
         u.assigned_list_id, l.list_number,
         (SELECT COUNT(*) FROM elector_captures WHERE coordinator_id = u.id) AS total_captures,
         (SELECT COUNT(*) FROM elector_captures WHERE coordinator_id = u.id AND traffic_light = 'GREEN') AS green,
         (SELECT COUNT(*) FROM elector_captures WHERE coordinator_id = u.id AND traffic_light = 'YELLOW') AS yellow,
         (SELECT COUNT(*) FROM elector_captures WHERE coordinator_id = u.id AND traffic_light = 'RED') AS red,
         (SELECT COUNT(*) FROM elector_captures WHERE coordinator_id = u.id AND traffic_light = 'PURPLE') AS purple,
         (SELECT COUNT(*) FROM elector_captures WHERE coordinator_id = u.id AND needs_transport = 1) AS needs_transport
  FROM users u
  LEFT JOIN users p ON u.parent_id = p.id
  LEFT JOIN lists l ON u.assigned_list_id = l.id
  WHERE u.role IN ('COORDINADOR', 'MIEMBRO_DE_MESA')
`;

const newCoordSql = `
  WITH coord_stats AS (
    SELECT coordinator_id,
           COUNT(id) AS total_captures,
           SUM(CASE WHEN traffic_light = 'GREEN' THEN 1 ELSE 0 END) AS green,
           SUM(CASE WHEN traffic_light = 'YELLOW' THEN 1 ELSE 0 END) AS yellow,
           SUM(CASE WHEN traffic_light = 'RED' THEN 1 ELSE 0 END) AS red,
           SUM(CASE WHEN traffic_light = 'PURPLE' THEN 1 ELSE 0 END) AS purple,
           SUM(CASE WHEN needs_transport = 1 THEN 1 ELSE 0 END) AS needs_transport
    FROM elector_captures
    GROUP BY coordinator_id
  )
  SELECT u.id, u.nombre, u.username, u.ci, u.telefono, u.photo_url, u.status, u.distrito,
         u.parent_id, p.nombre as parent_name, p.ci as parent_ci,
         u.assigned_list_id, l.list_number,
         COALESCE(cs.total_captures, 0) AS total_captures,
         COALESCE(cs.green, 0) AS green,
         COALESCE(cs.yellow, 0) AS yellow,
         COALESCE(cs.red, 0) AS red,
         COALESCE(cs.purple, 0) AS purple,
         COALESCE(cs.needs_transport, 0) AS needs_transport
  FROM users u
  LEFT JOIN users p ON u.parent_id = p.id
  LEFT JOIN lists l ON u.assigned_list_id = l.id
  LEFT JOIN coord_stats cs ON cs.coordinator_id = u.id
  WHERE u.role IN ('COORDINADOR', 'MIEMBRO_DE_MESA')
`;

const oldCoords = db.prepare(oldCoordSql).all();
const newCoords = db.prepare(newCoordSql).all();

console.log("Comparing Coords lengths:", oldCoords.length, newCoords.length);
let coordsMatch = true;
for (let i = 0; i < oldCoords.length; i++) {
  const o = oldCoords[i];
  const n = newCoords[i];
  const keys = ['id', 'nombre', 'total_captures', 'green', 'yellow', 'red', 'purple', 'needs_transport'];
  for (const k of keys) {
    if (o[k] !== n[k]) {
      console.error(`Mismatch at Coord row ${i}, column ${k}: old=${o[k]}, new=${n[k]}`);
      coordsMatch = false;
    }
  }
}

if (coordsMatch) {
  console.log("SUCCESS: Coords results match exactly!");
} else {
  console.error("FAILURE: Coords results mismatch!");
}
