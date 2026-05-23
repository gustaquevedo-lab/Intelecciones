const Database = require('better-sqlite3');
const db = new Database('./intellecciones.db');
try {
    const conflict = db.prepare("SELECT * FROM capture_conflicts WHERE status != 'RESOLVED' LIMIT 1").get();
    if (!conflict) {
        console.log("NO PENDING CONFLICTS FOUND");
    } else {
        console.log("CONFLICT:", conflict);
        
        // Simulating decide logic
        const conflictId = conflict.id;
        db.transaction(() => {
            const c = db.prepare('SELECT * FROM capture_conflicts WHERE id = ?').get(conflictId);
            const user = db.prepare('SELECT * FROM users WHERE role = "JEFE_CAMPANA" LIMIT 1').get();
            console.log("JEFE:", user);
            
            db.prepare('UPDATE capture_conflicts SET jefe_decision_id = ?, status = "WAITING_CONSENT" WHERE id = ?')
                .run(c.capture_id, conflictId);

            if (c.list_id_a === c.list_id_b) {
                console.log("Same list");
                db.prepare('UPDATE capture_conflicts SET consent_a = 1, consent_b = 1 WHERE id = ?').run(conflictId);
            } else {
                console.log("Different list");
                const lists = [c.list_id_a, c.list_id_b];
                lists.forEach((lid, idx) => {
                    const hasSubjefe = lid ? db.prepare('SELECT 1 FROM users WHERE assigned_list_id = ? AND role = "SUBJEFE" LIMIT 1').get(lid) : null;
                    console.log(`List ${lid} has subjefe:`, hasSubjefe);
                    if (!hasSubjefe || (user && user.assigned_list_id === lid)) {
                        const col = (idx === 0) ? 'consent_a' : 'consent_b';
                        console.log(`Setting consent ${col} to 1`);
                        db.prepare(`UPDATE capture_conflicts SET ${col} = 1 WHERE id = ?`).run(conflictId);
                    }
                });
            }
        })();
        console.log("SUCCESS");
    }
} catch (e) {
    console.error("ERROR", e.message);
}
