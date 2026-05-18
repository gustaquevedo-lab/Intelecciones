const Database = require('better-sqlite3');
const path = require('path');
const dbPath = path.join(__dirname, '..', 'intellecciones.db');
const db = new Database(dbPath);

try {
    console.log("Database connected at:", dbPath);

    // 1. Find Campaign and List for Pedro Juan Caballero (PJC)
    const campaign = db.prepare("SELECT * FROM campaigns WHERE UPPER(distrito) = 'PEDRO JUAN CABALLERO'").get();
    if (!campaign) {
        throw new Error("No se encontró la campaña de Pedro Juan Caballero. Ejecuta el semillador primero.");
    }
    console.log("Found Campaign PJC ID:", campaign.id);

    const list = db.prepare("SELECT * FROM lists WHERE campaign_id = ?").get(campaign.id);
    if (!list) {
        throw new Error("No se encontró la lista asociada a la campaña de PJC.");
    }
    console.log("Found List PJC ID:", list.id);

    // 2. Clear any existing conflicting generic users to allow safe re-runs
    db.prepare("DELETE FROM users WHERE username IN ('subjefe', 'padrino')").run();

    // 3. Create Subjefe
    const subjefeInsert = db.prepare(`
        INSERT INTO users (username, password, role, assigned_list_id, assigned_campaign_id, nombre, distrito, ci, status)
        VALUES ('subjefe', 'subjefe', 'SUBJEFE', ?, ?, 'Subjefe Genérico PJC', 'PEDRO JUAN CABALLERO', '111111', 'ACTIVE')
    `).run(list.id, campaign.id);
    const subjefeId = subjefeInsert.lastInsertRowid;
    console.log("Subjefe created successfully! ID:", subjefeId);

    // 4. Create Padrino under Subjefe
    const padrinoInsert = db.prepare(`
        INSERT INTO users (username, password, role, assigned_list_id, assigned_campaign_id, nombre, distrito, ci, parent_id, status)
        VALUES ('padrino', 'padrino', 'PADRINO', ?, ?, 'Padrino Genérico PJC', 'PEDRO JUAN CABALLERO', '222222', ?, 'ACTIVE')
    `).run(list.id, campaign.id, subjefeId);
    const padrinoId = padrinoInsert.lastInsertRowid;
    console.log("Padrino created successfully! ID:", padrinoId);

    // 5. Create a test Coordinator under Padrino so they see some team structure!
    db.prepare("DELETE FROM users WHERE username = 'coordinador_pjc'").run();
    const coordinatorInsert = db.prepare(`
        INSERT INTO users (username, password, role, assigned_list_id, assigned_campaign_id, nombre, distrito, ci, parent_id, status)
        VALUES ('coordinador_pjc', '123', 'COORDINADOR', ?, ?, 'Coordinador PJC 1', 'PEDRO JUAN CABALLERO', '333333', ?, 'ACTIVE')
    `).run(list.id, campaign.id, padrinoId);
    const coordId = coordinatorInsert.lastInsertRowid;
    console.log("Test Coordinator created under Padrino! ID:", coordId);

    // 6. Create some test electors in PJC to verify they are matched
    db.prepare("DELETE FROM electors WHERE ci IN ('7000001', '7000002')").run();
    db.prepare(`
        INSERT INTO electors (ci, nombre, apellido, local_votacion, mesa, orden, ciudad, distrito, campaign_id)
        VALUES ('7000001', 'JUAN RAMON', 'BENITEZ', 'ESC. BAS. PJC CENTRAL', 1, 150, 'PEDRO JUAN CABALLERO', 'PEDRO JUAN CABALLERO', ?)
    `).run(campaign.id);
    db.prepare(`
        INSERT INTO electors (ci, nombre, apellido, local_votacion, mesa, orden, ciudad, distrito, campaign_id)
        VALUES ('7000002', 'LOURDES ESPINOLA', 'FERREIRA', 'ESC. BAS. PJC CENTRAL', 1, 151, 'PEDRO JUAN CABALLERO', 'PEDRO JUAN CABALLERO', ?)
    `).run(campaign.id);
    console.log("PJC test electors inserted.");

    // 7. Capture one elector under the Coordinator to see active green capture
    db.prepare("DELETE FROM elector_captures WHERE elector_ci IN ('7000001')").run();
    db.prepare(`
        INSERT INTO elector_captures (elector_ci, coordinator_id, list_id, campaign_id, lat, lng, traffic_light, is_disputed, needs_transport, telefono)
        VALUES ('7000001', ?, ?, ?, -22.5333, -55.7333, 'GREEN', 0, 0, '0971888888')
    `).run(coordId, list.id, campaign.id);
    console.log("Test elector captured under PJC Coordinator.");

    console.log("All generic users and testing relationships established successfully!");

} catch (err) {
    console.error("Error creating generic users:", err);
}
