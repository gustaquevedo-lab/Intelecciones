const Database = require('better-sqlite3');
const path = require('path');
const db = new Database(path.join(__dirname, 'intellecciones.db'));

console.log("Checking indexes in intellecciones.db...");
const indexes = db.prepare("SELECT name, tbl_name, sql FROM sqlite_master WHERE type = 'index'").all();
console.log(JSON.stringify(indexes, null, 2));

const settings = db.prepare("SELECT * FROM settings").all();
console.log("Settings:", settings);
