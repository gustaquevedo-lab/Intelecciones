import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

// Use path relative to /app/data for Railway persistence
const dbDir = process.env.NODE_ENV === 'production' ? '/app/data' : process.cwd();
const dbPath = path.join(dbDir, 'intellecciones.db');

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
    status TEXT DEFAULT 'active'
  );

  CREATE TABLE IF NOT EXISTS lists (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    campaign_id INTEGER,
    type TEXT NOT NULL,
    list_number TEXT,
    option_number TEXT,
    candidate_ci TEXT,
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
    local_votacion TEXT NOT NULL,
    mesa INTEGER NOT NULL,
    orden INTEGER NOT NULL,
    is_priority BOOLEAN DEFAULT 0
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

  INSERT OR IGNORE INTO settings (key, value) VALUES ('election_date', '2026-06-07T07:00:00');
  INSERT OR IGNORE INTO settings (key, value) VALUES ('master_key', 'admin123');
`);

/* Ensure default Super Admin exists */
db.prepare(`
  INSERT OR REPLACE INTO users (id, username, password, role, nombre) 
  VALUES (1, 'admin', 'admin123', 'SUPERUSUARIO', 'Administrador General')
`).run();

export default db;
