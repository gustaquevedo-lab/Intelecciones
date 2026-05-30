const Database = require('better-sqlite3');
const path = require('path');
const db = new Database(path.join(__dirname, '../intellecciones.db'));

const district = 'PEDRO JUAN CABALLERO';
const sql = `
  WITH resolved_conflicts AS MATERIALIZED (
    SELECT * FROM capture_conflicts WHERE status = 'RESOLVED'
  ),
  resolved_conflicts_with_elector AS MATERIALIZED (
    SELECT 
      cc.*,
      e.ci as elector_ci_ref,
      e.nombre as elector_nombre,
      e.apellido as elector_apellido,
      e.local_votacion as local_votacion,
      e.mesa as mesa,
      e.distrito as distrito,
      e.ciudad as ciudad
    FROM resolved_conflicts cc
    LEFT JOIN electors e ON cc.elector_ci = e.ci
  )
  SELECT 
    e.id as conflict_id,
    e.status as conflict_status,
    e.resolved_at,
    COALESCE(e.elector_ci_ref, e.elector_ci) as elector_ci,
    COALESCE(e.elector_nombre, 'ELECTOR') as elector_nombre,
    COALESCE(e.elector_apellido, 'NO REGISTRADO') as elector_apellido,
    COALESCE(e.local_votacion, 'REGISTRO DE CAMPO') as local_votacion,
    COALESCE(e.mesa, 0) as mesa,
    
    COALESCE(u_win_1.nombre, u_win_2.nombre) as winner_name,
    COALESCE(u_win_1.role, u_win_2.role) as winner_role,
    p_win.nombre as padrino_name
  FROM resolved_conflicts_with_elector e
  LEFT JOIN elector_captures ec_win_1 ON e.winner_capture_id = ec_win_1.id
  LEFT JOIN elector_captures ec_win_2 ON e.jefe_decision_id = ec_win_2.id
  LEFT JOIN users u_win_1 ON ec_win_1.coordinator_id = u_win_1.id
  LEFT JOIN users u_win_2 ON ec_win_2.coordinator_id = u_win_2.id
  LEFT JOIN users p_win ON COALESCE(u_win_1.parent_id, u_win_2.parent_id) = p_win.id
  WHERE 1=1 AND e.distrito = ? AND (UPPER(TRIM(COALESCE(e.distrito, u_win_1.distrito, u_win_2.distrito))) LIKE UPPER(TRIM(?)) OR UPPER(TRIM(COALESCE(e.ciudad, u_win_1.distrito, u_win_2.distrito))) LIKE UPPER(TRIM(?)))
`;

try {
  const res = db.prepare(sql).all(district, `%${district}%`, `%${district}%`);
  console.log('Query succeeded. Result count:', res.length);
} catch (err) {
  console.error('Query failed:', err.message);
}
