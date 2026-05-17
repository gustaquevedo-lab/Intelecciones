const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(process.cwd(), 'intellecciones.db');
const db = new Database(dbPath);

console.log('--- BUSCANDO A ZULMA ---');
const users = db.prepare("SELECT id, username, nombre, role, parent_id, distrito, assigned_list_id FROM users WHERE nombre LIKE '%Zulma%' OR username LIKE '%Zulma%';").all();
console.log(JSON.stringify(users, null, 2));

if (users.length > 0) {
  const zulmaId = users[0].id;
  console.log(`\n--- CAPTURAS DE ZULMA (ID: ${zulmaId}) ---`);
  const captures = db.prepare(`
    SELECT ec.id, ec.elector_ci, ec.coordinator_id, ec.list_id, ec.timestamp, e.nombre, e.apellido, e.ciudad
    FROM elector_captures ec
    LEFT JOIN electors e ON ec.elector_ci = e.ci
    WHERE ec.coordinator_id = ?
    LIMIT 10;
  `).all(zulmaId);
  console.log(JSON.stringify(captures, null, 2));

  console.log(`\n--- TOTAL CAPTURAS DE ZULMA: ${db.prepare('SELECT COUNT(*) as count FROM elector_captures WHERE coordinator_id = ?').get(zulmaId).count} ---`);

  // Who is the parent of Zulma?
  const parentId = users[0].parent_id;
  if (parentId) {
    const parent = db.prepare("SELECT id, nombre, role, distrito FROM users WHERE id = ?;").get(parentId);
    console.log(`\n--- PADRE DE ZULMA ---`);
    console.log(JSON.stringify(parent, null, 2));
  } else {
    console.log('\nZulma no tiene padre asignado (parent_id is NULL)');
  }
}
