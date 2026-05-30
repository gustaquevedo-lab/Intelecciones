const Database = require('better-sqlite3');
const path = require('path');
const db = new Database(path.join(__dirname, '../intellecciones.db'));

const district = 'PEDRO JUAN CABALLERO';

const sec_sql = ` AND (
  u.distrito = ? OR 
  EXISTS (SELECT 1 FROM lists l2 WHERE l2.id = u.assigned_list_id AND l2.ciudad = ?) OR 
  EXISTS (SELECT 1 FROM campaigns c2 WHERE c2.id = u.assigned_campaign_id AND c2.distrito = ?)
)`;
const params = [district, district, district];
const allParams = [...params, ...params, ...params];

try {
  const query = `
    SELECT 'CAPTURE' as type, ec.timestamp, u.nombre as user_name, COALESCE(e.nombre || ' ' || e.apellido, 'ELECTOR') as entity_name, 'Nueva Captura' as detail
    FROM users u 
    CROSS JOIN elector_captures ec ON ec.coordinator_id = u.id
    LEFT JOIN electors e ON ec.elector_ci = e.ci
    WHERE 1=1 ${sec_sql}
    
    UNION ALL
    
    SELECT 'REQUEST' as type, r.timestamp, u.nombre as user_name, r.type as entity_name, r.description as detail
    FROM users u 
    CROSS JOIN field_requests r ON r.coordinator_id = u.id
    WHERE 1=1 ${sec_sql}
    
    UNION ALL
    
    SELECT 'CONFLICT' as type, cc.timestamp, 'Sistema' as user_name, COALESCE(e.nombre || ' ' || e.apellido, 'ELECTOR') as entity_name, 'Doble Captura' as detail
    FROM users u 
    CROSS JOIN elector_captures ec ON ec.coordinator_id = u.id
    CROSS JOIN capture_conflicts cc ON cc.capture_id = ec.id
    LEFT JOIN electors e ON cc.elector_ci = e.ci
    WHERE 1=1 ${sec_sql}
    
    ORDER BY timestamp DESC
    LIMIT 20
  `;
  
  console.log("=== EXPLAIN QUERY PLAN FOR UNION ===");
  const plan = db.prepare(`EXPLAIN QUERY PLAN ${query}`).all(...allParams);
  console.log(JSON.stringify(plan, null, 2));

  console.log("\n=== RUNNING QUERY ===");
  const start = performance.now();
  const rows = db.prepare(query).all(...allParams);
  const end = performance.now();
  console.log(`Query returned ${rows.length} rows in ${(end - start).toFixed(2)}ms`);
} catch (err) {
  console.error("FAILED:", err.message);
}
