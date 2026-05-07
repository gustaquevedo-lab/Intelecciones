
const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const dbPath = path.join(__dirname, 'backend', 'intellecciones.db');
if (!fs.existsSync(dbPath)) {
    console.error('DB not found at', dbPath);
    process.exit(1);
}

const db = new Database(dbPath);
const users = db.prepare('SELECT id, username, role, nombre, ci FROM users ORDER BY id DESC LIMIT 10').all();
console.log('--- LAST 10 USERS ---');
console.log(JSON.stringify(users, null, 2));

const logs = db.prepare("SELECT * FROM audit_logs WHERE action = 'CREATE' AND entity = 'USER' ORDER BY id DESC LIMIT 10").all();
console.log('\n--- LAST 10 USER CREATION LOGS ---');
console.log(JSON.stringify(logs, null, 2));
