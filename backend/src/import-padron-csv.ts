import * as fs from 'fs';
import * as path from 'path';
import * as readline from 'readline';
import db from './db';

const uploadsDir = '/Users/gustaquevedo/Library/CloudStorage/OneDrive-Personal/Dev/Intelecciones/backend/uploads';

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++; // skip next quote
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current);
  return result;
}

async function runImport() {
  console.log('--- INICIANDO IMPORTACIÓN EN SQLITE ---');

  // 1. Cargar CIs inhabilitadas en un Set en memoria
  console.log('Cargando CIs inhabilitadas en memoria...');
  const inhabilitadosSet = new Set<string>();
  const inhPath = path.join(uploadsDir, 'inhabilitados.csv');
  if (fs.existsSync(inhPath)) {
    const fileStream = fs.createReadStream(inhPath);
    const rl = readline.createInterface({ input: fileStream, crlfDelay: Infinity });
    for await (const line of rl) {
      const ci = line.trim();
      if (ci) {
        inhabilitadosSet.add(ci);
      }
    }
    console.log(`Cargadas ${inhabilitadosSet.size} CIs inhabilitadas.`);
  }

  // 2. Limpiar base de datos (preservando capturas)
  console.log('Limpiando electores no capturados y locales de votación antiguos...');
  db.transaction(() => {
    db.prepare('DELETE FROM electors WHERE ci NOT IN (SELECT DISTINCT elector_ci FROM elector_captures)').run();
    db.prepare('DELETE FROM voting_locations').run();
  })();
  console.log('Limpieza completada.');

  // 3. Importar locales de votación
  console.log('Importando locales de votación...');
  const locPath = path.join(uploadsDir, 'voting_locations.csv');
  if (fs.existsSync(locPath)) {
    const insertLoc = db.prepare(`
      INSERT OR REPLACE INTO voting_locations (
        cod_local, nombre, lat, lng, direccion, icon, distrito, ciudad, campaign_id, departamento, distrito_id, zona_id, local_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const fileStream = fs.createReadStream(locPath);
    const rl = readline.createInterface({ input: fileStream, crlfDelay: Infinity });

    db.transaction(() => {
      for (const line of (rl as any)) {
        if (!line.trim()) continue;
        const parts = parseCSVLine(line);
        if (parts.length >= 13) {
          insertLoc.run(
            parts[0], // cod_local
            parts[1], // nombre
            parts[2] ? parseFloat(parts[2]) : null, // lat
            parts[3] ? parseFloat(parts[3]) : null, // lng
            parts[4], // direccion
            parts[5], // icon
            parts[6], // distrito
            parts[7], // ciudad
            parts[8] ? parseInt(parts[8]) : null, // campaign_id
            parts[9], // departamento
            parts[10] ? parseInt(parts[10]) : null, // distrito_id
            parts[11] ? parseInt(parts[11]) : null, // zona_id
            parts[12] ? parseInt(parts[12]) : null // local_id
          );
        }
      }
    })();
    console.log('Locales de votación importados.');
  }

  // 4. Importar electores (5 millones de registros) en lotes
  console.log('Importando electores... Esto puede tardar 1-2 minutos.');
  const electPath = path.join(uploadsDir, 'electors.csv');
  if (fs.existsSync(electPath)) {
    const insertElector = db.prepare(`
      INSERT OR REPLACE INTO electors (
        ci, nombre, apellido, fecha_nacimiento, sexo,
        departamento, distrito, ciudad, local_votacion, cod_local,
        direccion, barrio, mesa, orden, partido, tipo, edad,
        lat, lng, coordinador_asignado, status, is_priority, campaign_id,
        photo_ci_frente, photo_ci_verso, dpto_code, distrito_code, zona_code, local_code,
        fecha_inscripcion, es_indigena, tiene_discapacidad, detalles_discapacidad, inhabilitado
      ) VALUES (
        ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
      )
    `);

    const fileStream = fs.createReadStream(electPath);
    const rl = readline.createInterface({ input: fileStream, crlfDelay: Infinity });

    let batch: string[][] = [];
    let count = 0;
    const batchSize = 50000;

    const executeBatch = db.transaction((rows: string[][]) => {
      for (const row of rows) {
        let inhabilitado = parseInt(row[33]) || 0;
        // Si la CI está en el set de inhabilitados, forzar inhabilitado = 1
        if (inhabilitadosSet.has(row[0])) {
          inhabilitado = 1;
        }

        insertElector.run(
          row[0], // ci
          row[1], // nombre
          row[2], // apellido
          row[3], // fecha_nacimiento
          row[4], // sexo
          row[5], // departamento
          row[6], // distrito
          row[7], // ciudad
          row[8], // local_votacion
          row[9], // cod_local
          row[10], // direccion
          row[11], // barrio
          row[12] ? parseInt(row[12]) : 0, // mesa
          row[13] ? parseInt(row[13]) : 0, // orden
          row[14], // partido
          row[15], // tipo
          row[16] ? parseInt(row[16]) : null, // edad
          row[17] ? parseFloat(row[17]) : null, // lat
          row[18] ? parseFloat(row[18]) : null, // lng
          row[19], // coordinador_asignado
          row[20], // status
          row[21] ? parseInt(row[21]) : 0, // is_priority
          row[22] ? parseInt(row[22]) : null, // campaign_id
          row[23], // photo_ci_frente
          row[24], // photo_ci_verso
          row[25] ? parseInt(row[25]) : null, // dpto_code
          row[26] ? parseInt(row[26]) : null, // distrito_code
          row[27] ? parseInt(row[27]) : null, // zona_code
          row[28] ? parseInt(row[28]) : null, // local_code
          row[29], // fecha_inscripcion
          row[30], // es_indigena
          row[31], // tiene_discapacidad
          row[32], // detalles_discapacidad
          inhabilitado // inhabilitado
        );
      }
    });

    for await (const line of rl) {
      if (!line.trim()) continue;
      const row = parseCSVLine(line);
      if (row.length >= 34) {
        batch.push(row);
        count++;

        if (batch.length >= batchSize) {
          executeBatch(batch);
          console.log(`  Importados ${count} electores...`);
          batch = [];
        }
      }
    }

    if (batch.length > 0) {
      executeBatch(batch);
      console.log(`  Importados ${count} electores...`);
    }

    console.log(`Importación finalizada. Total electores: ${count}`);
  }

  // 5. Ejecutar VACUUM para optimizar espacio
  console.log('Optimizando base de datos (VACUUM)...');
  db.exec('VACUUM');
  console.log('Base de datos optimizada y compactada.');
  console.log('--- PROCESO COMPLETADO ---');
}

runImport().catch(err => {
  console.error('Error durante la importación:', err);
});
