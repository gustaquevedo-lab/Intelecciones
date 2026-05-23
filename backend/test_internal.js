const Database = require('better-sqlite3');
const db = new Database('./intellecciones.db');
db.transaction(() => {
    try {
        // Create an internal conflict
        const result = db.prepare("INSERT INTO capture_conflicts (status, list_id_a, list_id_b, capture_id, capture_id_b, elector_ci, conflict_type) VALUES ('PENDING', 1, 1, 10, 11, '0000', 'INTERNAL')").run();
        const conflict_id = result.lastInsertRowid;
        const winner_capture_id = 10;
        const user_id = 1; // Superusuario
        
        console.log("Created conflict:", conflict_id);
        
        const conflict = db.prepare('SELECT * FROM capture_conflicts WHERE id = ?').get(conflict_id);
        
        db.prepare("UPDATE capture_conflicts SET jefe_decision_id = ?, status = 'WAITING_CONSENT' WHERE id = ?")
            .run(winner_capture_id, conflict_id);

        if (conflict.list_id_a === conflict.list_id_b) {
            db.prepare('UPDATE capture_conflicts SET consent_a = 1, consent_b = 1 WHERE id = ?').run(conflict_id);
        } else {
            console.log("Not internal!");
        }

        const cc = db.prepare('SELECT * FROM capture_conflicts WHERE id = ?').get(conflict_id);
        console.log("CC before check:", cc);
        
        if (cc.jefe_decision_id && cc.consent_a === 1 && cc.consent_b === 1) {
            const winnerId = cc.jefe_decision_id;
            const loserId = (cc.capture_id === winnerId) ? cc.capture_id_b : cc.capture_id;
            console.log("Winner:", winnerId, "Loser:", loserId);

            db.prepare('UPDATE capture_conflicts SET status = "RESOLVED", resolved_by_jefe_id = ?, winner_capture_id = ?, resolved_at = CURRENT_TIMESTAMP WHERE id = ?')
                .run(user_id, winnerId, conflict_id);
            console.log("Finalized!");
        }
    } catch(e) {
        console.error("ERROR:", e);
    }
})();
