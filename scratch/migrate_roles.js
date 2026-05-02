const Database = require('better-sqlite3');
const path = require('path');

const db = new Database(path.join(__dirname, '../backend/intellecciones.db'));

const migrateRoles = () => {
    console.log("Migrating user roles...");
    
    // Update SUPER_ADMIN to SUPERUSUARIO
    const result1 = db.prepare("UPDATE users SET role = 'SUPERUSUARIO' WHERE role = 'SUPER_ADMIN'").run();
    console.log(`Updated ${result1.changes} SuperAdmins.`);

    // Update COORDINATOR to COORDINADOR
    const result2 = db.prepare("UPDATE users SET role = 'COORDINADOR' WHERE role = 'COORDINATOR'").run();
    console.log(`Updated ${result2.changes} Coordinators.`);

    // Update CANDIDATE to JEFE_CAMPANA
    const result3 = db.prepare("UPDATE users SET role = 'JEFE_CAMPANA' WHERE role = 'CANDIDATE'").run();
    console.log(`Updated ${result3.changes} Candidates to JEFE_CAMPANA.`);

    console.log("Migration complete.");
};

migrateRoles();
db.close();
