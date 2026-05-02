const Database = require('better-sqlite3');
const path = require('path');

const db = new Database(path.join(__dirname, '../intellecciones.db'));

const seed = () => {
    // 3. Create Sample Electors
    const electors = [
        { ci: '4500001', nombre: 'JUAN PEREZ', departamento: 'AMAMBAY', distrito: 'PEDRO JUAN CABALLERO', local_votacion: 'CENTRO REGIONAL DE EDUCACION', barrio: 'CENTRO', mesa: 1, orden: 10, lat: -22.5401, lng: -55.7289 },
        { ci: '4500002', nombre: 'MARIA GARCIA', departamento: 'AMAMBAY', distrito: 'PEDRO JUAN CABALLERO', local_votacion: 'CENTRO REGIONAL DE EDUCACION', barrio: 'CENTRO', mesa: 1, orden: 25, lat: -22.5415, lng: -55.7295 },
        { ci: '4500003', nombre: 'PEDRO RAMIREZ', departamento: 'AMAMBAY', distrito: 'PEDRO JUAN CABALLERO', local_votacion: 'COLEGIO ASUNCION ESCALADA', barrio: 'SAN GERARDO', mesa: 5, orden: 150, lat: -22.5450, lng: -55.7320 },
        { ci: '4500004', nombre: 'LAURA BENITEZ', departamento: 'AMAMBAY', distrito: 'PEDRO JUAN CABALLERO', local_votacion: 'COLEGIO ASUNCION ESCALADA', barrio: 'SAN GERARDO', mesa: 5, orden: 12, lat: -22.5460, lng: -55.7330 },
        { ci: '4500005', nombre: 'CARLOS MARTINEZ', departamento: 'AMAMBAY', distrito: 'PEDRO JUAN CABALLERO', local_votacion: 'ESCUELA BASICA 1300', barrio: 'OBRERO', mesa: 12, orden: 45, lat: -22.5500, lng: -55.7400 }
    ];

    const insertElector = db.prepare(`
        INSERT OR IGNORE INTO electors (ci, nombre, departamento, distrito, local_votacion, barrio, mesa, orden, lat, lng)
        VALUES (@ci, @nombre, @departamento, @distrito, @local_votacion, @barrio, @mesa, @orden, @lat, @lng)
    `);

    electors.forEach(e => insertElector.run(e));

    console.log('Database seeded with sample electors!');
};

seed();
