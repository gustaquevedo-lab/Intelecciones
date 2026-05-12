const Database = require('better-sqlite3');
const db = new Database('intellecciones.db');
const user = db.prepare("SELECT id, username, assigned_list_id FROM users WHERE username = '4500001'").get();
console.log(JSON.stringify(user));
db.close();
