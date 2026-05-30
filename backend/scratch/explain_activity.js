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

try {
  console.log("=== audit_logs columns ===");
  console.log(db.prepare("PRAGMA table_info(audit_logs)").all());

  console.log("=== audit_logs indexes ===");
  console.log(db.prepare("PRAGMA index_list(audit_logs)").all());
  
  const query = `
    SELECT al.*, u.nombre as user_name, u.photo_url as user_photo
    FROM users u
    CROSS JOIN audit_logs al ON al.user_id = u.id
    WHERE 1=1 ${sec_sql}
    ORDER BY al.timestamp DESC LIMIT 50
  `;
  
  console.log("\n=== EXPLAIN QUERY PLAN FOR ACTIVITY ===");
  const plan = db.prepare(`EXPLAIN QUERY PLAN ${query}`).all(...params);
  console.log(JSON.stringify(plan, null, 2));

  console.log("\n=== RUNNING QUERY ===");
  const start = performance.now();
  const rows = db.prepare(query).all(...params);
  const end = performance.now();
  console.log(`Query returned ${rows.length} rows in ${(end - start).toFixed(2)}ms`);
} catch (err) {
  console.error("FAILED:", err.message);
}
