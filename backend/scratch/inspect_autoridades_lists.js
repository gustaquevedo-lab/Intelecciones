const Database = require('better-sqlite3');
const path = require('path');
const db = new Database(path.join(__dirname, '..', 'intellecciones.db'));

console.log("=== lists of type AUTORIDADES ===");
const rows = db.prepare("SELECT * FROM lists WHERE type = 'AUTORIDADES' LIMIT 20").all();
console.log(rows);
