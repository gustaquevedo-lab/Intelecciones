const Database = require('better-sqlite3');
const path = require('path');
const db = new Database(path.join(__dirname, '../intellecciones.db'));

const district = 'PEDRO JUAN CABALLERO';

const query = `
  SELECT 
    cc.id as conflict_id,
    cc.status as conflict_status,
    cc.resolved_at,
    cc.elector_ci as elector_ci,
    COALESCE(e.nombre, 'ELECTOR') as elector_nombre,
    COALESCE(e.apellido, 'NO REGISTRADO') as elector_apellido,
    COALESCE(e.local_votacion, 'REGISTRO DE CAMPO') as local_votacion,
    COALESCE(e.mesa, 0) as mesa,
    
    COALESCE(u_win_1.nombre, u_win_2.nombre) as winner_name,
    COALESCE(u_win_1.role, u_win_2.role) as winner_role,
    p_win.nombre as padrino_name
  FROM capture_conflicts cc
  CROSS JOIN electors e ON cc.elector_ci = e.ci
  LEFT JOIN elector_captures ec_win_1 ON cc.winner_capture_id = ec_win_1.id
  LEFT JOIN elector_captures ec_win_2 ON cc.jefe_decision_id = ec_win_2.id
  LEFT JOIN users u_win_1 ON ec_win_1.coordinator_id = u_win_1.id
  LEFT JOIN users u_win_2 ON ec_win_2.coordinator_id = u_win_2.id
  LEFT JOIN users p_win ON COALESCE(u_win_1.parent_id, u_win_2.parent_id) = p_win.id
  WHERE cc.status = 'RESOLVED' AND e.distrito = ?
  ORDER BY cc.resolved_at DESC LIMIT 100
`;

try {
  console.log("=== EXPLAIN QUERY PLAN FOR HISTORY ===");
  const plan = db.prepare(`EXPLAIN QUERY PLAN ${query}`).all(district);
  console.log(JSON.stringify(plan, null, 2));

  console.log("\n=== RUNNING QUERY ===");
  const start = performance.now();
  const rows = db.prepare(query).all(district);
  const end = performance.now();
  console.log(`Query returned ${rows.length} rows in ${(end - start).toFixed(2)}ms`);
} catch (err) {
  console.error("FAILED:", err.message);
}
