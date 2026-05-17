const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(process.cwd(), 'temp_db_95b.db');
const db = new Database(dbPath);

console.log('--- BUSCANDO A ZULMA ---');
const users = db.prepare("SELECT id, username, nombre, role, parent_id, distrito, assigned_list_id FROM users WHERE nombre LIKE '%Zulma%' OR username LIKE '%Zulma%';").all();
console.log(JSON.stringify(users, null, 2));

if (users.length > 0) {
  for (const zulma of users) {
    const zulmaId = zulma.id;
    console.log(`\n--- REVISANDO USUARIO: ${zulma.nombre} (ID: ${zulmaId}, Rol: ${zulma.role}) ---`);
    
    const count = db.prepare('SELECT COUNT(*) as count FROM elector_captures WHERE coordinator_id = ?').get(zulmaId).count;
    console.log(`Total Capturas: ${count}`);

    // Who is the parent of Zulma?
    const parentId = zulma.parent_id;
    if (parentId) {
      const parent = db.prepare("SELECT id, nombre, role, distrito FROM users WHERE id = ?;").get(parentId);
      console.log(`--- PADRE DE ZULMA ---`);
      console.log(JSON.stringify(parent, null, 2));
    } else {
      console.log('Zulma no tiene padre asignado (parent_id is NULL)');
    }
  }
}
