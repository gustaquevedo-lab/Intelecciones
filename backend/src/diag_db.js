const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(process.cwd(), 'intellecciones.db');
const db = new Database(dbPath);

const users = db.prepare(`
  SELECT u.id, u.username, u.nombre, u.role, u.assigned_list_id, u.distrito, l.list_number, l.ciudad as list_ciudad
  FROM users u
  LEFT JOIN lists l ON u.assigned_list_id = l.id
`).all();

console.log('--- ALL USERS ---');
users.forEach(u => {
  console.log(`ID: ${u.id} | User: ${u.username} | Name: ${u.nombre} | Role: ${u.role} | ListID: ${u.assigned_list_id} | List#: ${u.list_number} | Dist: ${u.distrito}`);
});

const lists = db.prepare('SELECT * FROM lists').all();
console.log('\n--- ALL LISTS ---');
lists.forEach(l => {
  console.log(`ID: ${l.id} | #: ${l.list_number} | Ciudad: ${l.ciudad} | Campaign: ${l.campaign_id}`);
});
