const Database = require('better-sqlite3');
const db = new Database('backend/database.sqlite');

const counts = db.prepare(`
    SELECT ciudad, distrito, COUNT(*) as count 
    FROM electors 
    WHERE UPPER(ciudad) LIKE '%CABALLERO%' OR UPPER(distrito) LIKE '%CABALLERO%'
    GROUP BY ciudad, distrito
`).all();
console.log("Counts for Caballero related entries:");
console.log(JSON.stringify(counts, null, 2));

const captureCounts = db.prepare(`
    SELECT e.ciudad, e.distrito, COUNT(*) as count
    FROM elector_captures ec
    JOIN electors e ON ec.elector_ci = e.ci
    GROUP BY e.ciudad, e.distrito
`).all();
console.log("Counts for Captures per ciudad/distrito:");
console.log(JSON.stringify(captureCounts, null, 2));
