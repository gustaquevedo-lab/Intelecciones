const Database = require('better-sqlite3');
const path = require('path');
const db = new Database(path.join(__dirname, '..', 'intellecciones.db'));

console.log("=== tsje_resultado_distrito ===");
const distritos = db.prepare("SELECT DISTINCT cod_cargo, cod_dpto, cod_distrito FROM tsje_resultado_distrito").all();
console.log(distritos);

console.log("=== tsje_cargos ===");
const cargos = db.prepare("SELECT * FROM tsje_cargos").all();
console.log(cargos);
