import * as fs from 'fs';
import * as path from 'path';
import Database from 'better-sqlite3';

const dataDir = path.join(__dirname, '../../../PADRON ACTUAL/data');
const dbPath = path.join(__dirname, '../../intellecciones.db');

console.log('===============================================================');
console.log('--- INICIANDO RESET Y MIGRACIÓN LIMPIA: ELECCIONES GENERALES ---');
console.log('===============================================================');
console.log('Ruta de Datos DBF:', dataDir);
console.log('Ruta de BD SQLite:', dbPath);

if (!fs.existsSync(dataDir)) {
  console.error('ERROR CRÍTICO: No se encuentra la carpeta de datos DBF en:', dataDir);
  process.exit(1);
}

// 1. Conectar a SQLite
const db = new Database(dbPath);
db.pragma('journal_mode = WAL');
db.pragma('synchronous = OFF'); // Súper rápido para importación masiva
db.pragma('cache_size = -131072'); // 128 MB RAM cache
db.pragma('temp_store = MEMORY');

// 2. WIPE Y RECREACIÓN DE TABLAS
console.log('Limpiando tablas anteriores (WIPE)...');

db.pragma('foreign_keys = OFF');

db.exec(`
  DROP TABLE IF EXISTS tenant_electors;
  DROP TABLE IF EXISTS elector_locations;
  DROP TABLE IF EXISTS logistics;
  DROP TABLE IF EXISTS results;
  DROP TABLE IF EXISTS voter_confirmations;
  DROP TABLE IF EXISTS mesa_constitutions;
  DROP TABLE IF EXISTS desafiliaciones;
  DROP TABLE IF EXISTS voting_locations;
  DROP TABLE IF EXISTS electors;
  DROP TABLE IF EXISTS lists;
  DROP TABLE IF EXISTS users;
  DROP TABLE IF EXISTS campaigns;

  -- Tabla Padrón General
  CREATE TABLE electors (
    ci TEXT PRIMARY KEY,
    nombre TEXT NOT NULL,
    apellido TEXT NOT NULL,
    sexo TEXT,
    fecha_nacimiento TEXT,
    edad INTEGER,
    departamento TEXT,
    distrito TEXT,
    ciudad TEXT,
    local_votacion TEXT NOT NULL,
    cod_local TEXT NOT NULL,
    mesa INTEGER NOT NULL,
    orden INTEGER NOT NULL,
    inhabilitado BOOLEAN DEFAULT 0,
    pol_mil BOOLEAN DEFAULT 0,
    interdicto BOOLEAN DEFAULT 0,
    fiscales BOOLEAN DEFAULT 0,
    es_indigen BOOLEAN DEFAULT 0,
    tiene_disc BOOLEAN DEFAULT 0,
    ref_discap TEXT,
    fec_inscri TEXT
  );

  -- Tabla Desafiliaciones
  CREATE TABLE desafiliaciones (
    ci TEXT PRIMARY KEY,
    partido_id INTEGER,
    fecha TEXT
  );

  -- Tabla Locales de Votación
  CREATE TABLE voting_locations (
    code TEXT PRIMARY KEY,
    departamento TEXT,
    distrito TEXT,
    zona TEXT,
    local_id INTEGER,
    name TEXT NOT NULL,
    lat REAL,
    lng REAL,
    total_electores INTEGER DEFAULT 0,
    total_mesas INTEGER DEFAULT 0
  );

  -- Tabla Campañas / Tenants
  CREATE TABLE campaigns (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    enabled_modules TEXT DEFAULT 'COMMAND_CENTER,REGISTRY',
    status TEXT DEFAULT 'ACTIVE',
    slogan TEXT,
    photo_url TEXT,
    distrito TEXT,
    goal INTEGER DEFAULT 1000
  );

  -- Tabla Listas
  CREATE TABLE lists (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    campaign_id INTEGER,
    type TEXT NOT NULL,
    list_number TEXT,
    option_number TEXT,
    candidate_ci TEXT,
    candidate_nombre TEXT,
    candidate_alias TEXT,
    goal INTEGER DEFAULT 1000,
    photo_url TEXT,
    ciudad TEXT DEFAULT '',
    is_adversary INTEGER DEFAULT 0,
    FOREIGN KEY(campaign_id) REFERENCES campaigns(id)
  );

  -- Tabla Usuarios
  CREATE TABLE users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password TEXT,
    role TEXT NOT NULL,
    assigned_list_id INTEGER,
    assigned_campaign_id INTEGER,
    assigned_local TEXT,
    assigned_mesa INTEGER,
    assigned_table_role TEXT,
    nombre TEXT,
    photo_url TEXT,
    needs_password_change INTEGER DEFAULT 0,
    parent_id INTEGER,
    telefono TEXT,
    phone_hash TEXT,
    distrito TEXT,
    ci TEXT,
    status TEXT DEFAULT 'ACTIVE',
    FOREIGN KEY(assigned_list_id) REFERENCES lists(id),
    FOREIGN KEY(assigned_campaign_id) REFERENCES campaigns(id),
    FOREIGN KEY(parent_id) REFERENCES users(id)
  );

  -- Tabla Multi-Tenant de Electores Asignados
  CREATE TABLE IF NOT EXISTS tenant_electors (
    tenant_id INTEGER,
    elector_ci TEXT,
    status TEXT DEFAULT 'Pendiente',
    needs_transport BOOLEAN DEFAULT 0,
    is_verified_address BOOLEAN DEFAULT 0,
    notes TEXT,
    assigned_coordinador_id INTEGER,
    last_update DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY(tenant_id, elector_ci),
    FOREIGN KEY(elector_ci) REFERENCES electors(ci)
  );

  -- Crear usuario SuperAdmin único limpio
  INSERT INTO users (username, password, role, nombre, ci, telefono, status, needs_password_change)
  VALUES ('3657834', '123456', 'SUPERUSUARIO', 'Gustavo Quevedo', '3657834', '+595981123456', 'ACTIVE', 0);
  
  INSERT INTO users (username, password, role, nombre, ci, telefono, status, needs_password_change)
  VALUES ('admin', '123456', 'SUPERADMIN', 'Super Administrador', '1234567', '+595981123456', 'ACTIVE', 0);
`);

console.log('Tablas recreadas correctamente.');

// Helper para parsear DBF Header
interface DBFField {
  name: string;
  type: string;
  length: number;
  offset: number;
}

function parseDbfHeader(filePath: string) {
  const fd = fs.openSync(filePath, 'r');
  const buffer = Buffer.alloc(32);
  fs.readSync(fd, buffer, 0, 32, 0);

  const numRecords = buffer.readInt32LE(4);
  const headerLength = buffer.readInt16LE(8);
  const recordLength = buffer.readInt16LE(10);

  const fields: DBFField[] = [];
  let pos = 32;
  const fieldBuffer = Buffer.alloc(32);
  let currentOffset = 1;

  while (pos < headerLength) {
    fs.readSync(fd, fieldBuffer, 0, 32, pos);
    if (fieldBuffer[0] === 0x0d) break;
    const name = fieldBuffer.toString('ascii', 0, 11).replace(/\0/g, '').trim();
    const type = String.fromCharCode(fieldBuffer[11]);
    const length = fieldBuffer[16];
    fields.push({ name, type, length, offset: currentOffset });
    currentOffset += length;
    pos += 32;
  }
  fs.closeSync(fd);
  return { numRecords, headerLength, recordLength, fields };
}

function formatDate(str: string): string {
  if (!str || str.length !== 8) return '';
  return `${str.substring(0, 4)}-${str.substring(4, 6)}-${str.substring(6, 8)}`;
}

// 3. Cargar Geografía y Locales
console.log('Cargando geografía electoral (dep.dbf, dis.dbf, zon.dbf, loc.dbf)...');

const departments: Record<number, string> = {};
const districts: Record<string, string> = {};

// dep.dbf
const depPath = path.join(dataDir, 'dep.dbf');
if (fs.existsSync(depPath)) {
  const h = parseDbfHeader(depPath);
  const fd = fs.openSync(depPath, 'r');
  const buf = Buffer.alloc(h.recordLength);
  for (let i = 0; i < h.numRecords; i++) {
    fs.readSync(fd, buf, 0, h.recordLength, h.headerLength + i * h.recordLength);
    if (buf[0] === 0x2a) continue;
    const dep = parseInt(buf.toString('ascii', 1, 3).trim()) || 0;
    const desc = buf.toString('ascii', 3, 18).trim().toUpperCase();
    departments[dep] = desc;
  }
  fs.closeSync(fd);
}

// dis.dbf
const disPath = path.join(dataDir, 'dis.dbf');
if (fs.existsSync(disPath)) {
  const h = parseDbfHeader(disPath);
  const fd = fs.openSync(disPath, 'r');
  const buf = Buffer.alloc(h.recordLength);
  for (let i = 0; i < h.numRecords; i++) {
    fs.readSync(fd, buf, 0, h.recordLength, h.headerLength + i * h.recordLength);
    if (buf[0] === 0x2a) continue;
    const dep = parseInt(buf.toString('ascii', 1, 3).trim()) || 0;
    const dist = parseInt(buf.toString('ascii', 3, 5).trim()) || 0;
    const desc = buf.toString('ascii', 5, 55).trim().toUpperCase();
    districts[`${dep}-${dist}`] = desc;
  }
  fs.closeSync(fd);
}

// loc.dbf -> voting_locations
const locPath = path.join(dataDir, 'loc.dbf');
const insertLoc = db.prepare(`
  INSERT OR REPLACE INTO voting_locations (code, departamento, distrito, zona, local_id, name)
  VALUES (?, ?, ?, ?, ?, ?)
`);

db.transaction(() => {
  if (fs.existsSync(locPath)) {
    const h = parseDbfHeader(locPath);
    const fd = fs.openSync(locPath, 'r');
    const buf = Buffer.alloc(h.recordLength);
    for (let i = 0; i < h.numRecords; i++) {
      fs.readSync(fd, buf, 0, h.recordLength, h.headerLength + i * h.recordLength);
      if (buf[0] === 0x2a) continue;
      const dpto = parseInt(buf.toString('ascii', 1, 3).trim()) || 0;
      const dist = parseInt(buf.toString('ascii', 3, 5).trim()) || 0;
      const zona = parseInt(buf.toString('ascii', 5, 7).trim()) || 0;
      const local = parseInt(buf.toString('ascii', 7, 10).trim()) || 0;
      const desc = buf.toString('ascii', 10, 110).trim().toUpperCase();

      const code = `${dpto}-${dist}-${zona}-${local}`;
      const dptoName = departments[dpto] || '';
      const distName = districts[`${dpto}-${dist}`] || '';

      insertLoc.run(code, dptoName, distName, String(zona), local, desc);
    }
    fs.closeSync(fd);
  }
})();
console.log('Locales de votación insertados.');

// 4. Cargar Inhabilitados CIs
console.log('Cargando inhabilitados (inhabilitados.dbf)...');
const inhabilitadosSet = new Set<string>();
const inhPath = path.join(dataDir, 'inhabilitados.dbf');
if (fs.existsSync(inhPath)) {
  const h = parseDbfHeader(inhPath);
  const fd = fs.openSync(inhPath, 'r');
  const buf = Buffer.alloc(h.recordLength);
  const ciField = h.fields.find(f => f.name === 'CEDULA');
  if (ciField) {
    for (let i = 0; i < h.numRecords; i++) {
      fs.readSync(fd, buf, 0, h.recordLength, h.headerLength + i * h.recordLength);
      if (buf[0] === 0x2a) continue;
      const ci = buf.toString('ascii', ciField.offset, ciField.offset + ciField.length).trim();
      if (ci) inhabilitadosSet.add(ci);
    }
  }
  fs.closeSync(fd);
}
console.log(`Cargados ${inhabilitadosSet.size} CIs de inhabilitados.`);

// 5. Cargar Desafiliaciones
console.log('Cargando desafiliaciones (desafiliaciones.dbf)...');
const insertDesaf = db.prepare(`INSERT OR IGNORE INTO desafiliaciones (ci, partido_id, fecha) VALUES (?, ?, ?)`);
const desPath = path.join(dataDir, 'desafiliaciones.dbf');
if (fs.existsSync(desPath)) {
  db.transaction(() => {
    const h = parseDbfHeader(desPath);
    const fd = fs.openSync(desPath, 'r');
    const buf = Buffer.alloc(h.recordLength);
    for (let i = 0; i < h.numRecords; i++) {
      fs.readSync(fd, buf, 0, h.recordLength, h.headerLength + i * h.recordLength);
      if (buf[0] === 0x2a) continue;
      const ci = buf.toString('ascii', 1, 9).trim();
      const partido = parseInt(buf.toString('ascii', 100, 105).trim()) || 0;
      const fecha = formatDate(buf.toString('ascii', 70, 78).trim());
      if (ci) insertDesaf.run(ci, partido, fecha);
    }
    fs.closeSync(fd);
  })();
}
console.log('Desafiliaciones cargadas.');

// 6. Cargar Padrón General (`regciv.dbf`) con MESA (TALON) y ORDEN (1..N)
console.log('Procesando Padrón General (regciv.dbf)...');
const regPath = path.join(dataDir, 'regciv.dbf');

if (!fs.existsSync(regPath)) {
  console.error('ERROR CRÍTICO: No existe regciv.dbf');
  process.exit(1);
}

const h = parseDbfHeader(regPath);
const fd = fs.openSync(regPath, 'r');
const recBuf = Buffer.alloc(h.recordLength);

const fMap: Record<string, DBFField> = {};
h.fields.forEach(f => { fMap[f.name] = f; });

const getVal = (buf: Buffer, name: string): string => {
  const f = fMap[name];
  if (!f) return '';
  return buf.toString('ascii', f.offset, f.offset + f.length).trim();
};

const getNum = (buf: Buffer, name: string): number => {
  const v = getVal(buf, name);
  return parseInt(v) || 0;
};

const insertElector = db.prepare(`
  INSERT OR REPLACE INTO electors (
    ci, nombre, apellido, sexo, fecha_nacimiento, edad,
    departamento, distrito, ciudad, local_votacion, cod_local,
    mesa, orden, inhabilitado, pol_mil, interdicto, fiscales,
    es_indigen, tiene_disc, ref_discap, fec_inscri
  ) VALUES (
    ?, ?, ?, ?, ?, ?,
    ?, ?, ?, ?, ?,
    ?, ?, ?, ?, ?, ?,
    ?, ?, ?, ?
  )
`);

const mesaOrdenMap = new Map<string, number>();
const localNamesMap: Record<string, string> = {};

// Cargar nombres de locales en memoria
const locRows = db.prepare('SELECT code, name FROM voting_locations').all() as any[];
locRows.forEach(r => { localNamesMap[r.code] = r.name; });

const currentYear = new Date().getFullYear();
let processed = 0;
const batchSize = 100000;

const insertBatch = db.transaction((rows: any[]) => {
  for (const r of rows) {
    insertElector.run(...r);
  }
});

let currentBatch: any[] = [];

for (let i = 0; i < h.numRecords; i++) {
  fs.readSync(fd, recBuf, 0, h.recordLength, h.headerLength + i * h.recordLength);
  if (recBuf[0] === 0x2a) continue;

  const ci = getVal(recBuf, 'CEDULA');
  if (!ci) continue;

  const nombre = getVal(recBuf, 'NOMBRE').toUpperCase();
  const apellido = getVal(recBuf, 'APELLIDO').toUpperCase();
  const sexo = getVal(recBuf, 'SEXO').toUpperCase();
  const fecNac = formatDate(getVal(recBuf, 'FEC_NAC'));
  const fecInscri = formatDate(getVal(recBuf, 'FEC_INSCRI'));

  const dpto = getNum(recBuf, 'DEPART');
  const dist = getNum(recBuf, 'DISTRITO');
  const zona = getNum(recBuf, 'ZONA');
  const local = getNum(recBuf, 'LOCAL');
  const code = `${dpto}-${dist}-${zona}-${local}`;

  const dptoName = departments[dpto] || '';
  const distName = districts[`${dpto}-${dist}`] || '';
  const localName = localNamesMap[code] || `LOCAL COD: ${code}`;

  // MESA y ORDEN determinista
  const talon = getNum(recBuf, 'TALON');
  const mesa = talon > 0 ? talon : 1;
  const mesaKey = `${code}-${mesa}`;
  const orden = (mesaOrdenMap.get(mesaKey) || 0) + 1;
  mesaOrdenMap.set(mesaKey, orden);

  // Inhabilitaciones y condiciones especiales
  const isBanned = inhabilitadosSet.has(ci) ? 1 : 0;
  const polMil = getVal(recBuf, 'POL_MIL').toUpperCase() === 'S' ? 1 : 0;
  const interdicto = getVal(recBuf, 'INTERDICTO').toUpperCase() === 'S' ? 1 : 0;
  const fiscales = getVal(recBuf, 'FISCALES').toUpperCase() === 'S' ? 1 : 0;
  const esIndigen = getVal(recBuf, 'ES_INDIGEN').toUpperCase() === 'S' ? 1 : 0;
  const tieneDisc = getVal(recBuf, 'TIENE_DISC').toUpperCase() === 'S' ? 1 : 0;
  const refDiscap = getVal(recBuf, 'REF_DISCAP');

  let edad: number | null = null;
  if (fecNac) {
    const birthYear = parseInt(fecNac.substring(0, 4));
    if (birthYear) edad = currentYear - birthYear;
  }

  currentBatch.push([
    ci, nombre, apellido, sexo, fecNac, edad,
    dptoName, distName, distName, localName, code,
    mesa, orden, isBanned, polMil, interdicto, fiscales,
    esIndigen, tieneDisc, refDiscap, fecInscri
  ]);

  processed++;

  if (currentBatch.length >= batchSize) {
    insertBatch(currentBatch);
    currentBatch = [];
    console.log(`  Procesados ${processed} de ${h.numRecords} electores...`);
  }
}

if (currentBatch.length > 0) {
  insertBatch(currentBatch);
  currentBatch = [];
}
fs.closeSync(fd);

console.log(`ÉXITO: Se insertaron ${processed} electores.`);

// 7. CREACIÓN DE ÍNDICES DE ALTO RENDIMIENTO
console.log('Creando índices de búsqueda acelerados...');
db.exec(`
  CREATE UNIQUE INDEX IF NOT EXISTS idx_electors_ci ON electors(ci);
  CREATE INDEX IF NOT EXISTS idx_electors_nombre_apellido ON electors(apellido, nombre);
  CREATE INDEX IF NOT EXISTS idx_electors_local_mesa ON electors(cod_local, mesa, orden);
  CREATE INDEX IF NOT EXISTS idx_electors_dpto_dist ON electors(departamento, distrito);
`);

// Restablecer pragmas de sincronización
db.pragma('synchronous = NORMAL');

console.log('===============================================================');
console.log('--- RESET MIGRACIÓN LIMPIA COMPLETADA CON ÉXITO Y 0 ERRORES ---');
console.log('===============================================================');
