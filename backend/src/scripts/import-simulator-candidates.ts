import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

// Helper to normalized district names
const districtMapping = {
  PJC: {
    code: '260.13.0.295.2.EXT',
    name: 'PEDRO JUAN CABALLERO',
    localFolder: '260.13.0.295.2.EXT'
  },
  Concepcion: {
    code: '260.1.0.51.1.EXT',
    name: 'CONCEPCION'
  },
  CDE: {
    code: '260.10.0.223.1.EXT',
    name: 'CIUDAD DEL ESTE'
  }
};

// Locate SQLite DB path
const dbDir = process.cwd();
let dbPath = path.join(dbDir, 'intellecciones.db');
if (!fs.existsSync(dbPath)) {
  const backendDb = path.join(dbDir, 'backend', 'intellecciones.db');
  if (fs.existsSync(backendDb)) {
    dbPath = backendDb;
  }
}

console.log("Database path resolved to:", dbPath);
if (!fs.existsSync(dbPath)) {
  console.error("Database file not found!");
  process.exit(1);
}

// Locate simulator folder to cache files
let simulatorPath = path.join(dbDir, 'simulador');
if (!fs.existsSync(simulatorPath)) {
  const siblingSim = path.join(dbDir, '..', 'simulador');
  if (fs.existsSync(siblingSim)) {
    simulatorPath = siblingSim;
  }
}
const simulatorDatosPath = path.join(simulatorPath, 'datos');
console.log("Simulator datos path resolved to:", simulatorDatosPath);

const db = new Database(dbPath);

async function fetchAndCache(districtCode: string, fileName: string, targetDir: string) {
  const localDir = path.join(targetDir, districtCode);
  if (!fs.existsSync(localDir)) {
    fs.mkdirSync(localDir, { recursive: true });
  }
  const localPath = path.join(localDir, fileName);
  if (fs.existsSync(localPath)) {
    console.log(`Local cache found for ${districtCode}/${fileName}`);
    return JSON.parse(fs.readFileSync(localPath, 'utf8'));
  }
  const url = `https://simuladoroficial.tsje.gov.py/datos/${districtCode}/${fileName}`;
  console.log(`Fetching remote: ${url}`);
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to fetch ${url}: ${res.statusText}`);
  }
  const data = await res.json();
  fs.writeFileSync(localPath, JSON.stringify(data, null, 2), 'utf8');
  console.log(`Saved and cached ${districtCode}/${fileName} to ${localPath}`);
  return data;
}

async function run() {
  try {
    // 1. Wipe existing lists for these cities to avoid duplicates (idempotent seed)
    const citiesToWipe = ['PEDRO JUAN CABALLERO', 'CONCEPCION', 'CIUDAD DEL ESTE'];
    console.log(`Clearing existing lists for cities: ${citiesToWipe.join(', ')}`);
    db.prepare(`
      DELETE FROM lists 
      WHERE ciudad IN (?, ?, ?)
    `).run(citiesToWipe[0], citiesToWipe[1], citiesToWipe[2]);

    const insertListStmt = db.prepare(`
      INSERT INTO lists (
        campaign_id, type, list_number, option_number, 
        candidate_ci, candidate_nombre, candidate_alias, 
        goal, photo_url, ciudad, is_adversary
      ) VALUES (
        1, @type, @list_number, @option_number,
        @candidate_ci, @candidate_nombre, @candidate_alias,
        1000, null, @ciudad, @is_adversary
      )
    `);

    // Let's iterate over each district
    for (const [key, dist] of Object.entries(districtMapping)) {
      console.log(`\n========================================`);
      console.log(`Processing district: ${dist.name} (${dist.code})`);
      console.log(`========================================`);

      let candidaturas: any[];
      let agrupaciones: any[];

      // Try local files for PJC if available, otherwise fetch/cache all
      if (key === 'PJC' && 'localFolder' in dist && fs.existsSync(path.join(simulatorDatosPath, (dist as any).localFolder || ''))) {
        const localFolder = path.join(simulatorDatosPath, (dist as any).localFolder || '');
        console.log(`Reading PJC files locally from: ${localFolder}`);
        candidaturas = JSON.parse(fs.readFileSync(path.join(localFolder, 'Candidaturas.json'), 'utf8'));
        agrupaciones = JSON.parse(fs.readFileSync(path.join(localFolder, 'Agrupaciones.json'), 'utf8'));
      } else {
        candidaturas = await fetchAndCache(dist.code, 'Candidaturas.json', simulatorDatosPath);
        agrupaciones = await fetchAndCache(dist.code, 'Agrupaciones.json', simulatorDatosPath);
      }

      console.log(`Loaded ${candidaturas.length} candidates and ${agrupaciones.length} agrupaciones.`);

      // Build Map for agrupaciones
      const agrupMap = new Map<string, { numero: string; nombre: string }>();
      for (const ag of agrupaciones) {
        agrupMap.set(String(ag.codigo), {
          numero: String(ag.numero),
          nombre: String(ag.nombre)
        });
      }

      // Collect PRP candidates for authorities fallback / name resolution
      const prpCandidatesMap = new Map<string, string>(); // list_number -> candidate_name
      for (const cand of candidaturas) {
        if (cand.cod_categoria === 'PRP' && cand.nro_orden === 1 && cand.cod_lista) {
          const agInfo = agrupMap.get(String(cand.cod_lista));
          if (agInfo) {
            prpCandidatesMap.set(agInfo.numero, cand.nombre);
          }
        }
      }

      // Insert candidates
      db.transaction(() => {
        let count = 0;
        const authoritiesAdded = new Set<string>(); // Keep track of authorities list_numbers added for this city

        for (const cand of candidaturas) {
          if (!cand.cod_lista || cand.nombre === 'VOTO EN BLANCO' || cand.nombre === 'Votos NULOS' || cand.nombre === 'Votos a Computar') {
            continue;
          }

          const agInfo = agrupMap.get(String(cand.cod_lista));
          if (!agInfo) {
            // Skips if agrupacion isn't defined
            continue;
          }

          const list_number = agInfo.numero;
          const is_adversary = list_number === '9' ? 0 : 1;

          if (cand.cod_categoria === 'INT') {
            // INTENDENTE
            insertListStmt.run({
              type: 'INTENDENTE',
              list_number,
              option_number: null,
              candidate_ci: cand.codigo ? cand.codigo.split('.')[1] || null : null,
              candidate_nombre: cand.nombre,
              candidate_alias: `${cand.nombre} (L${list_number})`,
              ciudad: dist.name,
              is_adversary
            });
            count++;
          } else if (cand.cod_categoria === 'JUN') {
            // CONCEJAL
            insertListStmt.run({
              type: 'CONCEJAL',
              list_number,
              option_number: String(cand.nro_orden),
              candidate_ci: cand.codigo ? cand.codigo.split('.')[1] || null : null,
              candidate_nombre: cand.nombre,
              candidate_alias: `${cand.nombre} (L${list_number} Op${cand.nro_orden})`,
              ciudad: dist.name,
              is_adversary
            });
            count++;
          } else if (['PRP', 'DCN', 'DCD', 'COM', 'CNV'].includes(cand.cod_categoria)) {
            // AUTORIDADES
            // Group authorities by list_number so we have exactly one row per movement/list
            if (!authoritiesAdded.has(list_number)) {
              // Find the leader candidate name for PRP if exists
              const leaderName = prpCandidatesMap.get(list_number);
              const displayName = leaderName 
                ? `${leaderName} (L${list_number})`
                : `${agInfo.nombre} (L${list_number})`;

              insertListStmt.run({
                type: 'AUTORIDADES',
                list_number,
                option_number: null,
                candidate_ci: null,
                candidate_nombre: leaderName || agInfo.nombre,
                candidate_alias: displayName,
                ciudad: dist.name,
                is_adversary
              });
              authoritiesAdded.add(list_number);
              count++;
            }
          }
        }
        console.log(`Inserted ${count} list options into database for ${dist.name}.`);
      })();
    }

    // Verify
    const verifyCounts = db.prepare(`
      SELECT ciudad, type, count(*) as cnt 
      FROM lists 
      GROUP BY ciudad, type
    `).all() as any[];
    console.log("\n========================================\nVerification DB Counts:");
    console.table(verifyCounts);
    console.log("========================================");

  } catch (err: any) {
    console.error("Error running import script:", err.message);
    console.error(err.stack);
    process.exit(1);
  }
}

run();
