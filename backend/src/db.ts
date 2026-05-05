import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

// Use path relative to /app/data for Railway persistence
const dbDir = process.env.NODE_ENV === 'production' ? '/app/data' : process.cwd();
let dbPath = path.join(dbDir, 'intellecciones.db');

// Development safety: check if DB exists in backend/ if not in root
if (process.env.NODE_ENV !== 'production' && !fs.existsSync(dbPath)) {
  const altPath = path.join(dbDir, 'backend', 'intellecciones.db');
  if (fs.existsSync(altPath)) {
    dbPath = altPath;
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

// Initialize Tables
db.exec(`
  CREATE TABLE IF NOT EXISTS campaigns (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    enabled_modules TEXT DEFAULT 'COMMAND_CENTER,REGISTRY',
    status TEXT DEFAULT 'active',
    slogan TEXT,
    photo_url TEXT
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
    FOREIGN KEY(assigned_list_id) REFERENCES lists(id),
    FOREIGN KEY(assigned_campaign_id) REFERENCES campaigns(id),
    FOREIGN KEY(parent_id) REFERENCES users(id)
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
    local_votacion TEXT NOT NULL,
    mesa INTEGER NOT NULL,
    orden INTEGER NOT NULL,
    is_priority BOOLEAN DEFAULT 0
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
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS whatsapp_broadcast_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    template_id INTEGER,
    target_count INTEGER,
    success_count INTEGER DEFAULT 0,
    fail_count INTEGER DEFAULT 0,
    status TEXT DEFAULT 'RUNNING', -- 'RUNNING', 'COMPLETED', 'FAILED'
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  INSERT OR IGNORE INTO settings (key, value) VALUES ('election_date', '2026-06-07T07:00:00');
  INSERT OR IGNORE INTO settings (key, value) VALUES ('master_key', 'admin123');
  INSERT OR IGNORE INTO settings (key, value) VALUES ('share_message', 'Hola! Te comparto los datos de este elector consultado en la plataforma Intellecciones PLRA:');
  INSERT OR IGNORE INTO settings (key, value) VALUES ('share_message_footer', 'Enviado desde el Comando Central.');
  INSERT OR IGNORE INTO settings (key, value) VALUES ('app_logo_url', '');
`);

try {
  db.prepare("ALTER TABLE campaigns ADD COLUMN slogan TEXT").run();
} catch (e) {}
try {
  db.prepare("ALTER TABLE campaigns ADD COLUMN photo_url TEXT").run();
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


/* Ensure default Super Admin exists */
db.prepare(`
  INSERT OR REPLACE INTO users (id, username, password, role, nombre) 
  VALUES (1, 'admin', 'admin123', 'SUPERUSUARIO', 'Administrador General')
`).run();

export default db;
