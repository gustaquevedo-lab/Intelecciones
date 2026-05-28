const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, '..', 'intellecciones.db');
console.log('Using DB:', dbPath);
const db = new Database(dbPath);

console.log('\n--- CAMPAIGNS AND LISTS ---');
try {
  const campaigns = db.prepare('SELECT id, name FROM campaigns').all();
  console.log('Campaigns:', campaigns);
  
  const lists = db.prepare('SELECT id, campaign_id, list_number, candidate_nombre FROM lists').all();
  console.log('Lists:', lists);
} catch (err) {
  console.error(err);
}

console.log('\n--- COORDINATORS AND PADRINOS WITH NULL LIST ---');
try {
  const users = db.prepare(`
    SELECT u.id, u.username, u.role, u.assigned_campaign_id, u.assigned_list_id, c.name as campaign_name
    FROM users u
    LEFT JOIN campaigns c ON u.assigned_campaign_id = c.id
    WHERE u.assigned_list_id IS NULL AND u.role IN ('COORDINADOR', 'PADRINO', 'SUBJEFE')
  `).all();
  console.log('Users with NULL list:', users);
} catch (err) {
  console.error(err);
}
