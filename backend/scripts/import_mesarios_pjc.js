const XLSX = require('xlsx');
const path = require('path');
const Database = require('better-sqlite3');

function normalizePhone(phone) {
  let p = String(phone).replace(/\D/g, '');
  if (!p || p.length < 5) return null;
  
  if (p.startsWith('595')) {
    return p;
  }
  
  if (p.length === 10 && p.startsWith('09')) {
    return '595' + p.substring(1); // 0981... -> 595981...
  }
  
  if (p.length === 9 && p.startsWith('9')) {
    return '595' + p; // 981... -> 595981...
  }
  
  if (p.length === 8 && /^[789]/.test(p)) {
    return '5959' + p; // 86486034 -> 595986486034
  }
  
  return '595' + p;
}

function runImport(db, excelPath) {
  const workbook = XLSX.readFile(excelPath);
  const sheetsToProcess = workbook.SheetNames.filter(name => !['Hoja1', 'EJEMPLO'].includes(name));

  const mapByCi = new Map(); // Para unificar por CI

  for (const sheetName of sheetsToProcess) {
    const sheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(sheet, { header: 1 });
    
    let currentLocal = sheetName.replace(' (2)', '').trim();
    
    if (currentLocal === '710') currentLocal = '710 DON CARLOS ANTONIO LOPEZ';
    if (currentLocal === 'CERRO CORA') currentLocal = 'CERRO CORA EX OLEARI';

    let inMiembrosSection = false;

    for (let r = 0; r < data.length; r++) {
      const row = data[r];
      if (!row || !row.length) continue;

      const col0 = String(row[0] || '').toUpperCase().trim();
      
      // Check Apoderados
      if (col0.includes('APODERADO DE LOCAL')) {
        const name = String(row[1] || '').trim();
        const ci = String(row[2] || '').trim().replace(/\D/g, '');
        let phone = String(row[3] || '').trim();
        if (name && ci) {
          if (!mapByCi.has(ci)) {
            mapByCi.set(ci, { role: 'APODERADO', local: currentLocal, name, ci, phone: normalizePhone(phone), mesa: null, tableRole: null });
          }
        }
        continue;
      }

      // Check Miembros start
      if (col0.includes('MIEMBROS DE  MESAS') || col0.includes('MIEMBROS DE MESA') || col0 === 'N°' || String(row[1] || '').toUpperCase().includes('CARGO')) {
        inMiembrosSection = true;
        continue;
      }

      if (inMiembrosSection) {
        // Usar heurística por fila porque cada hoja tiene las columnas movidas
        let name = null;
        let ci = null;
        let phone = null;
        let roleDesc = '';
        let mesa = null;

        for (let i = 0; i < 10; i++) {
          const cell = row[i];
          if (cell === undefined || cell === null) continue;
          const s = String(cell).trim();
          const upper = s.toUpperCase();

          // Si es una cédula (numero grande)
          if (/^\d{6,8}$/.test(s.replace(/\D/g, '')) && !upper.includes('-') && !upper.includes('LISTA')) {
            ci = s.replace(/\D/g, '');
          }
          // Si es un telefono
          else if ((s.includes('-') && /\d{2}-\d{6}/.test(s)) || (s.length >= 8 && /^[0-9]+$/.test(s))) {
            if (!ci || s !== ci) { // Avoid confusing CI and Phone if phone has no dash
               phone = s;
            }
          }
          // Si es Rol
          else if (upper.includes('RESOLUCION') || upper.includes('SUSTITUCION') || upper.includes('PTE') || upper.includes('VOCAL') || upper.includes('PRESIDENT')) {
            roleDesc = upper;
          }
          // Si es Mesa (numero chico)
          else if (/^\d{1,2}$/.test(s)) {
            if (name && ci) {
              mesa = parseInt(s);
            }
          }
          // Si es Nombre (texto con espacios)
          else if (s.includes(' ') && s.length > 5 && !upper.includes('LISTA')) {
            if (!name) name = s;
          }
        }

        if (name && ci && mesa !== null) {
          let tableRole = 'VOCAL';
          if (roleDesc.includes('PTE') || roleDesc.includes('PRESIDENT')) tableRole = 'PRESIDENTE';
          
          if (!mapByCi.has(ci)) {
            mapByCi.set(ci, { role: 'MIEMBRO_MESA', local: currentLocal, name, ci, mesa, tableRole, phone: normalizePhone(phone) });
          }
        }
      }
    }
  }

  const allData = Array.from(mapByCi.values());
  let inserted = 0;
  let updated = 0;

  db.transaction(() => {
    const checkStmt = db.prepare('SELECT id FROM users WHERE ci = ?');
    const insertStmt = db.prepare(`
      INSERT INTO users (username, password, role, nombre, ci, telefono, distrito, assigned_local, assigned_mesa, assigned_table_role)
      VALUES (?, ?, ?, ?, ?, ?, 'PEDRO JUAN CABALLERO', ?, ?, ?)
    `);
    const updateStmt = db.prepare(`
      UPDATE users SET 
        role = ?, 
        nombre = ?, 
        telefono = ?, 
        distrito = 'PEDRO JUAN CABALLERO',
        assigned_local = ?, 
        assigned_mesa = ?, 
        assigned_table_role = ?
      WHERE ci = ?
    `);

    for (const p of allData) {
      const existing = checkStmt.get(p.ci);
      if (existing) {
        updateStmt.run(p.role, p.name, p.phone, p.local, p.mesa, p.tableRole, p.ci);
        updated++;
      } else {
        const username = `mesario_${p.ci}`;
        const password = `pass_${p.ci}`;
        insertStmt.run(username, password, p.role, p.name, p.ci, p.phone, p.local, p.mesa, p.tableRole);
        inserted++;
      }
    }
  })();

  console.log(`[BOOTSTRAP IMPORT PJC] Proceso finalizado con exito.`);
  console.log(`[BOOTSTRAP IMPORT PJC] Total únicos encontrados: ${allData.length}`);
  console.log(`[BOOTSTRAP IMPORT PJC] Insertados: ${inserted}`);
  console.log(`[BOOTSTRAP IMPORT PJC] Actualizados: ${updated}`);
}

module.exports = { runImport };
