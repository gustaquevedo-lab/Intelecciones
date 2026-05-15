import db from '../src/db';

async function debug() {
    try {
        console.log("--- DEBUG CONFLICTS ---");
        
        const allConflicts = db.prepare('SELECT COUNT(*) as count FROM capture_conflicts').get() as any;
        console.log("Total conflicts in DB:", allConflicts.count);

        const activeConflicts = db.prepare('SELECT COUNT(*) as count FROM capture_conflicts WHERE status != "RESOLVED"').get() as any;
        console.log("Active conflicts:", activeConflicts.count);

        const districts = db.prepare(`
            SELECT DISTINCT UPPER(TRIM(e.ciudad)) as ciudad, UPPER(TRIM(e.distrito)) as distrito
            FROM capture_conflicts cc
            JOIN electors e ON REPLACE(REPLACE(cc.elector_ci, '.', ''), ',', '') = REPLACE(REPLACE(e.ci, '.', ''), ',', '')
            WHERE cc.status != 'RESOLVED'
        `).all() as any[];
        
        console.log("Districts with ACTIVE conflicts:", districts);

        const pjcCheck = db.prepare(`
            SELECT COUNT(*) as count 
            FROM capture_conflicts cc
            JOIN electors e ON REPLACE(REPLACE(cc.elector_ci, '.', ''), ',', '') = REPLACE(REPLACE(e.ci, '.', ''), ',', '')
            WHERE (UPPER(TRIM(e.ciudad)) LIKE '%PEDRO JUAN%' OR UPPER(TRIM(e.distrito)) LIKE '%PEDRO JUAN%')
            AND cc.status != 'RESOLVED'
        `).get() as any;
        console.log("Active PJC conflicts (LIKE %PEDRO JUAN%):", pjcCheck.count);

    } catch (e) {
        console.error("Debug failed:", e);
    }
}

debug();
