import fs from 'fs';
import path from 'path';
import db from './db';

const XML_PATH = path.join(__dirname, '../temp_excel_extract/xl/worksheets/sheet1.xml');

if (!fs.existsSync(XML_PATH)) {
  console.error("No se encontró el archivo XML en", XML_PATH);
  console.error("Asegúrate de que el archivo fue extraído a temp_excel_extract.");
  process.exit(1);
}

// 1. Drop existing electors related tables to start fresh
console.log("Eliminando datos anteriores...");
db.exec('DROP TABLE IF EXISTS logistics');
db.exec('DROP TABLE IF EXISTS elector_locations');
db.exec('DROP TABLE IF EXISTS tenant_electors');
db.exec('DROP TABLE IF EXISTS electors');

// 2. Recreate them
console.log("Recreando tablas...");
db.exec(`
  CREATE TABLE IF NOT EXISTS electors (
    ci TEXT PRIMARY KEY,
    nombre TEXT NOT NULL,
    apellido TEXT,
    fecha_nacimiento TEXT,
    sexo TEXT,
    departamento TEXT DEFAULT 'AMAMBAY',
    distrito TEXT DEFAULT 'PEDRO JUAN CABALLERO',
    ciudad TEXT DEFAULT 'PEDRO JUAN CABALLERO',
    local_votacion TEXT NOT NULL,
    cod_local TEXT,
    direccion TEXT,
    barrio TEXT,
    mesa INTEGER NOT NULL,
    orden INTEGER NOT NULL,
    partido TEXT, -- Partido de afiliación original del padrón
    tipo TEXT,
    edad INTEGER,
    lat REAL,
    lng REAL,
    coordinador_asignado TEXT,
    status TEXT DEFAULT 'Pendiente',
    is_priority BOOLEAN DEFAULT 0,
    campaign_id INTEGER
  );

  CREATE TABLE IF NOT EXISTS tenant_electors (
    tenant_id INTEGER,
    elector_ci TEXT,
    needs_transport BOOLEAN DEFAULT 0,
    is_verified_address BOOLEAN DEFAULT 0,
    status TEXT DEFAULT 'Pendiente',
    last_visit DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY(tenant_id, elector_ci),
    FOREIGN KEY(tenant_id) REFERENCES tenants(id),
    FOREIGN KEY(elector_ci) REFERENCES electors(ci)
  );

  CREATE TABLE IF NOT EXISTS elector_locations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tenant_id INTEGER,
    elector_ci TEXT,
    lat REAL NOT NULL,
    lng REAL NOT NULL,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    is_home BOOLEAN DEFAULT 0,
    FOREIGN KEY(tenant_id) REFERENCES tenants(id),
    FOREIGN KEY(elector_ci) REFERENCES electors(ci)
  );

  CREATE TABLE IF NOT EXISTS logistics (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tenant_id INTEGER,
    elector_ci TEXT,
    unit_id INTEGER,
    status TEXT DEFAULT 'Pendiente de Recojo',
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(tenant_id) REFERENCES tenants(id),
    FOREIGN KEY(elector_ci) REFERENCES electors(ci),
    FOREIGN KEY(unit_id) REFERENCES units(id)
  );
`);

console.log("Leyendo archivo XML...");
const xmlData = fs.readFileSync(XML_PATH, 'utf-8');

// The columns in Excel are:
// A: CEDULA
// B: APELLIDO
// C: NOMBRE
// D: FECHA NAC.
// E: SEXO
// F: MESA
// G: ORD.MESA
// H: DIRECCION
// I: COD.LOCAL
// J: LOCAL
// K: TIPO
// L: EDAD

const decodeHTML = (str: string) => {
  if (!str) return str;
  return str
    .replace(/&#(\d+);/g, (match, dec) => String.fromCharCode(dec))
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
};

// Regex to find all rows
const rowRegex = /<row r="\d+">(.*?)<\/row>/g;

let match;
let isFirstRow = true;
const electorsToInsert: any[] = [];

console.log("Analizando XML...");

while ((match = rowRegex.exec(xmlData)) !== null) {
  if (isFirstRow) {
    isFirstRow = false;
    continue; // Skip header row
  }

  const rowData = match[1];
  
  // Extract columns
  // Cell structure is usually <c r="A2" ...><v>123</v></c> or <c ...><is><t>TEXT</t></is></c>
  const cellRegex = /<c r="([A-Z]+)\d+"[^>]*>(.*?)<\/c>/g;
  let cellMatch;
  
  const record: any = {
    ci: null,
    apellido: null,
    nombre: null,
    fecha_nac: null,
    sexo: null,
    mesa: 0,
    orden: 0,
    direccion: null,
    cod_local: null,
    local: null,
    tipo: null,
    edad: 0
  };
  
  while ((cellMatch = cellRegex.exec(rowData)) !== null) {
    const col = cellMatch[1]; // A, B, C, etc.
    const content = cellMatch[2];
    
    // Extract value from <v> or <t>
    let value = '';
    const valMatch = content?.match(/<v>(.*?)<\/v>/);
    if (valMatch?.[1]) {
      value = valMatch[1];
    } else {
      const textMatch = content?.match(/<t>(.*?)<\/t>/);
      if (textMatch?.[1]) {
        value = textMatch[1];
      }
    }
    
    value = decodeHTML(value).trim();
    
    switch(col) {
      case 'A': record.ci = value; break;
      case 'B': record.apellido = value; break;
      case 'C': record.nombre = value; break;
      case 'D': record.fecha_nac = value; break;
      case 'E': record.sexo = value; break;
      case 'F': record.mesa = parseInt(value) || 0; break;
      case 'G': record.orden = parseInt(value) || 0; break;
      case 'H': record.direccion = value; break;
      case 'I': record.cod_local = value; break;
      case 'J': record.local = value; break;
      case 'K': record.tipo = value; break;
      case 'L': record.edad = parseInt(value) || 0; break;
    }
  }
  
  if (record.ci) {
    electorsToInsert.push(record);
  }
}

console.log(`Encontrados ${electorsToInsert.length} electores. Insertando en la base de datos...`);

const insertStmt = db.prepare(`
  INSERT INTO electors (
    ci, nombre, apellido, fecha_nacimiento, sexo, 
    local_votacion, cod_local, direccion, 
    mesa, orden, tipo, edad
  ) VALUES (
    @ci, @nombre, @apellido, @fecha_nac, @sexo,
    @local, @cod_local, @direccion,
    @mesa, @orden, @tipo, @edad
  )
`);

const insertMany = db.transaction((electors) => {
  for (const elector of electors) {
    insertStmt.run(elector);
  }
});

try {
  insertMany(electorsToInsert);
  console.log("¡Importación completada con éxito!");
} catch (error) {
  console.error("Error durante la inserción masiva:", error);
}
