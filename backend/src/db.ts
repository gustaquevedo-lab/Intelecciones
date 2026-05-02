import Database from 'better-sqlite3';
import path from 'path';

const db = new Database(path.join(__dirname, '../intellecciones.db'));

// Initialize Tables
db.exec(`
  CREATE TABLE IF NOT EXISTS campaigns (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    status TEXT DEFAULT 'active'
  );

  CREATE TABLE IF NOT EXISTS lists (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    campaign_id INTEGER,
    type TEXT NOT NULL, -- 'INTENDENTE' | 'CONCEJAL'
    list_number TEXT,
    option_number TEXT,
    candidate_ci TEXT,
    goal INTEGER DEFAULT 1000,
    photo_url TEXT,
    FOREIGN KEY(campaign_id) REFERENCES campaigns(id),
    FOREIGN KEY(candidate_ci) REFERENCES electors(ci)
  );

  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password TEXT,
    role TEXT NOT NULL, -- 'SUPERUSUARIO', 'JEFE_CAMPANA', 'COORDINADOR'
    assigned_list_id INTEGER, -- For coordinators
    nombre TEXT,
    photo_url TEXT,
    FOREIGN KEY(assigned_list_id) REFERENCES lists(id)
  );

  CREATE TABLE IF NOT EXISTS voting_locations (
    cod_local TEXT PRIMARY KEY,
    nombre TEXT NOT NULL,
    lat REAL,
    lng REAL
  );

  CREATE TABLE IF NOT EXISTS electors (
    ci TEXT PRIMARY KEY,
    nombre TEXT NOT NULL,
    apellido TEXT,
    fecha_nacimiento TEXT,
    sexo TEXT,
    departamento TEXT DEFAULT 'AMAMBAY',
    distrito TEXT DEFAULT 'PEDRO JUAN CABALLERO',
    local_votacion TEXT NOT NULL,
    cod_local TEXT,
    direccion TEXT,
    barrio TEXT,
    mesa INTEGER NOT NULL,
    orden INTEGER NOT NULL,
    partido TEXT, -- Partido de afiliación original del padrón
    tipo TEXT,
    edad INTEGER,
    lat REAL,
    lng REAL,
    photo_url TEXT,
    coordinador_asignado TEXT,
    status TEXT DEFAULT 'Pendiente',
    is_priority BOOLEAN DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS audit_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    action TEXT NOT NULL,
    entity TEXT,
    entity_id TEXT,
    details TEXT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS elector_captures (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    elector_ci TEXT,
    coordinator_id INTEGER,
    list_id INTEGER, -- Multi-tenant identifier
    lat REAL NOT NULL,
    lng REAL NOT NULL,
    traffic_light TEXT NOT NULL, -- 'GREEN', 'YELLOW', 'RED'
    is_disputed BOOLEAN DEFAULT 0,
    needs_transport BOOLEAN DEFAULT 0,
    assigned_vehicle_id INTEGER,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(elector_ci) REFERENCES electors(ci),
    FOREIGN KEY(coordinator_id) REFERENCES users(id),
    FOREIGN KEY(list_id) REFERENCES lists(id),
    FOREIGN KEY(assigned_vehicle_id) REFERENCES vehicles(id)
  );

  CREATE TABLE IF NOT EXISTS capture_conflicts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    capture_id INTEGER,
    elector_ci TEXT,
    list_id INTEGER, -- Multi-tenant identifier
    resolved_by_jefe_id INTEGER,
    resolved_coordinator_id INTEGER,
    status TEXT DEFAULT 'PENDING', -- 'PENDING', 'RESOLVED'
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(capture_id) REFERENCES elector_captures(id),
    FOREIGN KEY(elector_ci) REFERENCES electors(ci),
    FOREIGN KEY(list_id) REFERENCES lists(id),
    FOREIGN KEY(resolved_by_jefe_id) REFERENCES users(id),
    FOREIGN KEY(resolved_coordinator_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT
  );

  CREATE TABLE IF NOT EXISTS vehicles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    description TEXT NOT NULL,
    driver_name TEXT,
    driver_phone TEXT,
    assigned_list_id INTEGER,
    list_id INTEGER, -- Multi-tenant identifier
    status TEXT DEFAULT 'AVAILABLE',
    assigned_user_id INTEGER,
    FOREIGN KEY(assigned_list_id) REFERENCES lists(id),
    FOREIGN KEY(list_id) REFERENCES lists(id),
    FOREIGN KEY(assigned_user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS field_requests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    coordinator_id INTEGER,
    list_id INTEGER, -- Multi-tenant identifier
    type TEXT NOT NULL, -- 'TRANSPORT', 'RESOURCES', 'CONFLICT', 'OTHER'
    description TEXT,
    status TEXT DEFAULT 'PENDING', -- 'PENDING', 'APPROVED', 'REJECTED'
    priority TEXT DEFAULT 'NORMAL', -- 'NORMAL', 'HIGH', 'CRITICAL'
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    resolved_at DATETIME,
    resolved_by_id INTEGER,
    FOREIGN KEY(coordinator_id) REFERENCES users(id),
    FOREIGN KEY(resolved_by_id) REFERENCES users(id)
  );

  INSERT OR IGNORE INTO settings (key, value) VALUES ('election_date', '2026-06-07T07:00:00');
  INSERT OR IGNORE INTO settings (key, value) VALUES ('election_end_time', '17:00');
  INSERT OR IGNORE INTO settings (key, value) VALUES ('app_name', 'INTELECCIONES 2026');
  INSERT OR IGNORE INTO settings (key, value) VALUES ('app_logo_url', '');
  INSERT OR IGNORE INTO settings (key, value) VALUES ('master_key', 'admin123');
`);

// 🚀 Database Migrations (Run once)
try {
  db.exec("ALTER TABLE elector_captures ADD COLUMN needs_transport BOOLEAN DEFAULT 0");
} catch (e) {}
try {
  db.exec("ALTER TABLE elector_captures ADD COLUMN assigned_vehicle_id INTEGER");
} catch (e) {}
try {
  db.exec("ALTER TABLE lists ADD COLUMN goal INTEGER DEFAULT 1000");
} catch (e) {}
try {
  db.exec("ALTER TABLE lists ADD COLUMN photo_url TEXT");
} catch (e) {}
try {
  db.exec("ALTER TABLE vehicles ADD COLUMN driver_ci TEXT");
} catch (e) {}
try {
  db.exec("ALTER TABLE vehicles ADD COLUMN capacity INTEGER DEFAULT 4");
} catch (e) {}
try {
  db.exec("ALTER TABLE vehicles ADD COLUMN status TEXT DEFAULT 'AVAILABLE'");
} catch (e) {}
try {
  db.exec("ALTER TABLE vehicles ADD COLUMN assigned_user_id INTEGER");
} catch (e) {}
try {
  db.exec("ALTER TABLE elector_captures ADD COLUMN telefono TEXT");
} catch (e) {}
try {
  db.exec("ALTER TABLE vehicles ADD COLUMN type TEXT");
} catch (e) {}
try {
  db.exec("ALTER TABLE campaigns ADD COLUMN enabled_modules TEXT DEFAULT 'COMMAND_CENTER,REGISTRY'");
} catch (e) {}
try {
  db.exec("ALTER TABLE elector_captures ADD COLUMN list_id INTEGER");
} catch (e) {}
try {
  db.exec("ALTER TABLE capture_conflicts ADD COLUMN list_id INTEGER");
} catch (e) {}
try {
  db.exec("ALTER TABLE field_requests ADD COLUMN list_id INTEGER");
} catch (e) {}
try {
  db.exec("ALTER TABLE audit_logs ADD COLUMN list_id INTEGER");
} catch (e) {}

export default db;
