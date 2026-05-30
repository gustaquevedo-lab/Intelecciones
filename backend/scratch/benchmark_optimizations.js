const Database = require('better-sqlite3');
const path = require('path');
const db = new Database(path.join(__dirname, '..', 'intellecciones.db'));

const district = 'PEDRO JUAN CABALLERO';
const secSql = `AND (
  u.distrito = ? OR 
  EXISTS (SELECT 1 FROM lists l2 WHERE l2.id = u.assigned_list_id AND l2.ciudad = ?) OR 
  EXISTS (SELECT 1 FROM campaigns c2 WHERE c2.id = u.assigned_campaign_id AND c2.distrito = ?)
)`;
const secParams = [district, district, district];

// 1. Current query
const oldUsers = `
  SELECT 
    u.*, 
    l.list_number, 
    l.type as list_type, 
    COALESCE(c.id, u.assigned_campaign_id) as effective_campaign_id,
    c.name as campaign_name,
    p.nombre as parent_name
  FROM users u
  LEFT JOIN lists l ON u.assigned_list_id = l.id
  LEFT JOIN campaigns c ON (l.campaign_id = c.id OR u.assigned_campaign_id = c.id)
  LEFT JOIN users p ON u.parent_id = p.id
  WHERE 1=1 ${secSql}
  LIMIT 1500
`;

// 2. Fully optimized CTE query
const cteUsers = `
  WITH filtered_users AS (
    SELECT * FROM users u WHERE 1=1 ${secSql} LIMIT -1
  )
  SELECT 
    u.*, 
    l.list_number, 
    l.type as list_type, 
    COALESCE(c1.id, c2.id) as effective_campaign_id,
    COALESCE(c1.name, c2.name) as campaign_name,
    p.nombre as parent_name
  FROM filtered_users u
  LEFT JOIN lists l ON u.assigned_list_id = l.id
  LEFT JOIN campaigns c1 ON l.campaign_id = c1.id
  LEFT JOIN campaigns c2 ON u.assigned_campaign_id = c2.id
  LEFT JOIN users p ON u.parent_id = p.id
  LIMIT 1500
`;

function runBenchmark(name, sql, params) {
  console.log(`\n--- BENCHMARK: ${name} ---`);
  
  // Explain query plan
  try {
    const plan = db.prepare(`EXPLAIN QUERY PLAN ${sql}`).all(...params);
    console.log("Query Plan:");
    plan.forEach(row => {
      console.log(`  ${row.detail}`);
    });
  } catch (e) {
    console.log("Could not explain query plan:", e.message);
  }

  // Measure time
  try {
    const start = performance.now();
    const rows = db.prepare(sql).all(...params);
    const end = performance.now();
    console.log(`Execution Time: ${(end - start).toFixed(2)}ms (${rows.length} rows returned)`);
  } catch (e) {
    console.log("Execution FAILED:", e.message);
  }
}

runBenchmark("Old Users Query", oldUsers, secParams);
runBenchmark("New Users Query (CTE + Split Join)", cteUsers, secParams);
console.log("\nAre results identical?", 
  JSON.stringify(db.prepare(oldUsers).all(...secParams)) === 
  JSON.stringify(db.prepare(cteUsers).all(...secParams))
);
