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

const usersQuery = `
  WITH filtered_users AS MATERIALIZED (
    SELECT * FROM users u
    WHERE 1=1 ${sec_sql}
  )
  SELECT 
    u.*, 
    COALESCE(u.distrito, l.ciudad, c1.distrito, c2.distrito) as distrito,
    COALESCE(l.campaign_id, u.assigned_campaign_id) as campaign_id,
    l.list_number,
    COALESCE(c1.name, c2.name) as campaign_name,
    p.nombre as parent_name
  FROM filtered_users u
  LEFT JOIN lists l ON u.assigned_list_id = l.id
  LEFT JOIN campaigns c1 ON l.campaign_id = c1.id
  LEFT JOIN campaigns c2 ON u.assigned_campaign_id = c2.id
  LEFT JOIN users p ON u.parent_id = p.id
`;

try {
  console.log("=== EXPLAIN QUERY PLAN FOR USERS ===");
  const plan = db.prepare(`EXPLAIN QUERY PLAN ${usersQuery}`).all(...params);
  console.log(JSON.stringify(plan, null, 2));
} catch (err) {
  console.error("EXPLAIN FAILED:", err.message);
}
