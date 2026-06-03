const Database = require('better-sqlite3');
const db = new Database('./intellecciones.db');

console.log("CAMPAIGNS:");
console.log(db.prepare("SELECT * FROM campaigns").all());
console.log("\nLISTS FOR CONCEPCION:");
console.log(db.prepare("SELECT * FROM lists").all());
