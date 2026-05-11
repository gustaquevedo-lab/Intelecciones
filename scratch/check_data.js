const Database = require('better-sqlite3');
const db = new Database('backend/database.sqlite');
const rows = db.prepare('SELECT ci, nombre, ciudad, distrito FROM electors LIMIT 10').all();
console.log(JSON.stringify(rows, null, 2));
const campaigns = db.prepare('SELECT id, name, distrito FROM campaigns LIMIT 5').all();
console.log(JSON.stringify(campaigns, null, 2));
