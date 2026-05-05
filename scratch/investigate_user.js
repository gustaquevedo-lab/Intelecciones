
const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, '..', 'backend', 'intellecciones.db');
const db = new Database(dbPath);

const ci = '3657834';
const user = db.prepare('SELECT * FROM users WHERE ci = ? OR username = ?').get(ci, ci);

if (!user) {
  console.log(`User with CI/Username ${ci} not found.`);
  process.exit(0);
}

console.log('--- USER INFO ---');
console.log(user);

console.log('\n--- DEPENDENCIES ---');

const subUsers = db.prepare('SELECT id, username, nombre FROM users WHERE parent_id = ?').all(user.id);
console.log(`Sub-users (dependents): ${subUsers.length}`);
if (subUsers.length > 0) {
  console.log('List of sub-users:', subUsers.map(u => `${u.username} (${u.nombre})`).join(', '));
}

const captures = db.prepare('SELECT COUNT(*) as count FROM elector_captures WHERE coordinator_id = ?').get(user.id);
console.log(`Captures made: ${captures.count}`);

const requests = db.prepare('SELECT COUNT(*) as count FROM field_requests WHERE coordinator_id = ?').get(user.id);
console.log(`Field requests: ${requests.count}`);

const logs = db.prepare('SELECT COUNT(*) as count FROM participation_logs WHERE veedor_id = ?').get(user.id);
console.log(`Participation logs: ${logs.count}`);

const results = db.prepare('SELECT COUNT(*) as count FROM results WHERE veedor_id = ?').get(user.id);
console.log(`Results/Actas: ${results.count}`);

db.close();
