import * as fs from 'fs';
import * as path from 'path';

interface DBFField {
  name: string;
  type: string;
  length: number;
  offset: number;
}

interface DBFHeader {
  numRecords: number;
  headerLength: number;
  recordLength: number;
  fields: DBFField[];
}

function parseDbfHeader(filePath: string): DBFHeader {
  const fd = fs.openSync(filePath, 'r');
  const buffer = Buffer.alloc(32);
  fs.readSync(fd, buffer, 0, 32, 0);

  const numRecords = buffer.readInt32LE(4);
  const headerLength = buffer.readInt16LE(8);
  const recordLength = buffer.readInt16LE(10);

  const fields: DBFField[] = [];
  let position = 32;
  const fieldBuffer = Buffer.alloc(32);
  let currentOffset = 1; // starts at 1 because byte 0 is the deletion flag

  while (position < headerLength) {
    fs.readSync(fd, fieldBuffer, 0, 32, position);
    if (fieldBuffer[0] === 0x0d) {
      break;
    }
    const name = fieldBuffer.toString('ascii', 0, 11).replace(/\0/g, '').trim();
    const type = String.fromCharCode(fieldBuffer[11]);
    const length = fieldBuffer[16];
    fields.push({ name, type, length, offset: currentOffset });
    currentOffset += length;
    position += 32;
  }
  fs.closeSync(fd);

  return { numRecords, headerLength, recordLength, fields };
}

// Convert YYYYMMDD string to YYYY-MM-DD
function formatDate(str: string): string {
  if (!str || str.length !== 8) return '';
  const y = str.substring(0, 4);
  const m = str.substring(4, 6);
  const d = str.substring(6, 8);
  return `${y}-${m}-${d}`;
}

// Escape CSV string value according to RFC 4180
function escapeCSV(val: any): string {
  if (val === null || val === undefined) return '';
  let str = String(val).trim();
  // Remove control characters and clean double quotes
  str = str.replace(/"/g, '""');
  if (str.includes(',') || str.includes('\n') || str.includes('\r') || str.includes('"')) {
    return `"${str}"`;
  }
  return str;
}

const dataDir = '/Users/gustaquevedo/Library/CloudStorage/OneDrive-Personal/Dev/Intelecciones/PADRON ACTUAL/data';
const outputDir = '/Users/gustaquevedo/Library/CloudStorage/OneDrive-Personal/Dev/Intelecciones/backend/uploads'; // temporary directory inside project

if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

async function convertDbfToCsv() {
  console.log('--- INICIANDO CONVERSIÓN DE PADRÓN TSJE (DBF A CSV) ---');

  // 1. Cargar Catálogos territoriales
  console.log('Cargando diccionarios de departamentos y distritos...');
  const departments: { [key: number]: string } = {};
  const districts: { [key: string]: string } = {}; // Key: "dpto_code-dist_code"
  const zones: { [key: string]: string } = {}; // Key: "dpto_code-dist_code-zone_code"
  
  // Leer dep.dbf
  const depPath = path.join(dataDir, 'dep.dbf');
  if (fs.existsSync(depPath)) {
    const header = parseDbfHeader(depPath);
    const fd = fs.openSync(depPath, 'r');
    const recBuf = Buffer.alloc(header.recordLength);
    for (let i = 0; i < header.numRecords; i++) {
      fs.readSync(fd, recBuf, 0, header.recordLength, header.headerLength + i * header.recordLength);
      if (recBuf[0] === 0x2a) continue; // deleted record
      const depart = parseInt(recBuf.toString('ascii', 1, 3).trim()) || 0;
      const descrip = recBuf.toString('ascii', 3, 18).trim();
      departments[depart] = descrip.toUpperCase();
    }
    fs.closeSync(fd);
    console.log(`Cargados ${Object.keys(departments).length} departamentos.`);
  }

  // Leer dis.dbf
  const disPath = path.join(dataDir, 'dis.dbf');
  if (fs.existsSync(disPath)) {
    const header = parseDbfHeader(disPath);
    const fd = fs.openSync(disPath, 'r');
    const recBuf = Buffer.alloc(header.recordLength);
    for (let i = 0; i < header.numRecords; i++) {
      fs.readSync(fd, recBuf, 0, header.recordLength, header.headerLength + i * header.recordLength);
      if (recBuf[0] === 0x2a) continue;
      const depart = parseInt(recBuf.toString('ascii', 1, 3).trim()) || 0;
      const dist = parseInt(recBuf.toString('ascii', 3, 5).trim()) || 0;
      const descrip = recBuf.toString('ascii', 5, 55).trim();
      districts[`${depart}-${dist}`] = descrip.toUpperCase();
    }
    fs.closeSync(fd);
    console.log(`Cargados ${Object.keys(districts).length} distritos.`);
  }

  // Leer zon.dbf
  const zonPath = path.join(dataDir, 'zon.dbf');
  if (fs.existsSync(zonPath)) {
    const header = parseDbfHeader(zonPath);
    const fd = fs.openSync(zonPath, 'r');
    const recBuf = Buffer.alloc(header.recordLength);
    for (let i = 0; i < header.numRecords; i++) {
      fs.readSync(fd, recBuf, 0, header.recordLength, header.headerLength + i * header.recordLength);
      if (recBuf[0] === 0x2a) continue;
      const depart = parseInt(recBuf.toString('ascii', 1, 3).trim()) || 0;
      const dist = parseInt(recBuf.toString('ascii', 3, 5).trim()) || 0;
      const zone = parseInt(recBuf.toString('ascii', 5, 7).trim()) || 0;
      const descrip = recBuf.toString('ascii', 7, 67).trim();
      zones[`${depart}-${dist}-${zone}`] = descrip.toUpperCase();
    }
    fs.closeSync(fd);
    console.log(`Cargadas ${Object.keys(zones).length} zonas.`);
  }

  // 2. Procesar loc.dbf -> voting_locations.csv
  console.log('Procesando Locales de Votación (loc.dbf)...');
  const locPath = path.join(dataDir, 'loc.dbf');
  const votingLocationsCsvPath = path.join(outputDir, 'voting_locations.csv');
  const locStream = fs.createWriteStream(votingLocationsCsvPath);
  
  // No headers written for direct SQLite import
  
  const locationsMap: { [key: string]: string } = {}; // composite code -> local name

  if (fs.existsSync(locPath)) {
    const header = parseDbfHeader(locPath);
    const fd = fs.openSync(locPath, 'r');
    const recBuf = Buffer.alloc(header.recordLength);
    for (let i = 0; i < header.numRecords; i++) {
      fs.readSync(fd, recBuf, 0, header.recordLength, header.headerLength + i * header.recordLength);
      if (recBuf[0] === 0x2a) continue;
      
      const dpto = parseInt(recBuf.toString('ascii', 1, 3).trim()) || 0;
      const dist = parseInt(recBuf.toString('ascii', 3, 5).trim()) || 0;
      const zona = parseInt(recBuf.toString('ascii', 5, 7).trim()) || 0;
      const local = parseInt(recBuf.toString('ascii', 7, 10).trim()) || 0;
      const descrip = recBuf.toString('ascii', 10, 110).trim().toUpperCase();

      const code = `${dpto}-${dist}-${zona}-${local}`;
      locationsMap[code] = descrip;

      const dptoName = departments[dpto] || '';
      const distName = districts[`${dpto}-${dist}`] || '';

      const line = [
        code, // cod_local
        descrip, // nombre
        '', // lat
        '', // lng
        '', // direccion
        'Landmark', // icon
        distName, // distrito
        distName, // ciudad
        '', // campaign_id
        dptoName, // departamento
        dist, // distrito_id
        zona, // zona_id
        local // local_id
      ].map(escapeCSV).join(',') + '\n';
      
      locStream.write(line);
    }
    fs.closeSync(fd);
  }
  locStream.end();
  console.log('Locales de votación exportados a CSV.');

  // 3. Procesar desafiliaciones.dbf o inhabilitados.dbf -> inhabilitados.csv
  console.log('Procesando Inhabilitados (inhabilitados.dbf)...');
  const inhPath = path.join(dataDir, 'inhabilitados.dbf');
  const inhabilitadosCsvPath = path.join(outputDir, 'inhabilitados.csv');
  const inhStream = fs.createWriteStream(inhabilitadosCsvPath);
  // No headers written

  if (fs.existsSync(inhPath)) {
    const header = parseDbfHeader(inhPath);
    const fd = fs.openSync(inhPath, 'r');
    const recBuf = Buffer.alloc(header.recordLength);
    for (let i = 0; i < header.numRecords; i++) {
      fs.readSync(fd, recBuf, 0, header.recordLength, header.headerLength + i * header.recordLength);
      if (recBuf[0] === 0x2a) continue;
      
      const cedulaField = header.fields.find(f => f.name === 'CEDULA');
      if (cedulaField) {
        const ciVal = recBuf.toString('ascii', cedulaField.offset, cedulaField.offset + cedulaField.length).trim();
        if (ciVal) {
          inhStream.write(`${ciVal}\n`);
        }
      }
    }
    fs.closeSync(fd);
  }
  inhStream.end();
  console.log('Inhabilitados exportados a CSV.');

  // 4. Procesar regciv.dbf -> electors.csv (5 millones de registros)
  console.log('Procesando Padrón General (regciv.dbf). Esto tomará unos momentos...');
  const regcivPath = path.join(dataDir, 'regciv.dbf');
  const electorsCsvPath = path.join(outputDir, 'electors.csv');
  const electStream = fs.createWriteStream(electorsCsvPath);
  
  // No headers written

  if (fs.existsSync(regcivPath)) {
    const header = parseDbfHeader(regcivPath);
    const fd = fs.openSync(regcivPath, 'r');
    
    const recBuf = Buffer.alloc(header.recordLength);
    const batchSize = 100000;
    let processed = 0;
    
    const fMap: { [name: string]: DBFField } = {};
    header.fields.forEach(f => { fMap[f.name] = f; });

    const getFieldVal = (buf: Buffer, name: string): string => {
      const f = fMap[name];
      if (!f) return '';
      return buf.toString('ascii', f.offset, f.offset + f.length).trim();
    };

    const getFieldNum = (buf: Buffer, name: string): number => {
      const v = getFieldVal(buf, name);
      return parseInt(v) || 0;
    };

    const mesaOrdenCounter = new Map<string, number>();

    for (let i = 0; i < header.numRecords; i++) {
      fs.readSync(fd, recBuf, 0, header.recordLength, header.headerLength + i * header.recordLength);
      if (recBuf[0] === 0x2a) continue;

      const ci = getFieldVal(recBuf, 'CEDULA');
      if (!ci) continue;

      const nombre = getFieldVal(recBuf, 'NOMBRE').toUpperCase();
      const apellido = getFieldVal(recBuf, 'APELLIDO').toUpperCase();
      const sexo = getFieldVal(recBuf, 'SEXO').toUpperCase();
      const fecNacRaw = getFieldVal(recBuf, 'FEC_NAC');
      const fecNac = formatDate(fecNacRaw);
      const fecInsc = formatDate(getFieldVal(recBuf, 'FEC_INSCRI'));

      const dpto = getFieldNum(recBuf, 'DEPART');
      const dist = getFieldNum(recBuf, 'DISTRITO');
      const zona = getFieldNum(recBuf, 'ZONA');
      const local = getFieldNum(recBuf, 'LOCAL');
      
      const code = `${dpto}-${dist}-${zona}-${local}`;
      const localName = locationsMap[code] || `LOCAL COD: ${code}`;
      
      const dptoName = departments[dpto] || '';
      const distName = districts[`${dpto}-${dist}`] || '';

      const mesa = getFieldNum(recBuf, 'TALON') || 1;
      const mesaKey = `${code}-${mesa}`;
      const orden = (mesaOrdenCounter.get(mesaKey) || 0) + 1;
      mesaOrdenCounter.set(mesaKey, orden);
      
      const esIndigen = getFieldVal(recBuf, 'ES_INDIGEN').toUpperCase();
      const tieneDisc = getFieldVal(recBuf, 'TIENE_DISC').toUpperCase();
      const refDiscap = getFieldVal(recBuf, 'REF_DISCAP');

      const polMil = getFieldVal(recBuf, 'POL_MIL').toUpperCase();
      const interdicto = getFieldVal(recBuf, 'INTERDICTO').toUpperCase();
      const fiscales = getFieldVal(recBuf, 'FISCALES').toUpperCase();
      const isRestricted = (polMil === 'S' || interdicto === 'S' || fiscales === 'S') ? 1 : 0;

      let edad = '';
      if (fecNac) {
        const birthYear = parseInt(fecNac.substring(0, 4));
        if (birthYear) {
          edad = String(2026 - birthYear);
        }
      }

      const row = [
        ci,
        nombre,
        apellido,
        fecNac,
        sexo,
        dptoName,
        distName,
        distName,
        localName,
        code,
        '',
        '',
        mesa,
        orden,
        '',
        'T',
        edad,
        '',
        '',
        '',
        'Pendiente',
        0,
        '',
        '',
        '',
        dpto,
        dist,
        zona,
        local,
        fecInsc,
        esIndigen,
        tieneDisc,
        refDiscap,
        isRestricted
      ].map(escapeCSV).join(',') + '\n';

      electStream.write(row);
      processed++;

      if (processed % batchSize === 0) {
        console.log(`  Procesados ${processed} de ${header.numRecords} registros...`);
      }
    }
    fs.closeSync(fd);
    console.log(`Completada la exportación de ${processed} electores.`);
  }
  electStream.end();
  console.log('--- CONVERSIÓN TERMINADA CON ÉXITO ---');
}

convertDbfToCsv().catch(err => {
  console.error('Error durante la conversión:', err);
});
