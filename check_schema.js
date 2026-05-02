const Database = require('better-sqlite3');
const db = new Database('intellecciones.db');
const schema = db.prepare("PRAGMA table_info(electors)").all();
console.log(JSON.stringify(schema, null, 2));
