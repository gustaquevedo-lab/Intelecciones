const Database = require('better-sqlite3');
const path = require('path');

const db = new Database(path.join(__dirname, '../intellecciones.db'));

// Initialize Tables (v2 with electoral profiles)
db.exec(`
  CREATE TABLE IF NOT EXISTS tenants (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    party TEXT NOT NULL,
    candidate_ci TEXT,
    election_type TEXT,
    position TEXT,
    list_number TEXT,
    option_number TEXT,
    city TEXT,
    department TEXT,
    domain TEXT,
    status TEXT DEFAULT 'active'
  );

  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tenant_id INTEGER,
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    role TEXT NOT NULL,
    nombre TEXT,
    FOREIGN KEY(tenant_id) REFERENCES tenants(id)
  );

  CREATE TABLE IF NOT EXISTS electors (
    ci TEXT PRIMARY KEY,
    nombre TEXT NOT NULL,
    departamento TEXT NOT NULL,
    distrito TEXT NOT NULL,
    local_votacion TEXT NOT NULL,
    barrio TEXT,
    mesa INTEGER NOT NULL,
    orden INTEGER NOT NULL,
    partido TEXT,
    lat REAL,
    lng REAL,
    status TEXT DEFAULT 'Pendiente',
    is_priority BOOLEAN DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS tenant_electors (
    tenant_id INTEGER,
    elector_ci TEXT,
    needs_transport BOOLEAN DEFAULT 0,
    is_verified_address BOOLEAN DEFAULT 0,
    status TEXT DEFAULT 'Pendiente',
    last_visit DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY(tenant_id, elector_ci),
    FOREIGN KEY(tenant_id) REFERENCES tenants(id),
    FOREIGN KEY(elector_ci) REFERENCES electors(ci)
  );

  CREATE TABLE IF NOT EXISTS elector_locations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tenant_id INTEGER,
    elector_ci TEXT,
    lat REAL NOT NULL,
    lng REAL NOT NULL,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    is_home BOOLEAN DEFAULT 0,
    FOREIGN KEY(tenant_id) REFERENCES tenants(id),
    FOREIGN KEY(elector_ci) REFERENCES electors(ci)
  );

  CREATE TABLE IF NOT EXISTS results (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tenant_id INTEGER,
    mesa INTEGER NOT NULL,
    local_votacion TEXT NOT NULL,
    votos_nuestro INTEGER DEFAULT 0,
    votos_oponente_1 INTEGER DEFAULT 0,
    votos_oponente_2 INTEGER DEFAULT 0,
    votos_otros INTEGER DEFAULT 0,
    votos_nulos INTEGER DEFAULT 0,
    votos_blancos INTEGER DEFAULT 0,
    foto_acta_url TEXT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(tenant_id, mesa),
    FOREIGN KEY(tenant_id) REFERENCES tenants(id)
  );
`);

const seed = () => {
    // 1. Create Default Tenants
    db.prepare("INSERT OR IGNORE INTO tenants (id, name, party, candidate_ci, election_type, position, city, department) VALUES (1, 'Santiago Peña - PJC', 'ANR', '4500001', 'Municipales', 'Intendente', 'PEDRO JUAN CABALLERO', 'AMAMBAY')").run();
    db.prepare("INSERT OR IGNORE INTO tenants (id, name, party, candidate_ci, election_type, position, city, department) VALUES (2, 'Efrain Alegre - PJC', 'PLRA', '4500002', 'Municipales', 'Intendente', 'PEDRO JUAN CABALLERO', 'AMAMBAY')").run();

    // 2. Create Users
    db.prepare("INSERT OR IGNORE INTO users (tenant_id, username, password, role, nombre) VALUES (1, 'admin', 'admin', 'SUPER_ADMIN', 'Gustavo Quevedo')").run();
    db.prepare("INSERT OR IGNORE INTO users (tenant_id, username, password, role, nombre) VALUES (1, 'candidato', '123', 'CANDIDATE', 'Santiago Peña')").run();
    db.prepare("INSERT OR IGNORE INTO users (tenant_id, username, password, role, nombre) VALUES (2, 'liberal', '123', 'CANDIDATE', 'Efrain Alegre')").run();

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

    console.log('Database initialized and seeded (v2) successfully!');
};

seed();
