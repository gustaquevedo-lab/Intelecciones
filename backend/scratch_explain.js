const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, 'intellecciones.db');
const db = new Database(dbPath);

console.log("Analyzing database:", dbPath);

// Row counts
const tables = ['campaigns', 'lists', 'users', 'voting_locations', 'electors', 'participation_logs', 'audit_logs', 'elector_captures', 'capture_conflicts'];
console.log("\n--- ROW COUNTS ---");
for (const table of tables) {
  try {
    const row = db.prepare(`SELECT COUNT(*) as count FROM ${table}`).get();
    console.log(`${table}: ${row.count}`);
  } catch (e) {
    console.log(`${table}: Error - ${e.message}`);
  }
}

// Explain query plans
function explain(title, query, params = []) {
  console.log(`\n--- EXPLAIN QUERY PLAN: ${title} ---`);
  try {
    const explanation = db.prepare(`EXPLAIN QUERY PLAN ${query}`).all(...params);
    explanation.forEach(row => {
      console.log(`${row.id} | parent: ${row.parent} | notused: ${row.notused} | detail: ${row.detail}`);
    });
  } catch (e) {
    console.log(`Error: ${e.message}`);
  }
}

// Query 1: Padrinos report
const filterSql = ""; // assuming empty for now
const filterParams = [];
const padrinoSql = `
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
   WHERE u.role IN ('PADRINO', 'SUBJEFE')
   ORDER BY u.nombre
`;
explain("Padrinos Report", padrinoSql);

// Query 2: Coordinators report
const coordSql = `
  SELECT u.id, u.nombre, u.username, u.ci, u.telefono, u.photo_url, u.status, u.distrito,
         u.parent_id, p.nombre as parent_name, p.ci as parent_ci,
         u.assigned_list_id, l.list_number,
         COUNT(ec.id) AS total_captures,
         SUM(CASE WHEN ec.traffic_light = 'GREEN' THEN 1 ELSE 0 END) AS green,
         SUM(CASE WHEN ec.traffic_light = 'YELLOW' THEN 1 ELSE 0 END) AS yellow,
         SUM(CASE WHEN ec.traffic_light = 'RED' THEN 1 ELSE 0 END) AS red,
         SUM(CASE WHEN ec.traffic_light = 'PURPLE' THEN 1 ELSE 0 END) AS purple,
         SUM(CASE WHEN ec.needs_transport = 1 THEN 1 ELSE 0 END) AS needs_transport
  FROM users u
  LEFT JOIN users p ON u.parent_id = p.id
  LEFT JOIN lists l ON u.assigned_list_id = l.id
  LEFT JOIN elector_captures ec ON ec.coordinator_id = u.id
  WHERE u.role IN ('COORDINADOR', 'MIEMBRO_DE_MESA')
  GROUP BY u.id ORDER BY u.nombre
`;
explain("Coordinators Report", coordSql);

// Query 3: Electors report
const electorSql = `
  SELECT ec.id as capture_id, ec.elector_ci, ec.telefono as elector_telefono,
         ec.traffic_light, ec.needs_transport, ec.timestamp,
         COALESCE(e.nombre, 'ELECTOR') as nombre,
         COALESCE(e.apellido, 'NO REGISTRADO') as apellido,
         COALESCE(e.local_votacion, 'REGISTRO DE CAMPO') as local_votacion,
         COALESCE(e.mesa, 0) as mesa,
         COALESCE(e.orden, 0) as orden,
         COALESCE(e.distrito, 'REGISTRO DE CAMPO') as elector_district,
         u.nombre as coordinator_name, u.role as coordinator_role, u.photo_url as coordinator_photo,
         u.distrito as coordinator_district, u.assigned_list_id as coordinator_list_id,
         u.parent_id as padrino_id, ec.coordinator_id,
         p.nombre as padrino_name,
         l.list_number, c.name as campaign_name
  FROM elector_captures ec
  LEFT JOIN electors e ON ec.elector_ci = e.ci
  LEFT JOIN users u ON ec.coordinator_id = u.id
  LEFT JOIN users p ON u.parent_id = p.id
  LEFT JOIN lists l ON ec.list_id = l.id
  LEFT JOIN campaigns c ON l.campaign_id = c.id
  WHERE 1=1
  ORDER BY ec.timestamp DESC LIMIT 3000
`;
explain("Electors Report", electorSql);

// Query 4: Locales report
const localesSql = `
  SELECT COALESCE(e.local_votacion, 'REGISTRO DE CAMPO') as local_votacion,
         COALESCE(e.distrito, 'REGISTRO DE CAMPO') as distrito,
         COUNT(ec.id) as total_captures,
         SUM(CASE WHEN ec.traffic_light = 'GREEN' THEN 1 ELSE 0 END) as green,
         SUM(CASE WHEN ec.traffic_light = 'YELLOW' THEN 1 ELSE 0 END) as yellow,
         SUM(CASE WHEN ec.traffic_light = 'RED' THEN 1 ELSE 0 END) as red,
         SUM(CASE WHEN ec.traffic_light = 'PURPLE' THEN 1 ELSE 0 END) as purple,
         SUM(CASE WHEN ec.needs_transport = 1 THEN 1 ELSE 0 END) as needs_transport
  FROM elector_captures ec
  LEFT JOIN electors e ON ec.elector_ci = e.ci
  LEFT JOIN users u ON ec.coordinator_id = u.id
  LEFT JOIN lists l ON ec.list_id = l.id
  WHERE 1=1
  GROUP BY COALESCE(e.local_votacion, 'REGISTRO DE CAMPO'), COALESCE(e.distrito, 'REGISTRO DE CAMPO') ORDER BY total_captures DESC
`;
explain("Locales Report", localesSql);
