import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

// Use path relative to /app/data for Railway persistence
const dbDir = process.env.NODE_ENV === 'production' ? '/app/data' : process.cwd();
let dbPath = path.join(dbDir, 'intellecciones.db');

// Development safety: Prioritize backend/intellecciones.db if it exists and is not empty
if (process.env.NODE_ENV !== 'production') {
  const backendPath = path.join(dbDir, 'backend', 'intellecciones.db');
  const rootPath = path.join(dbDir, 'intellecciones.db');
  
  const backendExists = fs.existsSync(backendPath) && fs.statSync(backendPath).size > 1024;
  const rootExists = fs.existsSync(rootPath) && fs.statSync(rootPath).size > 1024;

  if (backendExists) {
    dbPath = backendPath;
  } else if (rootExists) {
    dbPath = rootPath;
  } else {
    // Fallback to backend if both are empty or missing
    dbPath = backendPath;
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
      if (exists) fs.unlinkSync(dbPath); // Delete the small one first
      fs.copyFileSync(seedDbPath, dbPath);
      console.log("MIGRATION SUCCESSFUL.");
    } catch (err) {
      console.error("MIGRATION FAILED:", err);
    }
  }
}

if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

console.log("Initializing database at:", dbPath);
const db = new Database(dbPath);
db.pragma('journal_mode = WAL'); // Enable WAL mode for better performance

// Initialize Tables
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
    FOREIGN KEY(campaign_id) REFERENCES campaigns(id)
  );

  -- Migration for 'ciudad' in lists
  PRAGMA foreign_keys=off;
  BEGIN TRANSACTION;
  -- Doing it programmatically below
  COMMIT;
  PRAGMA foreign_keys=on;

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
    lat REAL NOT NULL,
    lng REAL NOT NULL,
    traffic_light TEXT NOT NULL,
    is_disputed BOOLEAN DEFAULT 0,
    needs_transport BOOLEAN DEFAULT 0,
    telefono TEXT,
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

  CREATE TABLE IF NOT EXISTS vehicles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    description TEXT NOT NULL,
    driver_name TEXT,
    driver_ci TEXT,
    driver_phone TEXT,
    capacity INTEGER DEFAULT 4,
    status TEXT DEFAULT 'AVAILABLE',
    assigned_list_id INTEGER,
    list_id INTEGER
  );

  CREATE TABLE IF NOT EXISTS field_requests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    coordinator_id INTEGER,
    list_id INTEGER,
    type TEXT NOT NULL,
    description TEXT,
    status TEXT DEFAULT 'PENDING',
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS whatsapp_templates (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    content TEXT,
    media_url TEXT,
    media_type TEXT, -- 'IMAGE', 'VIDEO', 'AUDIO', 'VOICE', 'LOCATION'
    lat REAL,
    lng REAL,
    contact_name TEXT,
    contact_phone TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS whatsapp_broadcast_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    template_id INTEGER,
    terminal_id TEXT DEFAULT 'default',
    target_count INTEGER,
    success_count INTEGER DEFAULT 0,
    fail_count INTEGER DEFAULT 0,
    status TEXT DEFAULT 'RUNNING', -- 'RUNNING', 'COMPLETED', 'FAILED'
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS whatsapp_terminals (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    status TEXT DEFAULT 'DISCONNECTED',
    last_qr TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS whatsapp_messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    terminal_id TEXT DEFAULT 'default',
    contact_number TEXT NOT NULL,
    contact_name TEXT,
    body TEXT,
    type TEXT DEFAULT 'chat', -- 'chat', 'image', 'video', 'ptt', 'location', 'vcard'
    media_url TEXT,
    is_incoming INTEGER DEFAULT 0, -- 1 for true, 0 for false
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  INSERT OR IGNORE INTO settings (key, value) VALUES ('election_date', '2026-06-07T07:00:00');
  INSERT OR IGNORE INTO settings (key, value) VALUES ('master_key', 'admin123');
  INSERT OR IGNORE INTO settings (key, value) VALUES ('share_message', 'Hola! Te comparto los datos de este elector consultado en la plataforma Intellecciones PLRA:');
  INSERT OR IGNORE INTO settings (key, value) VALUES ('share_message_footer', 'Enviado desde el Comando Central.');
  INSERT OR IGNORE INTO settings (key, value) VALUES ('app_logo_url', '');

  -- Performance Indexes
  CREATE INDEX IF NOT EXISTS idx_elector_captures_ci ON elector_captures(elector_ci);
  CREATE INDEX IF NOT EXISTS idx_elector_captures_list ON elector_captures(list_id);
  CREATE INDEX IF NOT EXISTS idx_elector_captures_coord ON elector_captures(coordinator_id);
  CREATE INDEX IF NOT EXISTS idx_elector_captures_timestamp ON elector_captures(timestamp);
  CREATE INDEX IF NOT EXISTS idx_electors_local ON electors(local_votacion);
  CREATE INDEX IF NOT EXISTS idx_electors_mesa ON electors(mesa);
  CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp ON audit_logs(timestamp);
  CREATE INDEX IF NOT EXISTS idx_participation_logs_mesa ON participation_logs(mesa);
`);

const listColumns = db.prepare('PRAGMA table_info(lists)').all() as any[];
if (!listColumns.some(c => c.name === 'ciudad')) {
  console.log("Migrating lists table to add 'ciudad' column...");
  db.prepare("ALTER TABLE lists ADD COLUMN ciudad TEXT DEFAULT ''").run();
  db.prepare("UPDATE lists SET ciudad = 'PEDRO JUAN CABALLERO'").run();
  console.log("Migration complete.");
}

try {
  db.prepare("ALTER TABLE campaigns ADD COLUMN slogan TEXT").run();
} catch (e) {}
try {
  db.prepare("ALTER TABLE campaigns ADD COLUMN photo_url TEXT").run();
} catch (e) {}

try {
  db.prepare("ALTER TABLE campaigns ADD COLUMN distrito TEXT").run();
} catch (e) {}

// Migration: Add new columns if they don't exist
try {
  db.prepare("ALTER TABLE lists ADD COLUMN candidate_nombre TEXT").run();
} catch (e) {}
try {
  db.prepare("ALTER TABLE lists ADD COLUMN candidate_alias TEXT").run();
} catch (e) {}

// User migrations
try {
  db.prepare("ALTER TABLE users ADD COLUMN parent_id INTEGER").run();
} catch (e) {}
try {
  db.prepare("ALTER TABLE users ADD COLUMN telefono TEXT").run();
} catch (e) {}
try {
  db.prepare("ALTER TABLE users ADD COLUMN ci TEXT").run();
} catch (e) {}
try {
  db.prepare('ALTER TABLE users ADD COLUMN needs_password_change INTEGER DEFAULT 0').run();
  console.log('Migration: Added needs_password_change to users');
} catch (e) {}

// Field requests migrations
try {
  db.prepare('ALTER TABLE field_requests ADD COLUMN photo_url TEXT').run();
  db.prepare('ALTER TABLE field_requests ADD COLUMN audio_url TEXT').run();
  console.log('Migration: Added multimedia columns to field_requests');
} catch (e) {}

// Capture conflicts migrations
try {
  db.prepare('ALTER TABLE capture_conflicts ADD COLUMN resolved_by_jefe_id INTEGER').run();
  db.prepare('ALTER TABLE capture_conflicts ADD COLUMN resolved_coordinator_id INTEGER').run();
  console.log('Migration: Added resolution columns to capture_conflicts');
} catch (e) {}

// Lists migrations
try {
  db.prepare("ALTER TABLE lists ADD COLUMN is_adversary INTEGER DEFAULT 0").run();
} catch (e) {}

// Results refactor table
db.exec(`
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
`);


/* Optimization Indexes */
db.prepare("CREATE INDEX IF NOT EXISTS idx_electors_local_mesa ON electors (local_votacion, mesa)").run();
db.prepare("CREATE INDEX IF NOT EXISTS idx_captures_ci_list ON elector_captures (elector_ci, list_id)").run();
db.prepare("CREATE INDEX IF NOT EXISTS idx_users_parent ON users (parent_id)").run();

/* Ensure default Super Admin exists */
db.prepare(`
  INSERT OR IGNORE INTO users (id, username, password, role, nombre) 
  VALUES (1, 'admin', 'admin123', 'SUPERUSUARIO', 'Administrador General')
`).run();

export default db;
