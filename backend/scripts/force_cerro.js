const runForceCerro = (db) => {
  console.log('[FORCE CERRO] Ejecutando...');
  const list = [
    {ci:'2032040', phone:'595973431197'},
    {ci:'5100327', phone:'595971415161'},
    {ci:'4343510', phone:'595975592217'},
    {ci:'6824301', phone:'595982261909'}
  ];
  const local = "COL. NAC. CERRO CORA EX JUAN E O'LEARY";
  
  // Limpiar otros apoderados si existieran en este local
  db.prepare("UPDATE users SET assigned_local = NULL WHERE assigned_local = ? AND role = 'APODERADO'").run(local);
  
  const getElectorStmt = db.prepare("SELECT nombre, apellido FROM electors WHERE TRIM(REPLACE(CAST(ci AS TEXT), '.', '')) = ? OR LTRIM(TRIM(REPLACE(CAST(ci AS TEXT), '.', '')), '0') = ?");
  const insertStmt = db.prepare("INSERT INTO users (username, password, role, nombre, ci, telefono, distrito, assigned_local) VALUES (?, ?, 'APODERADO', ?, ?, ?, 'PEDRO JUAN CABALLERO', ?)");
  const updateStmt = db.prepare("UPDATE users SET role = 'APODERADO', assigned_local = ?, telefono = ?, distrito = 'PEDRO JUAN CABALLERO' WHERE id = ?");

  for (const l of list) {
    const user = db.prepare('SELECT id FROM users WHERE ci = ? OR username = ?').get(l.ci, l.ci);
    if (user) {
      updateStmt.run(local, l.phone, user.id);
      console.log(`[FORCE CERRO] Actualizado ${l.ci}`);
    } else {
      let nombre = 'SIN NOMBRE OFICIAL';
      try {
        const elector = getElectorStmt.get(l.ci, l.ci);
        if (elector) nombre = `${elector.nombre} ${elector.apellido}`.trim();
      } catch (e) {}
      insertStmt.run(l.ci, l.ci, nombre, l.ci, l.phone, local);
      console.log(`[FORCE CERRO] Insertado ${l.ci}`);
    }
  }
};

module.exports = { runForceCerro };
