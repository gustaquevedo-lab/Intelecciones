
const Database = require('../backend/node_modules/better-sqlite3');
const path = require('path');
const fs = require('fs');

const dbPath = path.join(__dirname, '..', 'backend', 'intellecciones.db');
const db = new Database(dbPath);

const migrations = [
    "ALTER TABLE users ADD COLUMN parent_id INTEGER",
    "ALTER TABLE users ADD COLUMN needs_password_change INTEGER DEFAULT 0",
    "ALTER TABLE campaigns ADD COLUMN distrito TEXT",
    "ALTER TABLE voting_locations ADD COLUMN distrito TEXT DEFAULT ''"
];

migrations.forEach(sql => {
    try {
        db.prepare(sql).run();
        console.log('SUCCESS:', sql);
    } catch (e) {
        console.log('SKIPPED (already exists or error):', sql, e.message);
    }
});

console.log('Database fix completed.');
