const Database = require('better-sqlite3');
const path = require('path');
const db = new Database(path.join(__dirname, 'intellecciones.db'));

const selectedDistrict = 'CONCEPCION';
const requesterId = '8'; // Padrino
const role = 'PADRINO';

// Let's test getSecurityFilter logic here
function getSecurityFilter(tableAlias = 'c') {
  let sql = '';
  let params = [];
  const d = 'CONCEPCION'; // user's district or selected
  if (tableAlias === 'u') {
    sql += ` AND (
      u.distrito = ? OR 
      EXISTS (SELECT 1 FROM lists l2 WHERE l2.id = u.assigned_list_id AND l2.ciudad = ?) OR 
      EXISTS (SELECT 1 FROM campaigns c2 WHERE c2.id = u.assigned_campaign_id AND c2.distrito = ?)
    )`;
    params.push(d, d, d);
  }
  return { sql, params };
}

const baseSelect = `
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
`;

let q1_ids = `
  SELECT ec.id, ec.timestamp
  FROM electors e INDEXED BY idx_electors_distrito
  INNER JOIN elector_captures ec ON ec.elector_ci = e.ci
  LEFT JOIN users u ON ec.coordinator_id = u.id
  LEFT JOIN lists l ON ec.list_id = l.id
  WHERE e.distrito = ?
`;

let q2_ids = `
  SELECT ec.id, ec.timestamp
  FROM users u INDEXED BY idx_users_distrito
  INNER JOIN elector_captures ec ON ec.coordinator_id = u.id
  LEFT JOIN electors e ON ec.elector_ci = e.ci
  LEFT JOIN lists l ON ec.list_id = l.id
  WHERE u.distrito = ?
`;

let extraFilters = "";
let extraParams = [];

// For role = 'JEFE_CAMPANA'
const filterE = getSecurityFilter('u');
extraFilters += ` ${filterE.sql}`;
extraParams.push(...filterE.params);

q1_ids += extraFilters;
q2_ids += extraFilters;

const unionSql = `
  ${baseSelect}
  FROM (
    SELECT id FROM (
      ${q1_ids}
      UNION
      ${q2_ids}
    ) ORDER BY timestamp DESC LIMIT 3000
  ) as subset
  INNER JOIN elector_captures ec ON subset.id = ec.id
  LEFT JOIN electors e ON ec.elector_ci = e.ci
  LEFT JOIN users u ON ec.coordinator_id = u.id
  LEFT JOIN users p ON u.parent_id = p.id
  LEFT JOIN lists l ON ec.list_id = l.id
  LEFT JOIN campaigns c ON l.campaign_id = c.id
  ORDER BY ec.timestamp DESC
`;

console.log("Q1 Query Plan:");
try {
  const plan = db.prepare(`EXPLAIN QUERY PLAN ${q1_ids}`).all(selectedDistrict, ...extraParams);
  console.log(plan);
} catch (e) {
  console.error("Q1 Plan Error:", e.message);
}

console.log("Q2 Query Plan:");
try {
  const plan = db.prepare(`EXPLAIN QUERY PLAN ${q2_ids}`).all(selectedDistrict, ...extraParams);
  console.log(plan);
} catch (e) {
  console.error("Q2 Plan Error:", e.message);
}

console.log("Union SQL Plan:");
try {
  const params = [selectedDistrict, ...extraParams, selectedDistrict, ...extraParams];
  const plan = db.prepare(`EXPLAIN QUERY PLAN ${unionSql}`).all(...params);
  console.log(plan);

  console.log("Executing union query...");
  const start = performance.now();
  const rows = db.prepare(unionSql).all(...params);
  const end = performance.now();
  console.log(`Execution took ${(end - start).toFixed(2)}ms, returned ${rows.length} rows`);
} catch (e) {
  console.error("Union SQL Error:", e.message);
}
