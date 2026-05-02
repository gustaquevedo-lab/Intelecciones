const Database = require('better-sqlite3');
const db = new Database('intellecciones.db');
const user = db.prepare("SELECT username, password FROM users WHERE username = 'jefe'").get();
console.log(JSON.stringify(user, null, 2));
