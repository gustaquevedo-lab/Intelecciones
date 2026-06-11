const Database = require('better-sqlite3');
const path = require('path');
const db = new Database(path.join(__dirname, '..', 'intellecciones.db'));

console.log("=== tsje_cargos ===");
const cargos = db.prepare("SELECT * FROM tsje_cargos").all();
console.log(cargos);

console.log("\n=== tsje_resultado_distrito ===");
const resultados = db.prepare("SELECT cod_eleccion, cod_cargo, cod_dpto, cod_distrito, total_votos, fetched_at FROM tsje_resultado_distrito").all();
console.log(resultados);

console.log("\n=== tsje_sync_log (recent) ===");
const logs = db.prepare("SELECT * FROM tsje_sync_log ORDER BY started_at DESC LIMIT 5").all();
console.log(logs);
