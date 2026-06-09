const Database = require('better-sqlite3');
const db = new Database('intellecciones.db');
const rows = db.prepare(`SELECT id, type, ciudad, candidate_alias, candidate_nombre FROM lists WHERE type='INTENDENTE' AND (ciudad='PEDRO JUAN CABALLERO' OR ciudad='' OR ciudad IS NULL)`).all();
console.table(rows);
