const db = require('better-sqlite3')('intellecciones.db');
const user = db.prepare(`SELECT * FROM users WHERE username = '3512586' OR ci = '3512586'`).get();
console.log(JSON.stringify(user, null, 2));
