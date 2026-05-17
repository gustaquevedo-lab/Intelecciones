"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const db_1 = __importDefault(require("./src/db"));
async function debug() {
    console.log('--- BUSCANDO A ZULMA ---');
    const users = db_1.default.prepare("SELECT id, username, nombre, role, parent_id, distrito, assigned_list_id FROM users WHERE nombre LIKE '%Zulma%' OR username LIKE '%Zulma%';").all();
    console.log(JSON.stringify(users, null, 2));
    if (users.length > 0) {
        for (const zulma of users) {
            const zulmaId = zulma.id;
            console.log(`\n--- REVISANDO USUARIO: ${zulma.nombre} (ID: ${zulmaId}, Rol: ${zulma.role}) ---`);
            const count = db_1.default.prepare('SELECT COUNT(*) as count FROM elector_captures WHERE coordinator_id = ?').get(zulmaId).count;
            console.log(`Total Capturas: ${count}`);
            if (count > 0) {
                const captures = db_1.default.prepare(`
          SELECT ec.id, ec.elector_ci, ec.coordinator_id, ec.list_id, ec.timestamp, e.nombre, e.apellido, e.ciudad
          FROM elector_captures ec
          LEFT JOIN electors e ON ec.elector_ci = e.ci
          WHERE ec.coordinator_id = ?
          LIMIT 5;
        `).all(zulmaId);
                console.log('Muestra de capturas:', JSON.stringify(captures, null, 2));
            }
            // Parent info
            if (zulma.parent_id) {
                const parent = db_1.default.prepare("SELECT id, nombre, role, distrito, assigned_list_id FROM users WHERE id = ?;").get(zulma.parent_id);
                console.log('Padre asignado:', JSON.stringify(parent, null, 2));
            }
            else {
                console.log('No tiene padre asignado.');
            }
            // District check
            console.log(`Distrito del usuario: ${zulma.distrito}`);
        }
    }
    else {
        console.log('No se encontró a nadie con el nombre Zulma.');
    }
}
debug().catch(console.error);
//# sourceMappingURL=debug_zulma.js.map