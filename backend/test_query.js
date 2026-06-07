const Database = require('better-sqlite3');
const db = new Database('../intellecciones.db');

try {
  const local = 'INSTITUTO SALESIANO SAN JOSE';
  const voters = db.prepare(`
    SELECT
      e.nombre,
      e.apellido,
      e.ci,
      e.orden,
      e.mesa,
      pl.timestamp as voted_at,
      (CASE WHEN ec.id IS NOT NULL THEN 1 ELSE 0 END) as registrado
    FROM participation_logs pl
    JOIN electors e ON pl.local_votacion = e.local_votacion AND pl.mesa = e.mesa AND pl.orden = e.orden
    LEFT JOIN elector_captures ec ON e.ci = ec.elector_ci
    WHERE pl.local_votacion = ?
    ORDER BY e.mesa ASC, pl.timestamp DESC
  `).all(local);
  console.log('Query success! Count:', voters.length);
} catch (e) {
  console.error('Query failed!', e);
}
