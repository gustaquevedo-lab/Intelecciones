const Database = require('better-sqlite3');
const db = new Database('backend/database.sqlite');

console.log("--- DATABASE AUDIT ---");

const totalElectors = db.prepare("SELECT COUNT(*) as count FROM electors").get().count;
console.log("Total Electors:", totalElectors);

const totalCaptures = db.prepare("SELECT COUNT(*) as count FROM elector_captures").get().count;
console.log("Total Captures:", totalCaptures);

const joinedCaptures = db.prepare(`
    SELECT COUNT(*) as count 
    FROM elector_captures ec
    JOIN electors e ON ec.elector_ci = e.ci
`).get().count;
console.log("Captures with valid Elector JOIN:", joinedCaptures);

const captureSample = db.prepare(`
    SELECT ec.id, ec.elector_ci, e.nombre, e.ciudad, e.distrito
    FROM elector_captures ec
    LEFT JOIN electors e ON ec.elector_ci = e.ci
    LIMIT 5
`).all();
console.log("Capture Sample (with JOIN):", JSON.stringify(captureSample, null, 2));

const districts = db.prepare(`
    SELECT DISTINCT ciudad, distrito FROM electors WHERE ciudad != '' OR distrito != '' LIMIT 20
`).all();
console.log("Districts/Cities in Electors table:", JSON.stringify(districts, null, 2));

const campaigns = db.prepare("SELECT id, name, distrito FROM campaigns").all();
console.log("Campaigns:", JSON.stringify(campaigns, null, 2));
