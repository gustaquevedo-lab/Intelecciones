import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

// Consistently use root directory for development, /app/data for production
const dbDir = process.env.NODE_ENV === 'production' ? '/app/data' : process.cwd();
const dbPath = path.join(dbDir, 'intellecciones.db');

// Migration/Bridge: If the DB exists in 'backend/' but not in root, copy it (Dev safety)
if (process.env.NODE_ENV !== 'production') {
  const legacyPath = path.join(process.cwd(), 'backend', 'intellecciones.db');
  if (fs.existsSync(legacyPath) && !fs.existsSync(dbPath)) {
    console.log("BRIDGE: Moving database from backend/ to root...");
    fs.copyFileSync(legacyPath, dbPath);
  }
}

// Migration: If we are in production and the volume DB is an empty placeholder (< 100KB)
if (process.env.NODE_ENV === 'production') {
  const seedDbPath = path.join(process.cwd(), 'intellecciones.db');
  const exists = fs.existsSync(dbPath);
  const size = exists ? fs.statSync(dbPath).size : 0;
  
  if (size < 100000 && fs.existsSync(seedDbPath)) {
    console.log(`MIGRATION: Volume DB size is ${size}. Seed size is ${fs.statSync(seedDbPath).size}. Overwriting...`);
    try {
      if (exists) fs.unlinkSync(dbPath);
      fs.copyFileSync(seedDbPath, dbPath);
      console.log("MIGRATION SUCCESSFUL.");
    } catch (err) {
      console.error("MIGRATION FAILED:", err);
    }
  }
}

if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true });

console.log("Initializing database at:", dbPath);
const db = new Database(dbPath);
db.pragma('journal_mode = WAL');

// 🏗️ SCHEMA CONSOLIDATION
db.exec(`
  CREATE TABLE IF NOT EXISTS campaigns (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    enabled_modules TEXT DEFAULT 'COMMAND_CENTER,REGISTRY',
    status TEXT DEFAULT 'active',
    slogan TEXT,
    photo_url TEXT,
    distrito TEXT
  );

  CREATE TABLE IF NOT EXISTS lists (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    campaign_id INTEGER,
    type TEXT NOT NULL,
    list_number TEXT,
    option_number TEXT,
    candidate_ci TEXT,
    candidate_nombre TEXT,
    candidate_alias TEXT,
    goal INTEGER DEFAULT 1000,
    photo_url TEXT,
    ciudad TEXT DEFAULT '',
    is_adversary INTEGER DEFAULT 0,
    FOREIGN KEY(campaign_id) REFERENCES campaigns(id)
  );

  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password TEXT,
    role TEXT NOT NULL,
    assigned_list_id INTEGER,
    assigned_campaign_id INTEGER,
    assigned_local TEXT,
    assigned_mesa INTEGER,
    nombre TEXT,
    photo_url TEXT,
    needs_password_change INTEGER DEFAULT 0,
    parent_id INTEGER,
    telefono TEXT,
    distrito TEXT,
    ci TEXT,
    status TEXT DEFAULT 'ACTIVE',
    FOREIGN KEY(assigned_list_id) REFERENCES lists(id),
    FOREIGN KEY(assigned_campaign_id) REFERENCES campaigns(id),
    FOREIGN KEY(parent_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS voting_locations (
    cod_local TEXT PRIMARY KEY,
    nombre TEXT NOT NULL,
    lat REAL,
    lng REAL,
    direccion TEXT,
    icon TEXT DEFAULT 'Landmark',
    distrito TEXT DEFAULT ''
  );

  CREATE TABLE IF NOT EXISTS electors (
    ci TEXT PRIMARY KEY,
    nombre TEXT NOT NULL,
    apellido TEXT,
    local_votacion TEXT NOT NULL,
    mesa INTEGER NOT NULL,
    orden INTEGER NOT NULL,
    is_priority BOOLEAN DEFAULT 0,
    ciudad TEXT DEFAULT ''
  );

  CREATE TABLE IF NOT EXISTS participation_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    local_votacion TEXT NOT NULL,
    mesa INTEGER NOT NULL,
    orden INTEGER NOT NULL,
    veedor_id INTEGER,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(veedor_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS audit_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    action TEXT NOT NULL,
    entity TEXT,
    entity_id TEXT,
    details TEXT,
    list_id INTEGER,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS elector_captures (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    elector_ci TEXT,
    coordinator_id INTEGER,
    list_id INTEGER,
    campaign_id INTEGER,
    lat REAL NOT NULL,
    lng REAL NOT NULL,
    traffic_light TEXT NOT NULL,
    is_disputed BOOLEAN DEFAULT 0,
    needs_transport BOOLEAN DEFAULT 0,
    telefono TEXT,
    original_capture_id INTEGER,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS capture_conflicts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    capture_id INTEGER,
    elector_ci TEXT,
    list_id INTEGER,
    status TEXT DEFAULT 'PENDING',
    resolved_by_jefe_id INTEGER,
    resolved_coordinator_id INTEGER,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT
  );

  CREATE TABLE IF NOT EXISTS field_requests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    coordinator_id INTEGER,
    list_id INTEGER,
    type TEXT NOT NULL,
    description TEXT,
    photo_url TEXT,
    audio_url TEXT,
    status TEXT DEFAULT 'PENDING',
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS results (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tenant_id INTEGER,
    mesa INTEGER,
    local_votacion TEXT,
    votos_blancos INTEGER DEFAULT 0,
    votos_nulos INTEGER DEFAULT 0,
    foto_acta_url TEXT,
    veedor_id INTEGER,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(veedor_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS acta_results (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    acta_id INTEGER,
    lista_id INTEGER,
    votos INTEGER,
    FOREIGN KEY(acta_id) REFERENCES results(id),
    FOREIGN KEY(lista_id) REFERENCES lists(id)
  );

  CREATE TABLE IF NOT EXISTS whatsapp_terminals (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    status TEXT DEFAULT 'DISCONNECTED',
    last_qr TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS whatsapp_templates (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    content TEXT,
    media_url TEXT,
    media_type TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS whatsapp_broadcast_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    template_id INTEGER,
    terminal_id TEXT DEFAULT 'default',
    target_count INTEGER,
    success_count INTEGER DEFAULT 0,
    fail_count INTEGER DEFAULT 0,
    status TEXT DEFAULT 'RUNNING',
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS whatsapp_messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    terminal_id TEXT DEFAULT 'default',
    contact_number TEXT NOT NULL,
    contact_name TEXT,
    body TEXT,
    type TEXT DEFAULT 'chat',
    media_url TEXT,
    is_incoming INTEGER DEFAULT 0,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS vehicles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    description TEXT NOT NULL,
    driver_name TEXT,
    driver_ci TEXT,
    driver_phone TEXT,
    capacity INTEGER DEFAULT 4,
    status TEXT DEFAULT 'AVAILABLE',
    assigned_list_id INTEGER
  );

  CREATE TABLE IF NOT EXISTS login_attempts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT,
    ip TEXT,
    user_agent TEXT,
    browser TEXT,
    os TEXT,
    device TEXT,
    lat REAL,
    lng REAL,
    status TEXT,
    details TEXT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

// 🛠️ MIGRATIONS & NORMALIZATION
const runMigration = (sql: string) => { try { db.prepare(sql).run(); } catch (e) {} };
runMigration("ALTER TABLE campaigns ADD COLUMN distrito TEXT");
runMigration("ALTER TABLE lists ADD COLUMN ciudad TEXT DEFAULT ''");
runMigration("ALTER TABLE users ADD COLUMN distrito TEXT");
runMigration("ALTER TABLE users ADD COLUMN ci TEXT");
runMigration("ALTER TABLE users ADD COLUMN status TEXT DEFAULT 'ACTIVE'");
runMigration("ALTER TABLE elector_captures ADD COLUMN is_disputed INTEGER DEFAULT 0");
runMigration("ALTER TABLE elector_captures ADD COLUMN campaign_id INTEGER");
runMigration("ALTER TABLE elector_captures ADD COLUMN list_id INTEGER");

try {
  console.log('MIGRATION: Normalizando distritos a MAYÚSCULAS...');
  db.exec(`
    UPDATE electors SET ciudad = UPPER(COALESCE(NULLIF(TRIM(ciudad), ''), 'PEDRO JUAN CABALLERO')) WHERE ciudad IS NULL OR ciudad = '' OR ciudad != UPPER(ciudad);
    UPDATE voting_locations SET distrito = UPPER(COALESCE(NULLIF(TRIM(distrito), ''), 'PEDRO JUAN CABALLERO')) WHERE distrito IS NULL OR distrito = '' OR distrito != UPPER(distrito);
    UPDATE lists SET ciudad = UPPER(COALESCE(NULLIF(TRIM(ciudad), ''), 'PEDRO JUAN CABALLERO')) WHERE ciudad IS NULL OR ciudad = '' OR ciudad != UPPER(ciudad);
    UPDATE campaigns SET distrito = UPPER(COALESCE(NULLIF(TRIM(distrito), ''), 'PEDRO JUAN CABALLERO')) WHERE distrito IS NULL OR distrito = '' OR distrito != UPPER(distrito);
    UPDATE users SET distrito = UPPER(COALESCE(NULLIF(distrito, ''), 'PEDRO JUAN CABALLERO')) WHERE distrito IS NULL OR distrito = '' OR distrito != UPPER(distrito);
  `);
} catch (e) {}

// 🧹 MAINTENANCE
try {
  console.log("Running DB maintenance (VACUUM)...");
  db.pragma('wal_checkpoint(TRUNCATE)');
  db.prepare('VACUUM').run();
} catch (e) {}

/* OPTIMIZATION INDEXES */
db.prepare("CREATE INDEX IF NOT EXISTS idx_electors_local_mesa ON electors (local_votacion, mesa)").run();
db.prepare("CREATE INDEX IF NOT EXISTS idx_users_parent ON users (parent_id)").run();
db.prepare("CREATE INDEX IF NOT EXISTS idx_elector_captures_ci ON elector_captures(elector_ci)").run();

/* INITIAL SEEDS */
db.exec(`
  -- Settings
  INSERT OR IGNORE INTO settings (key, value) VALUES ('election_date', '2026-06-07T07:00:00');
  INSERT OR IGNORE INTO settings (key, value) VALUES ('master_key', 'admin123');
  INSERT OR IGNORE INTO settings (key, value) VALUES ('share_message', 'Hola! Te comparto los datos de este elector consultado en la plataforma Intellecciones PLRA:');

  -- Users
  INSERT OR IGNORE INTO users (id, username, password, role, nombre) VALUES (1, 'admin', 'admin123', 'SUPERUSUARIO', 'Administrador General');
  INSERT OR IGNORE INTO users (id, username, password, role, nombre, ci, distrito) VALUES (2, '5888408', '123', 'SUPERUSUARIO', 'Gustavo Quevedo', '5888408', 'PEDRO JUAN CABALLERO');
  INSERT OR IGNORE INTO users (id, username, password, role, nombre, ci, distrito) VALUES (3, '4931831', '123', 'COORDINADOR', 'Coordinador Gustavo', '4931831', 'PEDRO JUAN CABALLERO');
  INSERT OR IGNORE INTO users (id, username, password, role, nombre, ci, distrito, assigned_list_id) VALUES (4, '111', '111', 'COORDINADOR', 'Coord Lista 3', '111', 'PEDRO JUAN CABALLERO', 1);
  INSERT OR IGNORE INTO users (id, username, password, role, nombre, ci, distrito, assigned_list_id) VALUES (5, '222', '222', 'PADRINO', 'Padrino Lista 3', '222', 'PEDRO JUAN CABALLERO', 1);
  UPDATE users SET parent_id = 5 WHERE id = 4;

  -- Campaigns & Lists
  INSERT OR IGNORE INTO campaigns (id, name, distrito) VALUES (1, 'Elecciones 2026', 'PEDRO JUAN CABALLERO');
  INSERT OR IGNORE INTO lists (id, campaign_id, type, list_number, ciudad) VALUES (1, 1, 'INTERNA', '3', 'PEDRO JUAN CABALLERO');

  -- Voting Locations
  INSERT OR IGNORE INTO voting_locations (cod_local, nombre, lat, lng, distrito) VALUES ('L1', 'COL. NAC. CERRO CORA EX JUAN E O''LEARY', -22.545, -55.725, 'PEDRO JUAN CABALLERO');
  INSERT OR IGNORE INTO voting_locations (cod_local, nombre, lat, lng, distrito) VALUES ('L2', 'ESC. BAS. CARLOS ANTONIO LOPEZ', -22.535, -55.715, 'PEDRO JUAN CABALLERO');
  INSERT OR IGNORE INTO voting_locations (cod_local, nombre, lat, lng, distrito) VALUES ('L3', 'ESC. BASICA NRO. 1951 JUAN EMILIANO OLEARY', -22.555, -55.735, 'PEDRO JUAN CABALLERO');
  INSERT OR IGNORE INTO voting_locations (cod_local, nombre, lat, lng, distrito) VALUES ('L4', 'FACULTAD DE CIENCIAS AGRARIAS', -22.525, -55.705, 'PEDRO JUAN CABALLERO');
  INSERT OR IGNORE INTO voting_locations (cod_local, nombre, lat, lng, distrito) VALUES ('L5', 'COL. NAC. ASUNCION ESCALADA', -22.545, -55.725, 'PEDRO JUAN CABALLERO');
  INSERT OR IGNORE INTO voting_locations (cod_local, nombre, lat, lng, distrito) VALUES ('L6', 'CENTRO REGIONAL DE EDUCACION', -22.545, -55.725, 'PEDRO JUAN CABALLERO');
`);

export default db;
