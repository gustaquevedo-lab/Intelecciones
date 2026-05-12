const Database = require('better-sqlite3');
const db = new Database('backend/database.sqlite');

const tables = ['electors', 'campaigns', 'lists', 'users', 'voting_locations'];

tables.forEach(table => {
    try {
        const info = db.prepare(`PRAGMA table_info(${table})`).all();
        console.log(`Table: ${table}`);
        console.log(info.map(c => c.name).join(', '));
    } catch (e) {
        console.log(`Table ${table} not found or error: ${e.message}`);
    }
});
