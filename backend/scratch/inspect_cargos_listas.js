const Database = require('better-sqlite3');
const path = require('path');
const db = new Database(path.join(__dirname, '..', 'intellecciones.db'));

console.log("=== tsje_resultado_lista for cargo 3 ===");
const list3 = db.prepare("SELECT * FROM tsje_resultado_lista WHERE cod_cargo = 3").all();
console.log(list3.slice(0, 10));

console.log("=== tsje_resultado_lista for cargo 4 ===");
const list4 = db.prepare("SELECT * FROM tsje_resultado_lista WHERE cod_cargo = 4").all();
console.log(list4.slice(0, 10));

console.log("=== tsje_resultado_preferente for cargo 3 ===");
const pref3 = db.prepare("SELECT * FROM tsje_resultado_preferente WHERE cod_cargo = 3").all();
console.log(pref3.slice(0, 10));

console.log("=== tsje_resultado_preferente for cargo 4 ===");
const pref4 = db.prepare("SELECT * FROM tsje_resultado_preferente WHERE cod_cargo = 4").all();
console.log(pref4.slice(0, 10));
