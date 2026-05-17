const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, '..', 'intellecciones.db');
const db = new Database(dbPath);

console.log('--- USER DETAILS (Subjefe) ---');
const user = db.prepare("SELECT * FROM users WHERE username = '3512586'").get();
console.log(JSON.stringify(user, null, 2));

console.log('\n--- SECURITY FILTER PARAMS ---');
// Mocking getSecurityFilter logic for SUBJEFE
const role = 'SUBJEFE';
const d = user.distrito; // 'CONCEPCION'
const listId = user.assigned_list_id; // 1

// Build security filter for table 'u' (users)
const accentFold = (col) => `REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(UPPER(${col}),'Á','A'),'É','E'),'Í','I'),'Ó','O'),'Ú','U'),'á','A'),'é','E'),'í','I'),'ó','O'),'ú','U')`;

let sql = '';
let params = [];

sql += ` AND (
  ${accentFold('u.distrito')} = ? OR 
  EXISTS (SELECT 1 FROM lists l2 WHERE l2.id = u.assigned_list_id AND ${accentFold('l2.ciudad')} = ?) OR 
  EXISTS (SELECT 1 FROM campaigns c2 WHERE c2.id = u.assigned_campaign_id AND ${accentFold('c2.distrito')} = ?)
)`;
params.push(d, d, d);

sql += ` AND u.assigned_list_id = ?`;
params.push(listId);

console.log('SQL:', sql);
console.log('Params:', params);

console.log('\n--- PADRINOS TREE QUERY ---');
const padrinos = db.prepare(`
  SELECT u.id, u.nombre, u.username, u.ci, u.telefono, u.photo_url, u.status,
         u.assigned_list_id, l.list_number, l.candidate_alias,
         COUNT(DISTINCT u2.id) AS coordinator_count,
         COUNT(DISTINCT ec.id) AS total_captures,
         SUM(CASE WHEN ec.needs_transport=1 THEN 1 ELSE 0 END) AS needs_transport
  FROM users u
  LEFT JOIN lists l ON u.assigned_list_id = l.id
  LEFT JOIN users u2 ON u2.parent_id = u.id AND u2.role IN ('COORDINADOR', 'MIEMBRO_DE_MESA')
  LEFT JOIN elector_captures ec ON (ec.coordinator_id = u2.id OR ec.coordinator_id = u.id)
  WHERE u.role IN ('PADRINO', 'SUBJEFE') ${sql}
  GROUP BY u.id ORDER BY u.nombre
`).all(...params);

console.log(JSON.stringify(padrinos, null, 2));

console.log('\n--- DIRECT COORDINATORS QUERY ---');
const coordinators = db.prepare(`
  SELECT u.id, u.nombre, u.username, u.ci, u.telefono, u.photo_url, u.status,
         COUNT(ec.id) AS total_captures,
         SUM(CASE WHEN ec.traffic_light='GREEN'  THEN 1 ELSE 0 END) AS green,
         SUM(CASE WHEN ec.traffic_light='YELLOW' THEN 1 ELSE 0 END) AS yellow,
         SUM(CASE WHEN ec.traffic_light='RED'    THEN 1 ELSE 0 END) AS red,
         SUM(CASE WHEN ec.needs_transport=1      THEN 1 ELSE 0 END) AS transport_total
  FROM users u
  LEFT JOIN elector_captures ec ON ec.coordinator_id = u.id
  WHERE u.parent_id = ? AND u.role IN ('COORDINADOR','MIEMBRO_DE_MESA')
  GROUP BY u.id ORDER BY u.nombre
`).all(user.id);

console.log(JSON.stringify(coordinators, null, 2));
