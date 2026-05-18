const Database = require('better-sqlite3');
const path = require('path');
const dbPath = path.join(__dirname, '..', 'intellecciones.db');
const db = new Database(dbPath);

try {
    console.log("Connected to DB:", dbPath);
    
    // 1. Analyze campaign and list districts/cities
    const campaigns = db.prepare("SELECT id, name, distrito FROM campaigns").all();
    console.log("Campaigns in DB:", campaigns);
    
    const lists = db.prepare("SELECT id, type, list_number, ciudad FROM lists").all();
    console.log("Lists in DB:", lists);

    // 2. Measure performance of original queries vs optimized index-based queries
    const d = "PEDRO JUAN CABALLERO";

    console.log("\n--- TIMING ORIGINAL ACCENT-FOLDING QUERY ---");
    const t0 = Date.now();
    const countOriginal = db.prepare(`
        SELECT COUNT(*) as count FROM electors e 
        WHERE REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(UPPER(e.ciudad),'Á','A'),'É','E'),'Í','I'),'Ó','O'),'Ú','U'),'á','A'),'é','E'),'í','I'),'ó','O'),'ú','U') = ?
    `).get(d);
    const t1 = Date.now();
    console.log(`Original count: ${countOriginal.count} in ${t1 - t0}ms`);

    console.log("\n--- TIMING OPTIMIZED INDEX-BASED QUERY ---");
    const t2 = Date.now();
    const countOptimized = db.prepare(`
        SELECT COUNT(*) as count FROM electors e 
        WHERE e.ciudad = ? OR e.distrito = ?
    `).get(d, d);
    const t3 = Date.now();
    console.log(`Optimized count: ${countOptimized.count} in ${t3 - t2}ms`);

    // 3. Check for any accents in the electors table
    const accentedElectors = db.prepare(`
        SELECT COUNT(*) as count FROM electors 
        WHERE ciudad LIKE '%Á%' OR ciudad LIKE '%É%' OR ciudad LIKE '%Í%' OR ciudad LIKE '%Ó%' OR ciudad LIKE '%Ú%'
           OR distrito LIKE '%Á%' OR distrito LIKE '%É%' OR distrito LIKE '%Í%' OR distrito LIKE '%Ó%' OR distrito LIKE '%Ú%'
    `).get();
    console.log(`\nElectors with accented cities/districts in database: ${accentedElectors.count}`);

} catch (err) {
    console.error(err);
}
