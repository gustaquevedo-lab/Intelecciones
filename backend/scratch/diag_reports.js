const Database = require('better-sqlite3');
const path = require('path');
const dbPath = path.join(__dirname, '..', 'intellecciones.db');
const db = new Database(dbPath);

console.log("Database opened at", dbPath);

// Mocking getSecurityFilter for SUPERUSUARIO with no active district (GLOBAL)
// role === 'SUPERUSUARIO', user?.distrito is null, activeDistrict is null
const filterSql = "";
const filterParams = [];

try {
  // Query 1: Padrinos
  let padrinoSql = `
    SELECT u.id, u.nombre, u.username, u.ci, u.telefono, u.photo_url, u.status, u.distrito,
           u.assigned_list_id, l.list_number, l.candidate_alias,
           COUNT(DISTINCT u2.id) AS coordinator_count,
           COUNT(DISTINCT ec.id) AS total_captures,
           SUM(CASE WHEN ec.needs_transport = 1 THEN 1 ELSE 0 END) AS needs_transport,
           SUM(CASE WHEN ec.traffic_light = 'GREEN' THEN 1 ELSE 0 END) AS green,
           SUM(CASE WHEN ec.traffic_light = 'YELLOW' THEN 1 ELSE 0 END) AS yellow,
           SUM(CASE WHEN ec.traffic_light = 'RED' THEN 1 ELSE 0 END) AS red,
           SUM(CASE WHEN ec.traffic_light = 'PURPLE' THEN 1 ELSE 0 END) AS purple
     FROM users u
     LEFT JOIN lists l ON u.assigned_list_id = l.id
     LEFT JOIN users u2 ON u2.parent_id = u.id AND u2.role IN ('COORDINADOR', 'MIEMBRO_DE_MESA')
     LEFT JOIN elector_captures ec ON (ec.coordinator_id = u2.id OR ec.coordinator_id = u.id)
     WHERE u.role IN ('PADRINO', 'SUBJEFE') ${filterSql}
     GROUP BY u.id ORDER BY u.nombre
  `;
  const padrinos = db.prepare(padrinoSql).all(...filterParams);
  console.log("PADRINOS:", padrinos.length);
  if (padrinos.length > 0) {
    console.log("Sample Padrino:", padrinos[0]);
  }

  // Query 2: Coordinators
  let coordSql = `
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
    WHERE u.role IN ('COORDINADOR', 'MIEMBRO_DE_MESA') ${filterSql}
    GROUP BY u.id ORDER BY u.nombre
  `;
  const coordinators = db.prepare(coordSql).all(...filterParams);
  console.log("COORDINATORS:", coordinators.length);
  if (coordinators.length > 0) {
    console.log("Sample Coordinator:", coordinators[0]);
  }

  // Query 3: Electors
  let electorSql = `
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
    ORDER BY ec.timestamp DESC
  `;
  const electors = db.prepare(electorSql).all();
  console.log("ELECTORS:", electors.length);
  if (electors.length > 0) {
    console.log("Sample Elector:", electors[0]);
  }

  // Query 4: Locales
  let localesSql = `
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
    LEFT JOIN users p ON u.parent_id = p.id
    LEFT JOIN lists l ON ec.list_id = l.id
    WHERE 1=1
    GROUP BY COALESCE(e.local_votacion, 'REGISTRO DE CAMPO'), COALESCE(e.distrito, 'REGISTRO DE CAMPO')
    ORDER BY total_captures DESC
  `;
  const locales = db.prepare(localesSql).all();
  console.log("LOCALES:", locales.length);
  if (locales.length > 0) {
    console.log("Sample Local:", locales[0]);
  }

} catch (err) {
  console.error("SQL Error:", err.message);
}
