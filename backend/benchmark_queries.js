const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, 'intellecciones.db');
const db = new Database(dbPath);

console.log("Database initialized. Starting benchmarks...");

const district = 'PEDRO JUAN CABALLERO';
const list_number = '9';

// Benchmark helper
function runBenchmark(name, query, params) {
  const start = performance.now();
  try {
    const stmt = db.prepare(query);
    const rows = stmt.all(...params);
    const end = performance.now();
    console.log(`[${name}] OK in ${(end - start).toFixed(2)}ms (${rows.length} rows returned)`);
  } catch (e) {
    console.error(`[${name}] ERROR:`, e.message);
  }
}

// 1. Padrinos Report
const padrinoSql = `
  SELECT u.id, u.nombre, u.username, u.ci, u.telefono, u.photo_url, u.status, u.distrito,
         u.assigned_list_id, l.list_number, l.candidate_alias,
         (SELECT COUNT(*) FROM users u2 WHERE u2.parent_id = u.id AND u2.role IN ('COORDINADOR', 'MIEMBRO_DE_MESA')) AS coordinator_count,
         (SELECT COUNT(*) FROM elector_captures ec WHERE ec.coordinator_id = u.id OR ec.coordinator_id IN (SELECT id FROM users WHERE parent_id = u.id)) AS total_captures,
         (SELECT COUNT(*) FROM elector_captures ec WHERE (ec.coordinator_id = u.id OR ec.coordinator_id IN (SELECT id FROM users WHERE parent_id = u.id)) AND ec.needs_transport = 1) AS needs_transport,
         (SELECT COUNT(*) FROM elector_captures ec WHERE (ec.coordinator_id = u.id OR ec.coordinator_id IN (SELECT id FROM users WHERE parent_id = u.id)) AND ec.traffic_light = 'GREEN') AS green,
         (SELECT COUNT(*) FROM elector_captures ec WHERE (ec.coordinator_id = u.id OR ec.coordinator_id IN (SELECT id FROM users WHERE parent_id = u.id)) AND ec.traffic_light = 'YELLOW') AS yellow,
         (SELECT COUNT(*) FROM elector_captures ec WHERE (ec.coordinator_id = u.id OR ec.coordinator_id IN (SELECT id FROM users WHERE parent_id = u.id)) AND ec.traffic_light = 'RED') AS red,
         (SELECT COUNT(*) FROM elector_captures ec WHERE (ec.coordinator_id = u.id OR ec.coordinator_id IN (SELECT id FROM users WHERE parent_id = u.id)) AND ec.traffic_light = 'PURPLE') AS purple
   FROM users u
   LEFT JOIN lists l ON u.assigned_list_id = l.id
   WHERE u.role IN ('PADRINO', 'SUBJEFE') AND u.distrito = ?
   ORDER BY u.nombre
`;

runBenchmark("1. Padrinos Report with District", padrinoSql, [district]);

// 2. Coordinators Report
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
  WHERE u.role IN ('COORDINADOR', 'MIEMBRO_DE_MESA') AND u.distrito = ?
  GROUP BY u.id
  ORDER BY u.nombre
`;

runBenchmark("2. Coordinators Report with District", coordSql, [district]);

// 3. Electors Report with District Filter
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
  WHERE 1=1 AND (e.distrito = ? OR u.distrito = ?)
  ORDER BY ec.timestamp DESC LIMIT 3000
`;

runBenchmark("3. Electors Report with District", electorSql, [district, district]);

// 4. Locales Report with District Filter
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
  WHERE 1=1 AND e.distrito = ?
  GROUP BY COALESCE(e.local_votacion, 'REGISTRO DE CAMPO'), COALESCE(e.distrito, 'REGISTRO DE CAMPO')
`;

runBenchmark("4. Locales Report with District", localesSql, [district]);
