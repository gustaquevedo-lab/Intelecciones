const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const xlsx = require('xlsx');

const ci = '6894333';
const numericCi = 6894333;

const dbFiles = [
  path.join(__dirname, 'intellecciones.db'),
  path.join(__dirname, 'temp_db_95b.db'),
  path.join(__dirname, 'temp_db_95b_binary.db'),
  path.join(__dirname, 'recovered_intellecciones.db'),
  path.join(__dirname, '..', 'intellecciones.db'),
  path.join(__dirname, '..', 'ruvector.db')
];

console.log('--- SEARCHING DATABASES ---');
for (const dbFile of dbFiles) {
  if (!fs.existsSync(dbFile)) continue;
  console.log('Searching database:', dbFile);
  try {
    const db = new Database(dbFile);
    // Get all tables
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
    for (const table of tables) {
      const tableName = table.name;
      // Get all columns
      const cols = db.prepare(`PRAGMA table_info(${tableName})`).all();
      for (const col of cols) {
        try {
          const query = `SELECT * FROM ${tableName} WHERE CAST(${col.name} AS TEXT) = ? OR CAST(${col.name} AS TEXT) LIKE ?`;
          const rows = db.prepare(query).all(ci, `%${ci}%`);
          if (rows.length > 0) {
            console.log(`  FOUND in Table [${tableName}] Column [${col.name}]:`, rows);
          }
        } catch (e) {
          // ignore column mismatch/query errors
        }
      }
    }
    db.close();
  } catch (e) {
    console.error(`Error searching ${dbFile}:`, e.message);
  }
}

console.log('\n--- SEARCHING EXCEL FILES ---');
const excelFiles = [
  path.join(__dirname, '00 - PEDRO J. CABALLERO.xlsx'),
  path.join(__dirname, '..', '06 - CERRO CORA.xlsx')
];

for (const file of excelFiles) {
  if (!fs.existsSync(file)) {
    console.log(`Excel file not found: ${file}`);
    continue;
  }
  console.log(`Searching Excel file: ${file}`);
  try {
    const workbook = xlsx.readFile(file);
    for (const sheetName of workbook.SheetNames) {
      const sheet = workbook.Sheets[sheetName];
      const data = xlsx.utils.sheet_to_json(sheet);
      for (let i = 0; i < data.length; i++) {
        const row = data[i];
        for (const key of Object.keys(row)) {
          const val = row[key];
          if (val == numericCi || String(val).trim() == ci || String(val).includes(ci)) {
            console.log(`  FOUND in sheet [${sheetName}] row [${i + 2}]:`, row);
          }
        }
      }
    }
  } catch (e) {
    console.error(`Error reading Excel ${file}:`, e.message);
  }
}
console.log('Search complete.');
