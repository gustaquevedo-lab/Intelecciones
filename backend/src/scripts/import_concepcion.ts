import Database from 'better-sqlite3';
import * as XLSX from 'xlsx';
import path from 'path';
import fs from 'fs';
import { normalizePhone } from '../utils/phone';

const dbPath = path.resolve(process.cwd(), 'intellecciones.db');
const excelPath = path.resolve(process.cwd(), '../CONCEPCION APODERADOS Y MIEMBROS DE MESAS - APP.xlsx');

console.log("Database path:", dbPath);
console.log("Excel path:", excelPath);

if (!fs.existsSync(dbPath)) {
  console.error("Database file not found!");
  process.exit(1);
}
if (!fs.existsSync(excelPath)) {
  console.error("Excel file not found!");
  process.exit(1);
}

const db = new Database(dbPath);

// Ensure Concepcion district and local exists or determine it
// Let's query voting_locations or electors to find Concepcion local.
let localCod = 'LOC_CONCEPCION';
let localNombre = 'INSTITUTO SALESIANO SAN JOSE';
let distrito = 'CONCEPCION';

const existingLocal = db.prepare("SELECT cod_local, nombre, distrito FROM voting_locations WHERE distrito LIKE '%CONCEPCION%' OR nombre LIKE '%SALESIANO%' LIMIT 1").get() as any;
if (existingLocal) {
  localCod = existingLocal.cod_local;
  localNombre = existingLocal.nombre;
  distrito = existingLocal.distrito;
  console.log(`Found existing voting local in DB: ${localNombre} (${localCod}) for district: ${distrito}`);
} else {
  // Let's create it if it doesn't exist
  console.log(`No local found for Concepcion. Registering default local: ${localNombre}`);
  db.prepare(`
    INSERT OR IGNORE INTO voting_locations (cod_local, nombre, lat, lng, direccion, icon, distrito, ciudad)
    VALUES (?, ?, -23.408, -57.438, 'Concepción', 'Landmark', 'CONCEPCION', 'CONCEPCION')
  `).run(localCod, localNombre);
}

const workbook = XLSX.readFile(excelPath);
const sheet = workbook.Sheets[workbook.SheetNames[0]];
const rows = XLSX.utils.sheet_to_json(sheet) as any[];

const usersToImport: any[] = [];
let currentCargo = '';

const isDryRun = process.argv.includes('--dry-run');

for (const row of rows) {
  const cargoCol = row['APODERADOS Y MIEMBROS DE MESAS CONCEPCION- LOCAL SALESIANO SAN JOSE'];
  const nameCol = row['__EMPTY'];
  const ciCol = row['__EMPTY_1'];
  const phoneCol = row['__EMPTY_2'];

  if (!nameCol || nameCol === 'NOMBRES Y APELLIDOS') {
    continue;
  }

  if (cargoCol) {
    currentCargo = String(cargoCol).trim();
  }

  const cleanCI = String(ciCol).replace(/\D/g, '');
  if (!cleanCI) continue;

  const phoneStr = phoneCol ? String(phoneCol) : '';
  const normalizedPhoneVal = normalizePhone(phoneStr);

  // Determine role and mesa
  let role = 'MIEMBRO_MESA';
  let mesaNum: number | null = null;

  if (currentCargo.includes('APODERADO')) {
    role = 'APODERADO';
  } else if (!isNaN(Number(currentCargo))) {
    role = 'MIEMBRO_MESA';
    mesaNum = Number(currentCargo);
  } else if (currentCargo === 'MESA') {
    role = 'MIEMBRO_MESA';
  }

  // Look up exact name from padron (electors table)
  let dbName = String(nameCol).trim();
  const elector = db.prepare('SELECT nombre, apellido FROM electors WHERE ci = ?').get(cleanCI) as any;
  if (elector) {
    dbName = `${elector.nombre} ${elector.apellido || ''}`.trim().toUpperCase();
  } else {
    console.log(`[Padrón Missing] CI ${cleanCI} (${dbName}) not found in electors table, using name from Excel.`);
  }

  usersToImport.push({
    username: cleanCI,
    password: cleanCI,
    role,
    nombre: dbName,
    telefono: normalizedPhoneVal || null,
    ci: cleanCI,
    assigned_local: localNombre,
    assigned_mesa: mesaNum,
    distrito: distrito
  });
}

console.log(`Total users parsed from Excel: ${usersToImport.length}`);

if (isDryRun) {
  console.log("=== DRY RUN (No writes performed) ===");
  console.log(JSON.stringify(usersToImport.slice(0, 5), null, 2));
  console.log(`... and ${usersToImport.length - 5} more users`);
} else {
  const insertStmt = db.prepare(`
    INSERT OR REPLACE INTO users (
      username, password, role, nombre, telefono, ci, 
      assigned_local, assigned_mesa, distrito, status, needs_password_change
    ) VALUES (
      @username, @password, @role, @nombre, @telefono, @ci,
      @assigned_local, @assigned_mesa, @distrito, 'ACTIVE', 0
    )
  `);

  const insertTransaction = db.transaction((users) => {
    let count = 0;
    for (const u of users) {
      insertStmt.run(u);
      count++;
    }
    return count;
  });

  const count = insertTransaction(usersToImport);
  console.log(`Successfully imported/updated ${count} users into the database.`);
}
