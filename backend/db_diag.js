const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

function inspect(dbPath) {
    if (!fs.existsSync(dbPath)) return { exists: false };
    const stats = fs.statSync(dbPath);
    const db = new Database(dbPath);
    try {
        const campaigns = db.prepare("SELECT id, name, distrito FROM campaigns").all();
        const lists = db.prepare("SELECT id, campaign_id, list_number, ciudad FROM lists").all();
        const users = db.prepare("SELECT id, username, role FROM users").all();
        const electorsCount = db.prepare("SELECT COUNT(*) as count FROM electors").get().count;
        return { exists: true, size: stats.size, campaigns, lists, users, electorsCount };
    } catch (e) {
        return { exists: true, size: stats.size, error: e.message };
    }
}

const rootDb = path.join(__dirname, '..', 'intellecciones.db');
const backendDb = path.join(__dirname, 'intellecciones.db');
const recoveredDb = path.join(__dirname, 'recovered_intellecciones.db');

console.log('--- ROOT DB ---');
console.log(JSON.stringify(inspect(rootDb), null, 2));
console.log('\n--- BACKEND DB ---');
console.log(JSON.stringify(inspect(backendDb), null, 2));
console.log('\n--- RECOVERED DB ---');
console.log(JSON.stringify(inspect(recoveredDb), null, 2));
