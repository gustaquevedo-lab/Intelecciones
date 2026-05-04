
const Database = require('better-sqlite3');
const path = require('path');
const db = new Database(path.join(__dirname, 'intellecciones.db'));

const user = db.prepare("SELECT * FROM users WHERE username = '3657834' OR ci = '3657834'").get();
console.log(JSON.stringify(user, null, 2));
