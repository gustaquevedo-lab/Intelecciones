const Database = require('better-sqlite3');
const db = new Database('intellecciones.db');

try {
    const stats = db.prepare(`
        SELECT 
            local_votacion, 
            mesa, 
            COUNT(*) as total 
        FROM electors 
        GROUP BY local_votacion, mesa 
        ORDER BY total DESC 
        LIMIT 10
    `).all();

    const avg = db.prepare(`
        SELECT AVG(total) as promedio FROM (
            SELECT COUNT(*) as total FROM electors GROUP BY local_votacion, mesa
        )
    `).get();

    console.log('--- ESTADÍSTICAS POR MESA ---');
    console.log(`Promedio de electores por mesa: ${Math.round(avg.promedio)}`);
    console.log('\nTop 10 mesas con más electores:');
    stats.forEach(s => {
        console.log(`${s.local_votacion} - Mesa ${s.mesa}: ${s.total} electores`);
    });
} catch (err) {
    console.error(err);
}
