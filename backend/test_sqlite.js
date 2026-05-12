const db = require('better-sqlite3')('test.db');
db.exec(`
  CREATE TABLE IF NOT EXISTS voting_locations (
    cod_local TEXT PRIMARY KEY,
    nombre TEXT NOT NULL,
    lat REAL,
    lng REAL,
    direccion TEXT,
    icon TEXT DEFAULT 'Landmark',
    distrito TEXT DEFAULT ''
  );
`);
db.prepare('INSERT INTO voting_locations (cod_local, nombre) VALUES (?, ?)').run('101', 'Test');
try {
  db.prepare(`
      UPDATE voting_locations 
      SET nombre = ?, lat = ?, lng = ?, icon = ?, direccion = ?, distrito = ?
      WHERE cod_local = ?
    `).run('Test2', null, null, 'Landmark', '', 'PEDRO JUAN CABALLERO', '101');
  console.log("Success");
} catch(e) {
  console.log("Error:", e.message);
}
