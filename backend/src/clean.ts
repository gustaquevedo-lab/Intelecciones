import db from './db';

const clean = () => {
    console.log("Wiping all local test seed data to restore a clean database slate...");

    db.transaction(() => {
        // 1. Wipe captures and conflicts
        db.prepare("DELETE FROM elector_captures").run();
        db.prepare("DELETE FROM capture_conflicts").run();
        
        // 2. Wipe users (except maybe a default superadmin if needed, let's clear all to be 100% clean)
        db.prepare("DELETE FROM users").run();
        
        // 3. Wipe campaigns and lists
        db.prepare("DELETE FROM lists").run();
        db.prepare("DELETE FROM campaigns").run();
        
        // 4. Wipe our test electors
        db.prepare("DELETE FROM electors WHERE ci IN ('8000001', '8000002', '8000003')").run();

        // 5. Create one default fresh SuperAdmin account so the app remains accessible
        db.prepare(`
            INSERT INTO users (username, password, role, nombre, ci, status)
            VALUES ('admin', 'admin', 'SUPERUSUARIO', 'Administrador General', '999999', 'ACTIVE')
        `).run();
    })();

    console.log("SUCCESS: Local database is now 100% clean, empty of test data, and ready for clean operations!");
};

clean();
