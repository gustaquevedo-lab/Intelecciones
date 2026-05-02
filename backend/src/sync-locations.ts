import db from './db';

console.log("Sincronizando locales de votación...");

// Obtenemos los locales únicos del padrón de electores
const locations = db.prepare(`
  SELECT DISTINCT cod_local, local_votacion as nombre
  FROM electors
  WHERE cod_local IS NOT NULL AND local_votacion IS NOT NULL
`).all() as { cod_local: string; nombre: string }[];

console.log(`Se encontraron ${locations.length} locales de votación únicos en el padrón.`);

const insertStmt = db.prepare(`
  INSERT OR IGNORE INTO voting_locations (cod_local, nombre, lat, lng)
  VALUES (@cod_local, @nombre, NULL, NULL)
`);

const insertMany = db.transaction((locs) => {
  for (const loc of locs) {
    insertStmt.run(loc);
  }
});

try {
  insertMany(locations);
  console.log("Locales de votación sincronizados correctamente.");
} catch (error) {
  console.error("Error sincronizando locales:", error);
}
