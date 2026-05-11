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

// ⚡ PERFORMANCE PRAGMAS — must run before any query
db.pragma('journal_mode = WAL');       // concurrent reads + writes
db.pragma('synchronous = NORMAL');     // safe with WAL, 3x faster than FULL
db.pragma('cache_size = -65536');      // 64 MB page cache (default is 2 MB)
db.pragma('temp_store = MEMORY');      // temp tables & indexes in RAM
db.pragma('mmap_size = 134217728');    // 128 MB memory-mapped I/O
db.pragma('busy_timeout = 5000');      // wait up to 5s before SQLITE_BUSY

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
    distrito TEXT DEFAULT '',
    ciudad TEXT DEFAULT ''
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
    db.prepare(sql).run(); 
  } catch (e: any) {
    // Only log if it's NOT a duplicate column error
    if (!e.message.includes('duplicate column name')) {
      console.error(`MIGRATION ERROR: ${sql.slice(0, 50)}... -> ${e.message}`);
    }
  } 
};

const addColumnIfNotExists = (tableName: string, columnName: string, columnDef: string) => {
  try {
    const columns = db.prepare(`PRAGMA table_info(${tableName})`).all() as any[];
    if (!columns.some(c => c.name === columnName)) {
      db.prepare(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${columnDef}`).run();
      console.log(`MIGRATION: Added column [${columnName}] to table [${tableName}]`);
    }
  } catch (e: any) {
    if (!e.message.includes('duplicate column name')) {
      console.error(`MIGRATION ERROR adding ${columnName} to ${tableName}: ${e.message}`);
    }
  }
};
addColumnIfNotExists("campaigns", "goal", "INTEGER DEFAULT 1000");
addColumnIfNotExists("campaigns", "distrito", "TEXT");
addColumnIfNotExists("lists", "ciudad", "TEXT DEFAULT ''");
addColumnIfNotExists("users", "distrito", "TEXT");
addColumnIfNotExists("users", "ci", "TEXT");
addColumnIfNotExists("users", "status", "TEXT DEFAULT 'ACTIVE'");
addColumnIfNotExists("elector_captures", "is_disputed", "INTEGER DEFAULT 0");
addColumnIfNotExists("elector_captures", "campaign_id", "INTEGER");
addColumnIfNotExists("elector_captures", "list_id", "INTEGER");
addColumnIfNotExists("elector_captures", "assigned_vehicle_id", "INTEGER");
addColumnIfNotExists("electors", "ciudad", "TEXT DEFAULT ''");
addColumnIfNotExists("electors", "barrio", "TEXT DEFAULT ''");
addColumnIfNotExists("participation_logs", "veedor_id", "INTEGER");
addColumnIfNotExists("results", "veedor_id", "INTEGER");
addColumnIfNotExists("voting_locations", "lat", "REAL");
addColumnIfNotExists("voting_locations", "lng", "REAL");
addColumnIfNotExists("voting_locations", "direccion", "TEXT");
addColumnIfNotExists("voting_locations", "icon", "TEXT DEFAULT 'Landmark'");
addColumnIfNotExists("voting_locations", "distrito", "TEXT DEFAULT ''");
addColumnIfNotExists("voting_locations", "ciudad", "TEXT DEFAULT ''");
addColumnIfNotExists("campaigns", "enabled_modules", "TEXT DEFAULT 'COMMAND_CENTER,REGISTRY'");
addColumnIfNotExists("users", "enabled_modules", "TEXT");
addColumnIfNotExists("users", "parent_id", "INTEGER");
addColumnIfNotExists("users", "telefono", "TEXT");

// 🛠️ HEAVY ONE-TIME MIGRATIONS
try {
  const needsNormalization = db.prepare("SELECT 1 FROM settings WHERE key = 'normalization_v2_done'").get();
  
  if (!needsNormalization) {
    console.log('MIGRATION: Ejecutando normalización pesada de datos (Solo una vez)...');
    
    db.transaction(() => {
      // Normalización de usuarios
      db.prepare(`
        UPDATE users 
        SET assigned_list_id = (SELECT id FROM lists WHERE list_number = '3' AND (option_number = '3' OR candidate_alias LIKE '%Lourdes%') LIMIT 1),
            assigned_campaign_id = 3
        WHERE (assigned_list_id = 1 OR assigned_list_id IS NULL)
          AND role != 'SUPERUSUARIO' 
          AND username NOT IN ('4500001', 'admin', '3657834')
      `).run();
      
      db.prepare("UPDATE users SET assigned_list_id = NULL WHERE username = '4500001' OR ci = '4500001'").run();
      
      // Normalización de tablas geográficas (ELECTORS ES LA MÁS PESADA)
      console.log('MIGRATION: Normalizando tabla Electores (esto puede tardar)...');
      db.exec(`
        UPDATE electors SET ci = TRIM(ci), ciudad = UPPER(TRIM(ciudad)) WHERE ci IS NOT NULL;
        UPDATE voting_locations SET cod_local = TRIM(cod_local), distrito = UPPER(TRIM(distrito)), ciudad = UPPER(TRIM(distrito)) WHERE cod_local IS NOT NULL;
        UPDATE lists SET ciudad = UPPER(TRIM(ciudad)) WHERE ciudad IS NOT NULL AND ciudad != '';
        UPDATE campaigns SET distrito = UPPER(TRIM(distrito)) WHERE distrito IS NOT NULL AND distrito != '';
        UPDATE users SET distrito = UPPER(TRIM(distrito)) WHERE distrito IS NOT NULL AND distrito != '';
        UPDATE users SET distrito = 'PEDRO JUAN CABALLERO' WHERE (distrito IS NULL OR TRIM(distrito) = '') AND role != 'SUPERUSUARIO';
      `);
      
      db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('normalization_v2_done', 'true')").run();
    })();
    
    console.log('MIGRATION: Normalización pesada completada con éxito.');
  }
} catch (e: any) {
  console.error('MIGRATION ERROR during heavy normalization:', e.message);
}

addColumnIfNotExists("whatsapp_templates", "lat", "REAL");
addColumnIfNotExists("whatsapp_templates", "lng", "REAL");
addColumnIfNotExists("whatsapp_templates", "contact_name", "TEXT");
addColumnIfNotExists("whatsapp_templates", "contact_phone", "TEXT");

// 🧹 MAINTENANCE (Disabled on startup to avoid locking)
try {
  // Only checkpointing WAL to keep the file size manageable without full VACUUM
  db.pragma('wal_checkpoint(PASSIVE)');
} catch (e) {}

/* OPTIMIZATION INDEXES */
db.prepare("CREATE INDEX IF NOT EXISTS idx_electors_local_mesa ON electors (local_votacion, mesa)").run();
db.prepare("CREATE INDEX IF NOT EXISTS idx_electors_ciudad ON electors (ciudad)").run();
db.prepare("CREATE INDEX IF NOT EXISTS idx_electors_nombre ON electors (nombre, apellido)").run();
db.prepare("CREATE INDEX IF NOT EXISTS idx_users_parent ON users (parent_id)").run();
db.prepare("CREATE INDEX IF NOT EXISTS idx_users_ci ON users (ci)").run();
db.prepare("CREATE INDEX IF NOT EXISTS idx_users_username ON users (username)").run();  // critical for login
db.prepare("CREATE INDEX IF NOT EXISTS idx_users_role ON users (role, assigned_list_id)").run();
db.prepare("CREATE INDEX IF NOT EXISTS idx_users_distrito ON users (distrito)").run();
db.prepare("CREATE INDEX IF NOT EXISTS idx_users_list ON users (assigned_list_id)").run();
db.prepare("CREATE INDEX IF NOT EXISTS idx_elector_captures_ci ON elector_captures(elector_ci)").run();
db.prepare("CREATE INDEX IF NOT EXISTS idx_elector_captures_campaign ON elector_captures(campaign_id)").run();
db.prepare("CREATE INDEX IF NOT EXISTS idx_elector_captures_list ON elector_captures(list_id)").run();
db.prepare("CREATE INDEX IF NOT EXISTS idx_elector_captures_coord ON elector_captures(coordinator_id)").run();
db.prepare("CREATE INDEX IF NOT EXISTS idx_elector_captures_traffic ON elector_captures(traffic_light)").run();
db.prepare("CREATE INDEX IF NOT EXISTS idx_elector_captures_transport ON elector_captures(needs_transport)").run();
db.prepare("CREATE INDEX IF NOT EXISTS idx_elector_captures_timestamp ON elector_captures(timestamp DESC)").run();
db.prepare("CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON audit_logs(user_id)").run();
db.prepare("CREATE INDEX IF NOT EXISTS idx_field_requests_status ON field_requests(status, timestamp DESC)").run();
db.prepare("CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_contact ON whatsapp_messages(contact_number)").run();
db.prepare("CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_terminal ON whatsapp_messages(terminal_id, timestamp DESC)").run();


export default db;
