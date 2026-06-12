const Database = require('better-sqlite3');
const path = require('path');
const db = new Database(path.join(__dirname, '..', 'intellecciones.db'));

console.log("=== lists with option_number != null ===");
const rows = db.prepare("SELECT type, COUNT(*) FROM lists WHERE option_number IS NOT NULL GROUP BY type").all();
console.log(rows);

const sample = db.prepare("SELECT * FROM lists WHERE option_number IS NOT NULL LIMIT 5").all();
console.log("Sample:", sample);
