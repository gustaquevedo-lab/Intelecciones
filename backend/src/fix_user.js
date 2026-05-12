const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(process.cwd(), 'intellecciones.db');
const db = new Database(dbPath);

const result = db.prepare('UPDATE users SET assigned_list_id = NULL, assigned_campaign_id = NULL WHERE username = ?')
  .run('4500001');

console.log('Update result:', result);

const user = db.prepare('SELECT * FROM users WHERE username = ?').get('4500001');
console.log('User 4500001 after update:', user);
