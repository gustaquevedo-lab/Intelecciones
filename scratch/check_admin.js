const db = require('better-sqlite3')('c:/Users/Gustavo/OneDrive/Dev/Intelecciones/backend/data/database.sqlite');
const admin = db.prepare('SELECT * FROM users WHERE username = ?').get('admin');
console.log(JSON.stringify(admin, null, 2));
