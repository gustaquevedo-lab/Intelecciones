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
    distrito TEXT,
    goal INTEGER DEFAULT 1000
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
const runMigration = (sql: string) => { 
  try { 
    const result = db.prepare(sql).run(); 
    if (result.changes > 0) console.log(`MIGRATION SUCCESS: ${sql.slice(0, 50)}... (${result.changes} rows)`);
  } catch (e: any) {
    console.error(`MIGRATION FAILED: ${sql.slice(0, 50)}... Error: ${e.message}`);
  } 
};
runMigration("ALTER TABLE campaigns ADD COLUMN goal INTEGER DEFAULT 1000");
runMigration("ALTER TABLE campaigns ADD COLUMN distrito TEXT");
runMigration("ALTER TABLE lists ADD COLUMN ciudad TEXT DEFAULT ''");
runMigration("ALTER TABLE users ADD COLUMN distrito TEXT");
runMigration("ALTER TABLE users ADD COLUMN ci TEXT");
runMigration("ALTER TABLE users ADD COLUMN status TEXT DEFAULT 'ACTIVE'");
runMigration("ALTER TABLE elector_captures ADD COLUMN is_disputed INTEGER DEFAULT 0");
runMigration("ALTER TABLE elector_captures ADD COLUMN campaign_id INTEGER");
runMigration("ALTER TABLE elector_captures ADD COLUMN list_id INTEGER");
runMigration("ALTER TABLE electors ADD COLUMN ciudad TEXT DEFAULT ''");
runMigration("ALTER TABLE participation_logs ADD COLUMN veedor_id INTEGER");
runMigration("ALTER TABLE results ADD COLUMN veedor_id INTEGER");
runMigration("ALTER TABLE voting_locations ADD COLUMN distrito TEXT DEFAULT ''");
runMigration("ALTER TABLE campaigns ADD COLUMN enabled_modules TEXT DEFAULT 'COMMAND_CENTER,REGISTRY'");
runMigration("ALTER TABLE users ADD COLUMN enabled_modules TEXT");
runMigration("ALTER TABLE users ADD COLUMN parent_id INTEGER");
runMigration("ALTER TABLE users ADD COLUMN telefono TEXT");
runMigration("ALTER TABLE campaigns ADD COLUMN goal INTEGER DEFAULT 1000");
runMigration(`
  UPDATE users 
  SET assigned_list_id = (SELECT id FROM lists WHERE list_number = '3' AND (option_number = '3' OR candidate_alias LIKE '%Lourdes%') LIMIT 1),
      assigned_campaign_id = 3
  WHERE (assigned_list_id = 1 OR assigned_list_id IS NULL)
    AND role != 'SUPERUSUARIO' 
    AND username NOT IN ('4500001', 'admin', '3657834')
`);
runMigration("UPDATE users SET assigned_list_id = NULL WHERE username = '4500001' OR ci = '4500001'");
console.log("DB: Executed mandatory list reset for user 4500001.");


try {
  console.log('MIGRATION: Normalizando distritos a MAYÚSCULAS...');
  db.exec(`
    UPDATE electors SET ciudad = UPPER(TRIM(ciudad)) WHERE ciudad IS NOT NULL AND ciudad != '';
    UPDATE voting_locations SET distrito = UPPER(TRIM(distrito)) WHERE distrito IS NOT NULL AND distrito != '';
    UPDATE lists SET ciudad = UPPER(TRIM(ciudad)) WHERE ciudad IS NOT NULL AND ciudad != '';
    UPDATE campaigns SET distrito = UPPER(TRIM(distrito)) WHERE distrito IS NOT NULL AND distrito != '';
    UPDATE users SET distrito = UPPER(TRIM(distrito)) WHERE distrito IS NOT NULL AND distrito != '';
    UPDATE users SET distrito = 'PEDRO JUAN CABALLERO' WHERE (distrito IS NULL OR TRIM(distrito) = '') AND role != 'SUPERUSUARIO';
  `);
} catch (e) {}

// 🧹 MAINTENANCE (Disabled on startup to avoid locking)
try {
  // Only checkpointing WAL to keep the file size manageable without full VACUUM
  db.pragma('wal_checkpoint(PASSIVE)');
} catch (e) {}

/* OPTIMIZATION INDEXES */
db.prepare("CREATE INDEX IF NOT EXISTS idx_electors_local_mesa ON electors (local_votacion, mesa)").run();
db.prepare("CREATE INDEX IF NOT EXISTS idx_electors_ciudad ON electors (ciudad)").run();
db.prepare("CREATE INDEX IF NOT EXISTS idx_users_parent ON users (parent_id)").run();
db.prepare("CREATE INDEX IF NOT EXISTS idx_users_ci ON users (ci)").run();
db.prepare("CREATE INDEX IF NOT EXISTS idx_users_list ON users (assigned_list_id)").run();
db.prepare("CREATE INDEX IF NOT EXISTS idx_elector_captures_ci ON elector_captures(elector_ci)").run();
db.prepare("CREATE INDEX IF NOT EXISTS idx_elector_captures_campaign ON elector_captures(campaign_id)").run();
db.prepare("CREATE INDEX IF NOT EXISTS idx_elector_captures_list ON elector_captures(list_id)").run();
db.prepare("CREATE INDEX IF NOT EXISTS idx_elector_captures_coord ON elector_captures(coordinator_id)").run();
db.prepare("CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON audit_logs(user_id)").run();
db.prepare("CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_contact ON whatsapp_messages(contact_number)").run();


export default db;
