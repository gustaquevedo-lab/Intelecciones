const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, 'intellecciones.db');
const db = new Database(dbPath);

function explain(title, query, params = []) {
  console.log(`\n=== ${title} ===`);
  try {
    const explanation = db.prepare(`EXPLAIN QUERY PLAN ${query}`).all(...params);
    explanation.forEach(row => {
      console.log(`${row.id} | parent: ${row.parent} | detail: ${row.detail}`);
    });
  } catch (e) {
    console.log(`Error: ${e.message}`);
  }
}

// Let's test with a typical district filter: 'PEDRO JUAN CABALLERO'
// For Super/Jefe, tableAlias = 'u' (users) gets:
// AND (u.distrito = 'PJC' OR EXISTS (SELECT 1 FROM lists l2 WHERE l2.id = u.assigned_list_id AND l2.ciudad = 'PJC') OR EXISTS ...)
const district = 'PEDRO JUAN CABALLERO';
const listId = 1;

// Elector SQL with district filter
const electorSqlWithDistrict = `
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
    AND (
      u.distrito = ? OR 
      EXISTS (SELECT 1 FROM lists l2 WHERE l2.id = u.assigned_list_id AND l2.ciudad = ?) OR 
      EXISTS (SELECT 1 FROM campaigns c2 WHERE c2.id = u.assigned_campaign_id AND c2.distrito = ?)
    )
  ORDER BY ec.timestamp DESC LIMIT 3000
`;

explain("Electors Report with District Filter", electorSqlWithDistrict, [district, district, district]);

// Elector SQL with list filter (e.g. SUBJEFE list isolation)
const electorSqlWithList = `
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
    AND u.assigned_list_id = ?
  ORDER BY ec.timestamp DESC LIMIT 3000
`;

explain("Electors Report with List Filter", electorSqlWithList, [listId]);

// Let's also check the Locales Report with District filter
const localesSqlWithDistrict = `
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
    AND (
      u.distrito = ? OR 
      EXISTS (SELECT 1 FROM lists l2 WHERE l2.id = u.assigned_list_id AND l2.ciudad = ?) OR 
      EXISTS (SELECT 1 FROM campaigns c2 WHERE c2.id = u.assigned_campaign_id AND c2.distrito = ?)
    )
  GROUP BY COALESCE(e.local_votacion, 'REGISTRO DE CAMPO'), COALESCE(e.distrito, 'REGISTRO DE CAMPO') ORDER BY total_captures DESC
`;

explain("Locales Report with District Filter", localesSqlWithDistrict, [district, district, district]);
