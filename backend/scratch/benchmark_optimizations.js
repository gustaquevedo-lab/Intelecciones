const Database = require('better-sqlite3');
const path = require('path');
const db = new Database(path.join(__dirname, '..', 'intellecciones.db'));

const district = 'PEDRO JUAN CABALLERO';

// 1. Original Locales query using INDEXED BY idx_electors_distrito
const oldLocales = `
  SELECT COALESCE(e.local_votacion, 'REGISTRO DE CAMPO') as local_votacion,
         COALESCE(e.distrito, 'REGISTRO DE CAMPO') as distrito,
         COUNT(ec.id) as total_captures,
         SUM(CASE WHEN ec.traffic_light = 'GREEN' THEN 1 ELSE 0 END) as green,
         SUM(CASE WHEN ec.traffic_light = 'YELLOW' THEN 1 ELSE 0 END) as yellow,
         SUM(CASE WHEN ec.traffic_light = 'RED' THEN 1 ELSE 0 END) as red,
         SUM(CASE WHEN ec.traffic_light = 'PURPLE' THEN 1 ELSE 0 END) as purple,
         SUM(CASE WHEN ec.needs_transport = 1 THEN 1 ELSE 0 END) as needs_transport
  FROM electors e INDEXED BY idx_electors_distrito
  INNER JOIN elector_captures ec ON ec.elector_ci = e.ci
  LEFT JOIN users u ON ec.coordinator_id = u.id
  LEFT JOIN lists l ON ec.list_id = l.id
  WHERE e.distrito = ?
  GROUP BY COALESCE(e.local_votacion, 'REGISTRO DE CAMPO'), COALESCE(e.distrito, 'REGISTRO DE CAMPO')
  ORDER BY total_captures DESC
`;

// 2. Optimized Locales query driving from captures
const newLocales = `
  WITH captures AS (
    SELECT ec.id, ec.elector_ci, ec.traffic_light, ec.needs_transport, ec.coordinator_id, ec.list_id
    FROM elector_captures ec
    LIMIT -1
  )
  SELECT COALESCE(e.local_votacion, 'REGISTRO DE CAMPO') as local_votacion,
         COALESCE(e.distrito, 'REGISTRO DE CAMPO') as distrito,
         COUNT(ec.id) as total_captures,
         SUM(CASE WHEN ec.traffic_light = 'GREEN' THEN 1 ELSE 0 END) as green,
         SUM(CASE WHEN ec.traffic_light = 'YELLOW' THEN 1 ELSE 0 END) as yellow,
         SUM(CASE WHEN ec.traffic_light = 'RED' THEN 1 ELSE 0 END) as red,
         SUM(CASE WHEN ec.traffic_light = 'PURPLE' THEN 1 ELSE 0 END) as purple,
         SUM(CASE WHEN ec.needs_transport = 1 THEN 1 ELSE 0 END) as needs_transport
  FROM captures ec
  INNER JOIN electors e ON ec.elector_ci = e.ci
  LEFT JOIN users u ON ec.coordinator_id = u.id
  LEFT JOIN lists l ON ec.list_id = l.id
  WHERE e.distrito = ?
  GROUP BY COALESCE(e.local_votacion, 'REGISTRO DE CAMPO'), COALESCE(e.distrito, 'REGISTRO DE CAMPO')
  ORDER BY total_captures DESC
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

runBenchmark("Old Locales Query", oldLocales, [district]);
runBenchmark("New Locales Query (Materialized CTE)", newLocales, [district]);
console.log("\nAre results identical?", 
  JSON.stringify(db.prepare(oldLocales).all(district)) === 
  JSON.stringify(db.prepare(newLocales).all(district))
);
