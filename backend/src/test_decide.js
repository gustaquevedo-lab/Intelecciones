const Database = require('better-sqlite3');
const db = new Database('./intellecciones.db');

// Add a test conflict
try {
    const listA = db.prepare('INSERT INTO lists (campaign_id, list_number) VALUES (1, 100)').run();
    const listB = db.prepare('INSERT INTO lists (campaign_id, list_number) VALUES (1, 101)').run();
    const listAId = listA.lastInsertRowid;
    const listBId = listB.lastInsertRowid;

    const userJefe = db.prepare('INSERT INTO users (username, role) VALUES ("jefetest", "JEFE_CAMPANA")').run();
    const jefeId = userJefe.lastInsertRowid;

    const conflict = db.prepare(`
        INSERT INTO capture_conflicts (status, list_id_a, list_id_b, elector_ci, capture_id, capture_id_b)
        VALUES ('PENDING', ?, ?, '123456', 1, 2)
    `).run(listAId, listBId);
    
    const conflictId = conflict.lastInsertRowid;

    // Simulate endpoint
    db.transaction(() => {
        const c = db.prepare('SELECT * FROM capture_conflicts WHERE id = ?').get(conflictId);
        
        db.prepare('UPDATE capture_conflicts SET jefe_decision_id = ?, status = "WAITING_CONSENT" WHERE id = ?')
            .run(1, conflictId);

        if (c.list_id_a === c.list_id_b) {
            db.prepare('UPDATE capture_conflicts SET consent_a = 1, consent_b = 1 WHERE id = ?').run(conflictId);
        } else {
            const user = db.prepare('SELECT * FROM users WHERE id = ?').get(jefeId);
            const lists = [c.list_id_a, c.list_id_b];
            lists.forEach((lid, idx) => {
                const hasSubjefe = lid ? db.prepare('SELECT 1 FROM users WHERE assigned_list_id = ? AND role = "SUBJEFE" LIMIT 1').get(lid) : null;
                if (!hasSubjefe || (user && user.assigned_list_id === lid)) {
                    const col = (idx === 0) ? 'consent_a' : 'consent_b';
                    db.prepare(`UPDATE capture_conflicts SET ${col} = 1 WHERE id = ?`).run(conflictId);
                }
            });
        }
    })();
    console.log("SUCCESS");
} catch(e) {
    console.error("ERROR", e.message);
}
