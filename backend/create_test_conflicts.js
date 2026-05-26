const Database = require('better-sqlite3');
const path = require('path');
const db = new Database(path.join(__dirname, 'intellecciones.db'));

try {
  db.transaction(() => {
    // 1. Delete all previous capture_conflicts to make it clean
    db.prepare("DELETE FROM capture_conflicts").run();
    console.log("Cleared existing conflicts.");

    // 2. Clear any old captures flagged as disputed to start clean
    db.prepare("UPDATE elector_captures SET is_disputed = 0").run();

    // 3. Find some active electors
    const concepcionElector = db.prepare("SELECT ci, nombre, apellido, distrito, ciudad FROM electors WHERE distrito = 'CONCEPCION' OR ciudad = 'CONCEPCION' LIMIT 1").get();
    const pjcElector = db.prepare("SELECT ci, nombre, apellido, distrito, ciudad FROM electors WHERE distrito = 'PEDRO JUAN CABALLERO' OR ciudad = 'PEDRO JUAN CABALLERO' LIMIT 1").get();
    const fieldElectorCI = "9999999"; // For "registro de campo" (no elector record)

    console.log("Concepcion Elector found:", concepcionElector);
    console.log("PJC Elector found:", pjcElector);

    // 4. Create internal conflict (Concepcion, List 3) for Concepcion elector
    if (concepcionElector) {
      const ci = concepcionElector.ci;
      
      // Delete existing captures for this elector to avoid duplicates
      db.prepare("DELETE FROM elector_captures WHERE elector_ci = ?").run(ci);

      // Insert Capture A: Coordinator 9 (zulma), List 3, Campaign 3
      const capA = db.prepare(`
        INSERT INTO elector_captures (elector_ci, coordinator_id, list_id, campaign_id, lat, lng, traffic_light, is_disputed, telefono, needs_transport, timestamp)
        VALUES (?, 9, 3, 3, -23.4001, -57.4001, 'GREEN', 1, '0981111222', 0, '2026-05-25 10:00:00')
      `).run(ci);

      // Insert Capture B: Coordinator 8 (padrino1), List 3, Campaign 3
      const capB = db.prepare(`
        INSERT INTO elector_captures (elector_ci, coordinator_id, list_id, campaign_id, lat, lng, traffic_light, is_disputed, telefono, needs_transport, timestamp)
        VALUES (?, 8, 3, 3, -23.4002, -57.4002, 'YELLOW', 1, '0981111333', 1, '2026-05-25 10:05:00')
      `).run(ci);

      // Create internal conflict
      db.prepare(`
        INSERT INTO capture_conflicts (capture_id, capture_id_b, elector_ci, list_id_a, list_id_b, conflict_type, status, timestamp)
        VALUES (?, ?, ?, 3, 3, 'INTERNAL', 'PENDING', '2026-05-25 10:05:00')
      `).run(capA.lastInsertRowid, capB.lastInsertRowid, ci);
      console.log(`Created internal conflict for ${concepcionElector.nombre} ${concepcionElector.apellido} (CI: ${ci})`);
    }

    // 5. Create inter-list conflict (PJC, List 4 vs List 3) for PJC elector
    if (pjcElector) {
      const ci = pjcElector.ci;
      
      // Delete existing captures for this elector to avoid duplicates
      db.prepare("DELETE FROM elector_captures WHERE elector_ci = ?").run(ci);

      // Insert Capture A: Coordinator 12 (coordinador_pjc), List 4, Campaign 4
      const capA = db.prepare(`
        INSERT INTO elector_captures (elector_ci, coordinator_id, list_id, campaign_id, lat, lng, traffic_light, is_disputed, telefono, needs_transport, timestamp)
        VALUES (?, 12, 4, 4, -22.5333, -55.7333, 'GREEN', 1, '0971888111', 0, '2026-05-25 11:00:00')
      `).run(ci);

      // Insert Capture B: Coordinator 9 (zulma), List 3, Campaign 3
      const capB = db.prepare(`
        INSERT INTO elector_captures (elector_ci, coordinator_id, list_id, campaign_id, lat, lng, traffic_light, is_disputed, telefono, needs_transport, timestamp)
        VALUES (?, 9, 3, 3, -22.5334, -55.7334, 'PURPLE', 1, '0971888222', 0, '2026-05-25 11:10:00')
      `).run(ci);

      // Create inter-list conflict
      db.prepare(`
        INSERT INTO capture_conflicts (capture_id, capture_id_b, elector_ci, list_id_a, list_id_b, conflict_type, status, timestamp)
        VALUES (?, ?, ?, 4, 3, 'INTER_LIST', 'PENDING', '2026-05-25 11:10:00')
      `).run(capA.lastInsertRowid, capB.lastInsertRowid, ci);
      console.log(`Created inter-list conflict for ${pjcElector.nombre} ${pjcElector.apellido} (CI: ${ci})`);
    }

    // 6. Create inter-list conflict for a "registro de campo" elector (not in official electors list)
    // Delete existing captures for this elector
    db.prepare("DELETE FROM elector_captures WHERE elector_ci = ?").run(fieldElectorCI);

    // Insert Capture A: Coordinator 12 (coordinador_pjc), List 4, Campaign 4
    const capAField = db.prepare(`
      INSERT INTO elector_captures (elector_ci, coordinator_id, list_id, campaign_id, lat, lng, traffic_light, is_disputed, telefono, needs_transport, timestamp)
      VALUES (?, 12, 4, 4, -22.5335, -55.7335, 'GREEN', 1, '0971999111', 0, '2026-05-25 12:00:00')
    `).run(fieldElectorCI);

    // Insert Capture B: Coordinator 9 (zulma), List 3, Campaign 3
    const capBField = db.prepare(`
      INSERT INTO elector_captures (elector_ci, coordinator_id, list_id, campaign_id, lat, lng, traffic_light, is_disputed, telefono, needs_transport, timestamp)
      VALUES (?, 9, 3, 3, -22.5336, -55.7336, 'RED', 1, '0971999222', 1, '2026-05-25 12:15:00')
    `).run(fieldElectorCI);

    // Create inter-list conflict for field elector
    db.prepare(`
      INSERT INTO capture_conflicts (capture_id, capture_id_b, elector_ci, list_id_a, list_id_b, conflict_type, status, timestamp)
      VALUES (?, ?, ?, 4, 3, 'INTER_LIST', 'PENDING', '2026-05-25 12:15:00')
    `).run(capAField.lastInsertRowid, capBField.lastInsertRowid, fieldElectorCI);
    console.log(`Created inter-list conflict for field elector (CI: ${fieldElectorCI})`);

  })();

  const totalConflicts = db.prepare("SELECT COUNT(*) as count FROM capture_conflicts").get().count;
  console.log("Total conflicts in database now:", totalConflicts);
} catch (e) {
  console.error("FAILED TO CREATE TEST CONFLICTS:", e.message);
}
