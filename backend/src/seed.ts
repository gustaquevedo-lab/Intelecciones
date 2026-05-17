import db from './db';

const seed = () => {
    console.log("Seeding database hierarchy...");

    // 1. Clean existing seed data to allow safe re-runs
    db.prepare("DELETE FROM elector_captures").run();
    db.prepare("DELETE FROM users").run();
    db.prepare("DELETE FROM lists").run();
    db.prepare("DELETE FROM campaigns").run();
    db.prepare("DELETE FROM electors WHERE ci IN ('8000001', '8000002', '8000003')").run();

    // 2. Create Campaigns
    const campaignConcepcionId = db.prepare(`
        INSERT INTO campaigns (name, distrito, enabled_modules, status, slogan, goal)
        VALUES ('Santiago Peña - Concepción', 'CONCEPCION', 'COMMAND_CENTER,REGISTRY,LOGISTICS,WHATSAPP,DIAD', 'active', '¡El cambio ya llega!', 1500)
    `).run().lastInsertRowid as number;

    const campaignPjcId = db.prepare(`
        INSERT INTO campaigns (name, distrito, enabled_modules, status, slogan, goal)
        VALUES ('Santiago Peña - PJC', 'PEDRO JUAN CABALLERO', 'COMMAND_CENTER,REGISTRY,LOGISTICS,WHATSAPP,DIAD', 'active', '¡Unidos por Amambay!', 1000)
    `).run().lastInsertRowid as number;

    console.log(`Campaigns created: Concepcion (${campaignConcepcionId}), PJC (${campaignPjcId})`);

    // 3. Create Lists
    const listConcepcionId = db.prepare(`
        INSERT INTO lists (campaign_id, type, list_number, option_number, candidate_ci, candidate_nombre, candidate_alias, goal, ciudad)
        VALUES (?, 'LIST', '1', '1', '4000001', 'Santiago Peña', 'Santi', 1500, 'CONCEPCION')
    `).run(campaignConcepcionId).lastInsertRowid as number;

    const listPjcId = db.prepare(`
        INSERT INTO lists (campaign_id, type, list_number, option_number, candidate_ci, candidate_nombre, candidate_alias, goal, ciudad)
        VALUES (?, 'LIST', '2', '1', '4000002', 'Santiago Peña', 'Santi PJC', 1000, 'PEDRO JUAN CABALLERO')
    `).run(campaignPjcId).lastInsertRowid as number;

    console.log(`Lists created: Concepcion (${listConcepcionId}), PJC (${listPjcId})`);

    // 4. Create SuperAdmin
    const adminId = db.prepare(`
        INSERT INTO users (username, password, role, assigned_list_id, assigned_campaign_id, nombre, distrito, ci, status)
        VALUES ('admin', 'admin', 'SUPERUSUARIO', ?, ?, 'Gustavo Quevedo', 'CONCEPCION', '999999', 'ACTIVE')
    `).run(listConcepcionId, campaignConcepcionId).lastInsertRowid as number;

    // 5. Create SUBJEFE (3512586)
    const subjefeId = db.prepare(`
        INSERT INTO users (username, password, role, assigned_list_id, assigned_campaign_id, nombre, distrito, ci, status)
        VALUES ('3512586', '123', 'SUBJEFE', ?, ?, 'Subjefe Pedro', 'CONCEPCION', '3512586', 'ACTIVE')
    `).run(listConcepcionId, campaignConcepcionId).lastInsertRowid as number;

    // 6. Create PADRINO under SUBJEFE
    const padrinoId = db.prepare(`
        INSERT INTO users (username, password, role, assigned_list_id, assigned_campaign_id, nombre, distrito, ci, parent_id, status)
        VALUES ('padrino1', '123', 'PADRINO', ?, ?, 'Padrino Juan', 'CONCEPCION', '1234567', ?, 'ACTIVE')
    `).run(listConcepcionId, campaignConcepcionId, subjefeId).lastInsertRowid as number;

    // 7. Create COORDINADOR Zulma under PADRINO
    const zulmaId = db.prepare(`
        INSERT INTO users (username, password, role, assigned_list_id, assigned_campaign_id, nombre, distrito, ci, parent_id, status)
        VALUES ('zulma', '123', 'COORDINADOR', ?, ?, 'Zulma', 'CONCEPCION', '8765432', ?, 'ACTIVE')
    `).run(listConcepcionId, campaignConcepcionId, padrinoId).lastInsertRowid as number;

    console.log(`Users seeded: Admin (${adminId}), Subjefe (${subjefeId}), Padrino (${padrinoId}), Zulma (${zulmaId})`);

    // 8. Create Electors in Concepción
    db.prepare(`
        INSERT OR IGNORE INTO electors (ci, nombre, apellido, local_votacion, mesa, orden, is_priority, ciudad, distrito, campaign_id)
        VALUES ('8000001', 'MARIA LOPEZ', 'GOMEZ', 'ESC. BAS. SAN ROQUE', 1, 10, 0, 'CONCEPCION', 'CONCEPCION', ?)
    `).run(campaignConcepcionId);

    db.prepare(`
        INSERT OR IGNORE INTO electors (ci, nombre, apellido, local_votacion, mesa, orden, is_priority, ciudad, distrito, campaign_id)
        VALUES ('8000002', 'CARLOS GIMENEZ', 'DUARTE', 'ESC. BAS. SAN ROQUE', 1, 11, 0, 'CONCEPCION', 'CONCEPCION', ?)
    `).run(campaignConcepcionId);

    db.prepare(`
        INSERT OR IGNORE INTO electors (ci, nombre, apellido, local_votacion, mesa, orden, is_priority, ciudad, distrito, campaign_id)
        VALUES ('8000003', 'NIDIA GONZALEZ', 'CARDOZO', 'ESC. BAS. SAN ROQUE', 1, 12, 0, 'CONCEPCION', 'CONCEPCION', ?)
    `).run(campaignConcepcionId);

    console.log("Concepcion electors inserted.");

    // 9. Create Elector Captures made by Zulma
    db.prepare(`
        INSERT INTO elector_captures (elector_ci, coordinator_id, list_id, campaign_id, lat, lng, traffic_light, is_disputed, needs_transport, telefono)
        VALUES ('8000001', ?, ?, ?, -23.4001, -57.4001, 'GREEN', 0, 0, '0981111111')
    `).run(zulmaId, listConcepcionId, campaignConcepcionId);

    db.prepare(`
        INSERT INTO elector_captures (elector_ci, coordinator_id, list_id, campaign_id, lat, lng, traffic_light, is_disputed, needs_transport, telefono)
        VALUES ('8000002', ?, ?, ?, -23.4002, -57.4002, 'YELLOW', 0, 1, '0981222222')
    `).run(zulmaId, listConcepcionId, campaignConcepcionId);

    db.prepare(`
        INSERT INTO elector_captures (elector_ci, coordinator_id, list_id, campaign_id, lat, lng, traffic_light, is_disputed, needs_transport, telefono)
        VALUES ('8000003', ?, ?, ?, -23.4003, -57.4003, 'RED', 0, 0, '0981333333')
    `).run(zulmaId, listConcepcionId, campaignConcepcionId);

    console.log("Elector captures seeded under Coordinator Zulma.");

    console.log("Database successfully seeded!");
};

seed();
