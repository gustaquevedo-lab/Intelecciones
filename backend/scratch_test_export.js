process.env.NODE_ENV = 'test';
const db = require('./src/db').default;

try {
  // Setup data
  db.exec('DELETE FROM elector_captures');
  db.exec('DELETE FROM users');
  db.exec('DELETE FROM lists');
  db.exec('DELETE FROM campaigns');
  db.exec('DELETE FROM electors');

  db.prepare(`
    INSERT INTO campaigns (id, name, enabled_modules, status, slogan, distrito, goal)
    VALUES (1, 'Campaña Test', 'COMMAND_CENTER,REGISTRY', 'active', 'Slogan Test', 'TEST_DISTRICT', 100)
  `).run();

  db.prepare(`
    INSERT INTO users (id, username, password, role, assigned_list_id, assigned_campaign_id, nombre, distrito, ci, status)
    VALUES (1, 'admin', 'admin123', 'SUPERUSUARIO', NULL, 1, 'Administrador Test', 'TEST_DISTRICT', '1111111', 'ACTIVE')
  `).run();

  const query = `
      SELECT 
        ec.id,
        COALESCE(e.nombre, 'ELECTOR') as nombre,
        COALESCE(e.apellido, 'NO REGISTRADO') as apellido,
        ec.elector_ci as ci,
        ec.telefono,
        ec.traffic_light as semaforo,
        (CASE WHEN ec.needs_transport = 1 THEN 'SI' ELSE 'NO' END) as transporte,
        COALESCE(u.nombre, '—') as coordinador,
        COALESCE(p.nombre, '—') as referente,
        COALESCE(e.local_votacion, 'REGISTRO DE CAMPO') as local,
        COALESCE(e.mesa, 0) as mesa,
        COALESCE(e.orden, 0) as orden,
        COALESCE(e.ciudad, '—') as ciudad,
        COALESCE(e.distrito, '—') as distrito
      FROM elector_captures ec
      LEFT JOIN electors e ON ec.elector_ci = e.ci
      LEFT JOIN users u ON ec.coordinator_id = u.id
      LEFT JOIN users p ON u.parent_id = p.id
      LEFT JOIN lists l ON ec.list_id = l.id
      WHERE 1=1 AND (
            u.distrito = ? OR 
            EXISTS (SELECT 1 FROM lists l2 WHERE l2.id = u.assigned_list_id AND l2.ciudad = ?) OR 
            EXISTS (SELECT 1 FROM campaigns c2 WHERE c2.id = u.assigned_campaign_id AND c2.distrito = ?)
          )
      ORDER BY ec.timestamp DESC
  `;

  console.log("Preparing query...");
  const stmt = db.prepare(query);
  console.log("Executing query...");
  const rows = stmt.all('TEST_DISTRICT', 'TEST_DISTRICT', 'TEST_DISTRICT');
  console.log("Success! Rows:", rows.length);
} catch (err) {
  console.error("Query failed:");
  console.error(err.stack || err);
}
