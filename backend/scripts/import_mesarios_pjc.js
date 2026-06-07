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

  // Mapeo de locales a nombres oficiales
  const localMap = {
    'OLEARY': 'ESC. BASICA NRO. 1951 JUAN EMILIANO OLEARY',
    '710': 'ESC. BAS. CARLOS ANTONIO LOPEZ',
    'CERRO CORA': "COL. NAC. CERRO CORA EX JUAN E O'LEARY",
    'AGRONOMIA': 'FACULTAD DE CIENCIAS AGRARIAS'
  };

  for (const sheetName of sheetsToProcess) {
    const sheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(sheet, { header: 1 });
    
    let rawLocal = sheetName.replace(' (2)', '').trim();
    if (rawLocal === '710 DON CARLOS ANTONIO LOPEZ') rawLocal = '710';
    if (rawLocal === 'CERRO CORA EX OLEARI') rawLocal = 'CERRO CORA';
    
    const currentLocal = localMap[rawLocal] || rawLocal;

    let inMiembrosSection = false;

    for (let r = 0; r < data.length; r++) {
      const row = data[r];
      if (!row || !row.length) continue;

      const col0 = String(row[0] || '').toUpperCase().trim();
      
      // Check Apoderados
      if (col0.includes('APODERADO DE LOCAL')) {
        const ci = String(row[2] || '').trim().replace(/\D/g, '');
        let phone = String(row[3] || '').trim();
        if (ci) {
          if (!mapByCi.has(ci)) {
            mapByCi.set(ci, { role: 'APODERADO', local: currentLocal, ci, phone: normalizePhone(phone), mesa: null, tableRole: null });
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
        let ci = null;
        let phone = null;
        let roleDesc = '';
        let mesa = null;

        for (let i = 0; i < 10; i++) {
          const cell = row[i];
          if (cell === undefined || cell === null) continue;
          const s = String(cell).trim();
          const upper = s.toUpperCase();

          if (/^\d{6,8}$/.test(s.replace(/\D/g, '')) && !upper.includes('-') && !upper.includes('LISTA')) {
            ci = s.replace(/\D/g, '');
          } else if ((s.includes('-') && /\d{2}-\d{6}/.test(s)) || (s.length >= 8 && /^[0-9]+$/.test(s))) {
            if (!ci || s !== ci) {
               phone = s;
            }
          } else if (upper.includes('RESOLUCION') || upper.includes('SUSTITUCION') || upper.includes('PTE') || upper.includes('VOCAL') || upper.includes('PRESIDENT')) {
            roleDesc = upper;
          } else if (/^\d{1,2}$/.test(s)) {
            if (ci) {
              mesa = parseInt(s);
            }
          }
        }

        if (ci && mesa !== null) {
          let tableRole = 'VOCAL';
          if (roleDesc.includes('PTE') || roleDesc.includes('PRESIDENT')) tableRole = 'PRESIDENTE';
          
          if (!mapByCi.has(ci)) {
            mapByCi.set(ci, { role: 'MIEMBRO_MESA', local: currentLocal, ci, mesa, tableRole, phone: normalizePhone(phone) });
          }
        }
      }
    }
  }

  const allData = Array.from(mapByCi.values());
  let inserted = 0;
  let skipped = 0;
  let sentToSuplentes = 0;

  db.transaction(() => {
    // Limpiar tabla users para PJC antes de arrancar, para no dejar sucios
    db.prepare("DELETE FROM users WHERE distrito = 'PEDRO JUAN CABALLERO' AND role IN ('MIEMBRO_MESA', 'APODERADO')").run();

    const getElectorStmt = db.prepare('SELECT nombre, apellido, local_votacion, mesa FROM electors WHERE ci = ?');
    const insertStmt = db.prepare(`
      INSERT INTO users (username, password, role, nombre, ci, telefono, distrito, assigned_local, assigned_mesa, assigned_table_role)
      VALUES (?, ?, ?, ?, ?, ?, 'PEDRO JUAN CABALLERO', ?, ?, ?)
    `);

    for (const p of allData) {
      const elector = getElectorStmt.get(p.ci);
      
      if (!elector) {
        // No está en el padrón, rollback a padrón implica que lo ignoramos porque no hay nombre oficial
        skipped++;
        continue;
      }

      const nombreReal = `${elector.nombre} ${elector.apellido}`.trim();

      let finalMesa = p.mesa;
      let finalTableRole = p.tableRole;

      // Check discrepancia (sólo para miembros de mesa, apoderados no tienen mesa asignada al votar)
      if (p.role === 'MIEMBRO_MESA') {
        const padronLocal = elector.local_votacion;
        const padronMesa = elector.mesa;
        
        // Si el local del padrón NO es igual al local mapeado del excel, o la mesa no coincide
        const isLocalMatch = padronLocal && padronLocal.toUpperCase().includes(p.local.toUpperCase().split(' ')[0]);
        const isMesaMatch = padronMesa === p.mesa;

        if (!isLocalMatch || !isMesaMatch) {
          // Discrepancia! Mandar a banco de suplentes de ese local (el local del Excel)
          finalMesa = null;
          finalTableRole = null;
          sentToSuplentes++;
        }
      }

      const username = `mesario_${p.ci}`;
      const password = `pass_${p.ci}`;
      insertStmt.run(username, password, p.role, nombreReal, p.ci, p.phone, p.local, finalMesa, finalTableRole);
      inserted++;
    }
  })();

  console.log(`[BOOTSTRAP IMPORT PJC] Proceso finalizado con exito.`);
  console.log(`[BOOTSTRAP IMPORT PJC] Total extraídos del Excel: ${allData.length}`);
  console.log(`[BOOTSTRAP IMPORT PJC] Omitidos (No en Padrón): ${skipped}`);
  console.log(`[BOOTSTRAP IMPORT PJC] Enviados a Banco Suplentes por discrepancia: ${sentToSuplentes}`);
  console.log(`[BOOTSTRAP IMPORT PJC] Insertados totales: ${inserted}`);
}

module.exports = { runImport };
