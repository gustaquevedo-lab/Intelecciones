const Database = require('better-sqlite3');

function normalizeApoderadoPhone(phone) {
  let p = String(phone).replace(/\D/g, '');
  if (!p) return null;
  // User said: "Debes agreagr un 9 a estos numeros"
  // So 86486034 -> 595986486034
  if (p.length === 8 && /^[789]/.test(p)) {
    return '5959' + p;
  }
  return '595' + p;
}

function runInsertApoderados(db) {
  const apoderados = [
    { local: 'ESC. BASICA NRO. 1951 JUAN EMILIANO OLEARY', ci: '4343510', phone: '86-486034' },
    { local: 'ESC. BASICA NRO. 1951 JUAN EMILIANO OLEARY', ci: '3825190', phone: '71-470082' },
    { local: 'ESC. BASICA NRO. 1951 JUAN EMILIANO OLEARY', ci: '3659149', phone: '71-677050' },
    { local: 'ESC. BASICA NRO. 1951 JUAN EMILIANO OLEARY', ci: '3023896', phone: '71.810.550' },
    { local: 'ESC. BASICA NRO. 1951 JUAN EMILIANO OLEARY', ci: '1537850', phone: '82-261909' },
    
    // FACULTAD DE CIENCIAS AGRARIAS
    { local: 'FACULTAD DE CIENCIAS AGRARIAS', ci: '1836179', phone: '72-957779' },
    { local: 'FACULTAD DE CIENCIAS AGRARIAS', ci: '2019816', phone: '83-567740' },
    { local: 'FACULTAD DE CIENCIAS AGRARIAS', ci: '3540580', phone: '82-502018' },
    { local: 'FACULTAD DE CIENCIAS AGRARIAS', ci: '3179559', phone: '75-171088' },
    { local: 'FACULTAD DE CIENCIAS AGRARIAS', ci: '5100327', phone: '' },
    
    // CARLOS ANTONIO LOPEZ
    { local: 'ESC. BAS. CARLOS ANTONIO LOPEZ', ci: '935490', phone: '71-655928' },
    { local: 'ESC. BAS. CARLOS ANTONIO LOPEZ', ci: '2620465', phone: '73-823455' },
    { local: 'ESC. BAS. CARLOS ANTONIO LOPEZ', ci: '2262807', phone: '84-789244' },
    { local: 'ESC. BAS. CARLOS ANTONIO LOPEZ', ci: '3808943', phone: '94-589581' },
    { local: 'ESC. BAS. CARLOS ANTONIO LOPEZ', ci: '883599', phone: '71-801735' },
    
    // CERRO CORA EX OLEARY
    { local: "COL. NAC. CERRO CORA EX JUAN E O'LEARY", ci: '2032040', phone: '73-431197' },
    { local: "COL. NAC. CERRO CORA EX JUAN E O'LEARY", ci: '5100327', phone: '71-415161' },
    { local: "COL. NAC. CERRO CORA EX JUAN E O'LEARY", ci: '4343510', phone: '75-592217' },
    { local: "COL. NAC. CERRO CORA EX JUAN E O'LEARY", ci: '6824301', phone: '82-261909' }
  ];

  const getElectorStmt = db.prepare("SELECT nombre, apellido FROM electors WHERE TRIM(REPLACE(CAST(ci AS TEXT), '.', '')) = ? OR LTRIM(TRIM(REPLACE(CAST(ci AS TEXT), '.', '')), '0') = ?");
  
  const insertStmt = db.prepare(`
    INSERT INTO users (username, password, role, nombre, ci, telefono, distrito, assigned_local, assigned_mesa, assigned_table_role)
    VALUES (?, ?, 'APODERADO', ?, ?, ?, 'PEDRO JUAN CABALLERO', ?, NULL, NULL)
  `);

  for (const apo of apoderados) {
    const username = apo.ci;
    const phone = normalizeApoderadoPhone(apo.phone);
    let elector;
    try {
      elector = getElectorStmt.get(apo.ci, apo.ci);
    } catch (e) {}
    const nombre = elector ? `${elector.nombre} ${elector.apellido}`.trim() : 'SIN NOMBRE OFICIAL';

    const existingUser = db.prepare('SELECT id FROM users WHERE username = ? OR ci = ?').get(username, apo.ci);
    if (!existingUser) {
      insertStmt.run(username, username, nombre, apo.ci, phone, apo.local);
      console.log(`[APODERADOS] Insertado ${apo.ci} - ${nombre}`);
    } else {
      console.log(`[APODERADOS] Obviado ${apo.ci} (Ya existe)`);
    }
  }
}

module.exports = { runInsertApoderados };
