import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

// Consistently use backend folder for development, /app/data for production
let dbDir = process.env.NODE_ENV === 'production' ? '/app/data' : process.cwd();
if (process.env.NODE_ENV !== 'production') {
  const rootBackendPath = path.join(process.cwd(), 'backend');
  if (fs.existsSync(rootBackendPath) && fs.statSync(rootBackendPath).isDirectory()) {
    dbDir = rootBackendPath;
  }
}
const dbPath = process.env.NODE_ENV === 'test' ? ':memory:' : path.join(dbDir, 'intellecciones.db');



if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true });

console.log("Initializing database at:", dbPath);
const db = new Database(dbPath);

// ── PERFORMANCE PRAGMAS ───────────────────────────────────────────────────
try {
  db.pragma('journal_mode = WAL');
} catch (err: any) {
  console.warn("WARNING: SQLite WAL mode failed to initialize, falling back to DELETE mode:", err.message);
  try {
    db.pragma('journal_mode = DELETE');
  } catch (err2) {
    console.error("Critical: Fallback journal mode failed:", err2);
  }
}
db.pragma('synchronous = NORMAL');
db.pragma('cache_size = -65536');    // 64 MB cache (balanced for most environments)
db.pragma('temp_store = MEMORY');
db.pragma('mmap_size = 268435456');  // 256MB memory-mapped I/O (safe for all environments)
db.pragma('busy_timeout = 30000');   // wait up to 30s (CRITICAL: prevents SQLite_BUSY on cold starts/heavy load)
db.pragma('auto_vacuum = INCREMENTAL');
db.pragma('page_size = 4096');
db.pragma('query_only = false');
db.pragma('read_uncommitted = true'); // Better concurrency for read-heavy workloads

// 🏗️ SCHEMA & MIGRATIONS MANAGER
const currentSchemaVersion = 28; // Update this to trigger migrations
const getDbVersion = () => {
  try {
    const res = db.prepare("SELECT value FROM settings WHERE key = 'schema_version'").get() as any;
    return res ? parseInt(res.value) : 0;
  } catch { return 0; }
};

const setDbVersion = (v: number) => {
  db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('schema_version', ?)").run(v.toString());
};

const dbVersion = getDbVersion();

// Always-safe: add missing columns idempotently on every startup
const addColumnIfNotExists = (tableName: string, columnName: string, columnDef: string) => {
  try {
    const columns = db.prepare(`PRAGMA table_info(${tableName})`).all() as any[];
    if (!columns.some((c: any) => c.name === columnName)) {
      db.prepare(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${columnDef}`).run();
      console.log(`MIGRATION: Added column [${columnName}] to table [${tableName}]`);
    }
  } catch (e: any) { console.error(`MIGRATION ERROR adding ${columnName} to ${tableName}: ${e.message}`); }
};

// Columns added OUTSIDE the version-gated block run on every startup (safe, idempotent)
addColumnIfNotExists("elector_captures", "copiatin_printed_at", "DATETIME");
addColumnIfNotExists("whatsapp_terminals", "campaign_id", "INTEGER");
addColumnIfNotExists("whatsapp_terminals", "phone_number", "TEXT");
addColumnIfNotExists("whatsapp_terminals", "warmup_enabled", "INTEGER DEFAULT 0");
addColumnIfNotExists("attendance", "photo_url", "TEXT");
addColumnIfNotExists("users", "assigned_table_role", "TEXT");

// Create index optimizations on startup
try {
  db.exec("CREATE INDEX IF NOT EXISTS idx_participation_logs_voted ON participation_logs(local_votacion, mesa, orden);");
  db.exec("CREATE INDEX IF NOT EXISTS idx_participation_logs_local_mesa ON participation_logs(local_votacion, mesa);");
} catch (e: any) {
  console.error("MIGRATION ERROR creating indexes for participation_logs:", e.message);
}


// Only run heavy schema checks if version changed
if (dbVersion < currentSchemaVersion) {
    console.log(`MIGRATION: Database version [${dbVersion}] detected. Updating to [${currentSchemaVersion}]...`);
    
    // Drop incorrect duplicate index to force recreation on correct column
    db.exec("DROP INDEX IF EXISTS idx_electors_distrito;");

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
        phone_hash TEXT,
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
        ciudad TEXT DEFAULT '',
        distrito TEXT DEFAULT '',
        barrio TEXT DEFAULT '',
        campaign_id INTEGER,
        photo_ci_frente TEXT,
        photo_ci_verso TEXT
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
        phone_hash TEXT,
        original_capture_id INTEGER,
        photo_ci_frente TEXT,
        photo_ci_verso TEXT,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS capture_conflicts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        capture_id INTEGER,
        capture_id_b INTEGER,
        elector_ci TEXT,
        list_id INTEGER,
        list_id_a INTEGER,
        list_id_b INTEGER,
        status TEXT DEFAULT 'PENDING',
        resolved_by_jefe_id INTEGER,
        resolved_coordinator_id INTEGER,
        conflict_type TEXT DEFAULT 'INTERNAL',
        jefe_decision_id INTEGER,
        consent_a INTEGER DEFAULT 0,
        consent_b INTEGER DEFAULT 0,
        resolved_at DATETIME,
        winner_capture_id INTEGER,
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
        priority TEXT DEFAULT 'NORMAL',
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

      CREATE TABLE IF NOT EXISTS whatsapp_broadcast_recipients (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        log_id      INTEGER NOT NULL,
        telefono    TEXT NOT NULL,
        nombre      TEXT,
        status      TEXT DEFAULT 'PENDING',
        error_msg   TEXT,
        sent_at     DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(log_id) REFERENCES whatsapp_broadcast_logs(id) ON DELETE CASCADE
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
        driver_photo TEXT DEFAULT '',
        capacity INTEGER DEFAULT 4,
        status TEXT DEFAULT 'AVAILABLE',
        assigned_list_id INTEGER,
        assigned_user_id INTEGER,
        type TEXT,
        plate TEXT,
        lat REAL,
        lng REAL,
        last_update DATETIME
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

      CREATE TABLE IF NOT EXISTS attendance (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        ci TEXT UNIQUE NOT NULL,
        nombre TEXT NOT NULL,
        apellido TEXT,
        distrito TEXT NOT NULL,
        cargo TEXT NOT NULL,
        telefono TEXT NOT NULL,
        photo_url TEXT,
        registered_by INTEGER,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(registered_by) REFERENCES users(id)
      );

      CREATE INDEX IF NOT EXISTS idx_users_list ON users(assigned_list_id);
      CREATE INDEX IF NOT EXISTS idx_users_campaign ON users(assigned_campaign_id);
      CREATE INDEX IF NOT EXISTS idx_users_parent ON users(parent_id);
      CREATE INDEX IF NOT EXISTS idx_users_ci ON users(ci);
      CREATE INDEX IF NOT EXISTS idx_users_distrito ON users(distrito);
      CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);

      CREATE INDEX IF NOT EXISTS idx_electors_local ON electors(local_votacion);
      CREATE INDEX IF NOT EXISTS idx_electors_mesa ON electors(mesa);
      CREATE INDEX IF NOT EXISTS idx_electors_distrito ON electors(distrito);
      CREATE INDEX IF NOT EXISTS idx_electors_ciudad ON electors(ciudad);

      CREATE INDEX IF NOT EXISTS idx_captures_ci ON elector_captures(elector_ci);
      CREATE INDEX IF NOT EXISTS idx_captures_coord ON elector_captures(coordinator_id);
      CREATE INDEX IF NOT EXISTS idx_captures_list ON elector_captures(list_id);
      CREATE INDEX IF NOT EXISTS idx_captures_campaign ON elector_captures(campaign_id);

      CREATE INDEX IF NOT EXISTS idx_conflicts_ci ON capture_conflicts(elector_ci);
      CREATE INDEX IF NOT EXISTS idx_conflicts_ids ON capture_conflicts(capture_id, capture_id_b);
      CREATE INDEX IF NOT EXISTS idx_conflicts_lists ON capture_conflicts(list_id_a, list_id_b);

      CREATE INDEX IF NOT EXISTS idx_lists_campaign ON lists(campaign_id);
      CREATE INDEX IF NOT EXISTS idx_lists_ciudad ON lists(ciudad);
      
      CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_terminal ON whatsapp_messages(terminal_id, timestamp DESC);
      CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_contact ON whatsapp_messages(contact_number);
      CREATE INDEX IF NOT EXISTS idx_broadcast_recipients_log ON whatsapp_broadcast_recipients(log_id);
      CREATE INDEX IF NOT EXISTS idx_broadcast_recipients_status ON whatsapp_broadcast_recipients(log_id, status);

      CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON audit_logs(user_id);
      CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp ON audit_logs(timestamp DESC);

      CREATE INDEX IF NOT EXISTS idx_attendance_ci ON attendance(ci);
      CREATE INDEX IF NOT EXISTS idx_attendance_distrito ON attendance(distrito);
    `);

    // addColumnIfNotExists is defined above (module-level) so it's available here too

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
    addColumnIfNotExists("elector_captures", "transport_status", "TEXT DEFAULT 'PENDING'");
    addColumnIfNotExists("electors", "ciudad", "TEXT DEFAULT ''");
    addColumnIfNotExists("electors", "distrito", "TEXT DEFAULT ''");
    addColumnIfNotExists("electors", "barrio", "TEXT DEFAULT ''");
    addColumnIfNotExists("electors", "photo_ci_frente", "TEXT");
    addColumnIfNotExists("electors", "photo_ci_verso", "TEXT");
    addColumnIfNotExists("elector_captures", "photo_ci_frente", "TEXT");
    addColumnIfNotExists("elector_captures", "photo_ci_verso", "TEXT");
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
    addColumnIfNotExists("users", "telefono", "TEXT");
    addColumnIfNotExists("field_requests", "priority", "TEXT DEFAULT 'NORMAL'");
    addColumnIfNotExists("capture_conflicts", "capture_id_b", "INTEGER");
    addColumnIfNotExists("capture_conflicts", "conflict_type", "TEXT DEFAULT 'INTERNAL'");
    addColumnIfNotExists("capture_conflicts", "jefe_decision_id", "INTEGER");
    addColumnIfNotExists("capture_conflicts", "consent_a", "INTEGER DEFAULT 0");
    addColumnIfNotExists("capture_conflicts", "consent_b", "INTEGER DEFAULT 0");
    addColumnIfNotExists("capture_conflicts", "list_id_a", "INTEGER");
    addColumnIfNotExists("capture_conflicts", "list_id_b", "INTEGER");
    addColumnIfNotExists("capture_conflicts", "resolved_at", "DATETIME");
    addColumnIfNotExists("capture_conflicts", "winner_capture_id", "INTEGER");
    addColumnIfNotExists("whatsapp_templates", "lat", "REAL");
    addColumnIfNotExists("whatsapp_templates", "lng", "REAL");
    addColumnIfNotExists("whatsapp_templates", "contact_name", "TEXT");
    addColumnIfNotExists("whatsapp_templates", "contact_phone", "TEXT");
    addColumnIfNotExists("whatsapp_messages", "terminal_id", "TEXT DEFAULT 'default'");
    addColumnIfNotExists("whatsapp_messages", "contact_name", "TEXT");
    addColumnIfNotExists("attendance", "attended", "INTEGER DEFAULT 1");
    addColumnIfNotExists("whatsapp_messages", "type", "TEXT DEFAULT 'chat'");
    addColumnIfNotExists("whatsapp_messages", "media_url", "TEXT");
    addColumnIfNotExists("whatsapp_broadcast_logs", "terminal_id", "TEXT DEFAULT 'default'");
    addColumnIfNotExists("whatsapp_broadcast_logs", "custom_message", "TEXT");
    addColumnIfNotExists("whatsapp_broadcast_logs", "media_url", "TEXT");
    addColumnIfNotExists("whatsapp_broadcast_logs", "media_type", "TEXT");
    addColumnIfNotExists("whatsapp_broadcast_logs", "min_delay", "INTEGER DEFAULT 2");
    addColumnIfNotExists("whatsapp_broadcast_logs", "max_delay", "INTEGER DEFAULT 5");
    addColumnIfNotExists("electors", "campaign_id", "INTEGER");
    addColumnIfNotExists("whatsapp_terminals", "campaign_id", "INTEGER");
    addColumnIfNotExists("whatsapp_messages", "campaign_id", "INTEGER");
    addColumnIfNotExists("whatsapp_messages", "phone_number", "TEXT");
    addColumnIfNotExists("whatsapp_templates", "campaign_id", "INTEGER");
    addColumnIfNotExists("whatsapp_broadcast_logs", "campaign_id", "INTEGER");
    addColumnIfNotExists("voting_locations", "campaign_id", "INTEGER");
    addColumnIfNotExists("vehicles", "lat", "REAL");
    addColumnIfNotExists("vehicles", "lng", "REAL");
    addColumnIfNotExists("vehicles", "last_update", "DATETIME");
    addColumnIfNotExists("vehicles", "driver_photo", "TEXT DEFAULT ''");
    addColumnIfNotExists("vehicles", "assigned_user_id", "INTEGER");
    addColumnIfNotExists("vehicles", "type", "TEXT");
    addColumnIfNotExists("vehicles", "plate", "TEXT");
    addColumnIfNotExists("vehicles", "distrito", "TEXT DEFAULT ''");
    addColumnIfNotExists("vehicles", "ciudad", "TEXT DEFAULT ''");
    addColumnIfNotExists("users", "phone_hash", "TEXT");
    addColumnIfNotExists("elector_captures", "phone_hash", "TEXT");
    // copiatin_printed_at is added at startup (outside this block) — see module-level addColumnIfNotExists calls
 
    // Indexes for better JOIN performance
    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_electors_local_mesa ON electors (local_votacion, mesa);
      CREATE INDEX IF NOT EXISTS idx_electors_nombre ON electors (nombre, apellido);
      CREATE INDEX IF NOT EXISTS idx_users_username ON users (username);
      CREATE INDEX IF NOT EXISTS idx_elector_captures_timestamp ON elector_captures(timestamp DESC);
      -- Covering index for reports CTE aggregation (avoids full table scan)
      CREATE INDEX IF NOT EXISTS idx_captures_coord_agg ON elector_captures(coordinator_id, traffic_light, needs_transport);
      -- Composite index for coord_map CTE (role + parent lookup)
      CREATE INDEX IF NOT EXISTS idx_users_role_parent ON users(role, parent_id);
      
      -- Missing composite indexes for heavy query optimization (Fase 0.4)
      CREATE INDEX IF NOT EXISTS idx_captures_campaign_list_disputed ON elector_captures(campaign_id, list_id, is_disputed);
      CREATE INDEX IF NOT EXISTS idx_captures_coord_timestamp ON elector_captures(coordinator_id, timestamp DESC);
      CREATE INDEX IF NOT EXISTS idx_conflicts_status_ci ON capture_conflicts(status, elector_ci);
      CREATE INDEX IF NOT EXISTS idx_audit_logs_user_timestamp ON audit_logs(user_id, timestamp DESC);
      CREATE INDEX IF NOT EXISTS idx_users_role_distrito_parent ON users(role, distrito, parent_id);
      CREATE INDEX IF NOT EXISTS idx_electors_ciudad_distrito ON electors(ciudad, distrito);
      CREATE INDEX IF NOT EXISTS idx_users_phone_hash ON users(phone_hash);
      CREATE INDEX IF NOT EXISTS idx_captures_phone_hash ON elector_captures(phone_hash);
    `);

    db.prepare('CREATE INDEX IF NOT EXISTS idx_conflicts_capture ON capture_conflicts(capture_id)').run();
    db.prepare('CREATE INDEX IF NOT EXISTS idx_conflicts_capture_b ON capture_conflicts(capture_id_b)').run();

    // BACKFILL: Restore conflicts from existing duplicates if they are missing from the table
    try {
      db.prepare(`
        INSERT INTO capture_conflicts (capture_id, capture_id_b, elector_ci, list_id_a, list_id_b, conflict_type, status)
        SELECT 
          MIN(id) as capture_id, 
          MAX(id) as capture_id_b, 
          elector_ci, 
          MIN(list_id) as list_id_a, 
          MAX(list_id) as list_id_b,
          CASE WHEN MIN(list_id) = MAX(list_id) THEN 'INTERNAL' ELSE 'INTER_LIST' END as conflict_type,
          'PENDING'
        FROM elector_captures
        WHERE elector_ci IN (SELECT elector_ci FROM elector_captures GROUP BY elector_ci HAVING COUNT(*) > 1)
        AND elector_ci NOT IN (SELECT elector_ci FROM capture_conflicts)
        GROUP BY elector_ci
      `).run();
      console.log("MIGRATION: Backfilled capture_conflicts from existing duplicates.");
    } catch (e: any) {
      console.log("MIGRATION: Backfill skipped or failed (likely already clean).");
    }

    // REPAIR EXISTING CONFLICTS: Backfill capture_id_b, list_id_a, list_id_b, and delete invalid conflicts
    try {
      // 1. Backfill capture_id_b for existing conflicts where it is NULL
      db.prepare(`
        UPDATE capture_conflicts 
        SET capture_id_b = (
          SELECT id 
          FROM elector_captures 
          WHERE elector_captures.elector_ci = capture_conflicts.elector_ci 
            AND elector_captures.id != capture_conflicts.capture_id 
          ORDER BY id DESC
          LIMIT 1
        )
        WHERE capture_id_b IS NULL;
      `).run();

      // 2. Backfill list_id_b for conflicts where it is NULL but capture_id_b is populated
      db.prepare(`
        UPDATE capture_conflicts 
        SET list_id_b = (
          SELECT list_id 
          FROM elector_captures 
          WHERE elector_captures.id = capture_conflicts.capture_id_b
        )
        WHERE list_id_b IS NULL AND capture_id_b IS NOT NULL;
      `).run();

      // 3. Backfill list_id_a for conflicts where it is NULL (using old list_id column or linked Capture A)
      db.prepare(`
        UPDATE capture_conflicts 
        SET list_id_a = COALESCE(list_id_a, list_id, (
          SELECT list_id 
          FROM elector_captures 
          WHERE elector_captures.id = capture_conflicts.capture_id
        ))
        WHERE list_id_a IS NULL;
      `).run();

      // 4. Update conflict_type if list_id_a and list_id_b are populated
      db.prepare(`
        UPDATE capture_conflicts 
        SET conflict_type = CASE WHEN list_id_a = list_id_b THEN 'INTERNAL' ELSE 'INTER_LIST' END
        WHERE list_id_a IS NOT NULL AND list_id_b IS NOT NULL AND (conflict_type IS NULL OR conflict_type = '');
      `).run();

      // 5. Clean up any invalid/dangling conflicts (where capture_id_b is still NULL or matches capture_id)
      // Select the captures that are in invalid conflicts so we can reset their is_disputed status
      const invalidCaptureIds = db.prepare(`
        SELECT id FROM elector_captures 
        WHERE id IN (
          SELECT capture_id FROM capture_conflicts WHERE capture_id_b IS NULL OR capture_id IS NULL OR capture_id = capture_id_b
          UNION
          SELECT capture_id_b FROM capture_conflicts WHERE capture_id_b IS NULL OR capture_id IS NULL OR capture_id = capture_id_b
        )
      `).all() as any[];

      if (invalidCaptureIds.length > 0) {
        const ids = invalidCaptureIds.map(c => c.id);
        const placeholders = ids.map(() => '?').join(',');
        db.prepare(`UPDATE elector_captures SET is_disputed = 0 WHERE id IN (${placeholders})`).run(...ids);
      }

      // Delete the invalid conflict rows
      db.prepare(`
        DELETE FROM capture_conflicts 
        WHERE capture_id_b IS NULL OR capture_id IS NULL OR capture_id = capture_id_b;
      `).run();
    } catch (e: any) {
      console.error("MIGRATION ERROR in repair block:", e.message);
    }

     // CREATE vote_validations table (Fase 0.5 QR validation)
    try {
      db.exec(`
        CREATE TABLE IF NOT EXISTS vote_validations (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          elector_ci TEXT NOT NULL,
          validator_id INTEGER NOT NULL,
          timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY(validator_id) REFERENCES users(id)
        );
        CREATE INDEX IF NOT EXISTS idx_vote_validations_ci ON vote_validations(elector_ci);
      `);
      console.log("MIGRATION: Created table vote_validations and index idx_vote_validations_ci.");
    } catch (e: any) {
      console.error("MIGRATION ERROR creating table vote_validations:", e.message);
    }

    // CREATE mesa_constitutions table (Fase 0.5 Mesa Constitution & Substitution)
    try {
      db.exec(`
        CREATE TABLE IF NOT EXISTS mesa_constitutions (
          local_votacion TEXT NOT NULL,
          mesa INTEGER NOT NULL,
          is_confirmed INTEGER DEFAULT 0,
          foto_acta_url TEXT,
          confirmed_at DATETIME,
          constituted_at DATETIME,
          PRIMARY KEY (local_votacion, mesa)
        );
      `);
      console.log("MIGRATION: Created table mesa_constitutions.");
    } catch (e: any) {
      console.error("MIGRATION ERROR creating table mesa_constitutions:", e.message);
    }

    setDbVersion(currentSchemaVersion);
    console.log("MIGRATION: Update completed.");
}

// 🔄 COMPREHENSIVE DATA NORMALIZATION: Fix dots, spaces and casing globally
try {
  const needsNormalization = db.prepare("SELECT 1 FROM settings WHERE key = 'normalization_v4_full_done'").get();
  if (!needsNormalization) {
    console.log("PERFORMANCE: Running global database normalization (v4)...");
    db.transaction(() => {
      // 1. Clean Electors
      db.exec(`
        UPDATE OR IGNORE electors SET 
          ci = REPLACE(REPLACE(TRIM(ci), '.', ''), ' ', ''),
          ciudad = UPPER(TRIM(ciudad)), 
          distrito = UPPER(TRIM(distrito)) 
        WHERE ci IS NOT NULL AND (
          ci LIKE '%.%' OR 
          ci LIKE '% %' OR 
          ciudad != UPPER(TRIM(ciudad)) OR 
          distrito != UPPER(TRIM(distrito))
        );
      `);
      
      // 2. Clean Captures (Critical for JOINs)
      db.exec(`
        UPDATE OR IGNORE elector_captures SET 
          elector_ci = REPLACE(REPLACE(TRIM(elector_ci), '.', ''), ' ', '')
        WHERE elector_ci IS NOT NULL AND (
          elector_ci LIKE '%.%' OR 
          elector_ci LIKE '% %'
        );
      `);

      // 3. Clean Conflicts
      db.exec(`
        UPDATE OR IGNORE capture_conflicts SET 
          elector_ci = REPLACE(REPLACE(TRIM(elector_ci), '.', ''), ' ', '')
        WHERE elector_ci IS NOT NULL AND (
          elector_ci LIKE '%.%' OR 
          elector_ci LIKE '% %'
        );
      `);

      // 4. Clean Users (CI and Username are often the same)
      db.exec(`
        UPDATE OR IGNORE users SET 
          ci = REPLACE(REPLACE(TRIM(ci), '.', ''), ' ', ''),
          username = REPLACE(REPLACE(TRIM(username), '.', ''), ' ', ''),
          distrito = UPPER(TRIM(distrito)) 
        WHERE ci IS NOT NULL AND (
          ci LIKE '%.%' OR 
          ci LIKE '% %' OR 
          username LIKE '%.%' OR 
          username LIKE '% %' OR
          distrito != UPPER(TRIM(distrito))
        );
      `);

      // 5. RE-BACKFILL: Now that CIs are clean, we might find new duplicates that were fragmented
      db.prepare(`
        INSERT INTO capture_conflicts (capture_id, capture_id_b, elector_ci, list_id_a, list_id_b, conflict_type, status)
        SELECT 
          MIN(id) as capture_id, 
          MAX(id) as capture_id_b, 
          elector_ci, 
          MIN(list_id) as list_id_a, 
          MAX(list_id) as list_id_b,
          CASE WHEN MIN(list_id) = MAX(list_id) THEN 'INTERNAL' ELSE 'INTER_LIST' END as conflict_type,
          'PENDING'
        FROM elector_captures
        WHERE elector_ci IN (SELECT elector_ci FROM elector_captures GROUP BY elector_ci HAVING COUNT(*) > 1)
        AND elector_ci NOT IN (SELECT elector_ci FROM capture_conflicts)
        GROUP BY elector_ci
      `).run();

      db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('normalization_v4_full_done', 'true')").run();
    })();
    console.log("PERFORMANCE: Global normalization and backfill complete.");
  }
} catch (e: any) {
    console.error("MIGRATION ERROR (Normalization):", e.message);
}

// Exported so server.ts can run this AFTER app.listen (non-blocking startup)
export const runBootstrapChecks = () => {
  try {
    db.transaction(() => {
      // ── STEP 0: Remove zombie re-created conflicts ─────────────────────────
      // When the bootstrap previously ran with a buggy exclusion filter, it re-created
      // PENDING conflicts for electors whose dispute was already RESOLVED.
      // A zombie is a PENDING conflict whose capture pair already appears in a RESOLVED row.
      const zombiesDeleted = db.prepare(`
        DELETE FROM capture_conflicts
        WHERE status IN ('PENDING', 'WAITING_CONSENT')
        AND id IN (
          SELECT cc_p.id
          FROM capture_conflicts cc_p
          JOIN capture_conflicts cc_r
            ON cc_p.elector_ci = cc_r.elector_ci
            AND cc_r.status = 'RESOLVED'
          WHERE cc_p.status IN ('PENDING', 'WAITING_CONSENT')
            AND (cc_p.capture_id = cc_r.capture_id OR cc_p.capture_id = cc_r.capture_id_b)
            AND (cc_p.capture_id_b = cc_r.capture_id OR cc_p.capture_id_b = cc_r.capture_id_b)
        )
      `).run();
      if (zombiesDeleted.changes > 0) {
        console.log(`[BOOTSTRAP] Removed ${zombiesDeleted.changes} zombie re-created conflicts.`);
      }

      // ── STEP 0b: Restore is_disputed=0 for winners of RESOLVED conflicts ──
      // The zombie re-creation set is_disputed=1 on the winner; fix that.
      db.prepare(`
        UPDATE elector_captures SET is_disputed = 0
        WHERE id IN (
          SELECT winner_capture_id FROM capture_conflicts
          WHERE status = 'RESOLVED' AND winner_capture_id IS NOT NULL
        )
        AND id NOT IN (
          SELECT capture_id   FROM capture_conflicts WHERE status IN ('PENDING','WAITING_CONSENT')
          UNION
          SELECT capture_id_b FROM capture_conflicts WHERE status IN ('PENDING','WAITING_CONSENT')
        )
      `).run();

      // ── STEP 1: Detect genuinely new untracked duplicates ─────────────────
      db.prepare(`
        INSERT INTO capture_conflicts (capture_id, capture_id_b, elector_ci, list_id_a, list_id_b, conflict_type, status)
        SELECT
          dups.capture_id,
          dups.capture_id_b,
          dups.elector_ci,
          ea.list_id as list_id_a,
          eb.list_id as list_id_b,
          CASE WHEN ea.list_id = eb.list_id THEN 'INTERNAL' ELSE 'INTER_LIST' END as conflict_type,
          'PENDING'
        FROM (
          SELECT MIN(id) as capture_id, MAX(id) as capture_id_b, elector_ci
          FROM elector_captures
          WHERE elector_ci IS NOT NULL AND elector_ci != ''
            AND elector_ci IN (
              SELECT elector_ci FROM elector_captures
              GROUP BY elector_ci HAVING COUNT(*) > 1
            )
            AND elector_ci NOT IN (
              SELECT elector_ci FROM capture_conflicts
            )
          GROUP BY elector_ci
        ) dups
        INNER JOIN elector_captures ea ON ea.id = dups.capture_id
        INNER JOIN elector_captures eb ON eb.id = dups.capture_id_b
      `).run();

      db.prepare(`
        UPDATE elector_captures
        SET is_disputed = 1
        WHERE id IN (
          SELECT capture_id FROM capture_conflicts WHERE status = 'PENDING' OR status = 'WAITING_CONSENT'
          UNION
          SELECT capture_id_b FROM capture_conflicts WHERE status = 'PENDING' OR status = 'WAITING_CONSENT'
        )
      `).run();

      // --- SEED DATA CLEANUP: Remove test/seed records that shouldn't be in production ---
      const seedLocales = ['COLEGIO ASUNCION ESCALADA', 'CENTRO REGIONAL DE EDUCACION', 'ESCUELA BASICA 1300'];
      for (const locale of seedLocales) {
        const countRes = db.prepare(`SELECT COUNT(*) as c FROM electors WHERE local_votacion = ?`).get(locale) as any;
        if (countRes.c > 0 && countRes.c <= 10) {
          // Only delete if very few records (clearly seed data, not real production data)
          db.prepare(`DELETE FROM elector_captures WHERE elector_ci IN (SELECT ci FROM electors WHERE local_votacion = ?)`).run(locale);
          db.prepare(`DELETE FROM electors WHERE local_votacion = ?`).run(locale);
          console.log(`[BOOTSTRAP CLEANUP] Removed ${countRes.c} seed electors from locale "${locale}"`);
        }
      }

      // Self-healing: Assign lists to coordinators/padrinos who don't have one in production
      const usersWithoutList = db.prepare(`
        SELECT id, assigned_campaign_id 
        FROM users 
        WHERE assigned_list_id IS NULL AND role IN ('COORDINADOR', 'PADRINO', 'SUBJEFE')
      `).all() as any[];

      for (const u of usersWithoutList) {
        if (u.assigned_campaign_id) {
          const list = db.prepare('SELECT id FROM lists WHERE campaign_id = ? LIMIT 1').get(u.assigned_campaign_id) as any;
          if (list) {
            db.prepare('UPDATE users SET assigned_list_id = ? WHERE id = ?').run(list.id, u.id);
            console.log(`[BOOTSTRAP SELF-HEALING] Assigned list ID ${list.id} to user ID ${u.id}`);
          }
        }
      }
    })();
    // ── DISPUTE HOTFIX: reset stale is_disputed flags for specific CIs ──
    // These electors have no active disputes in PJC but were left with is_disputed=1
    (() => {
      const staleCIs = ['2849982', '8509539'];
      for (const ci of staleCIs) {
        const activeConflict = db.prepare(
          `SELECT id FROM capture_conflicts WHERE elector_ci = ? AND status IN ('PENDING','WAITING_CONSENT') LIMIT 1`
        ).get(ci) as any;
        if (!activeConflict) {
          const updated = db.prepare(
            `UPDATE elector_captures SET is_disputed = 0 WHERE elector_ci = ? AND is_disputed = 1`
          ).run(ci);
          if (updated.changes > 0) {
            console.log(`[DISPUTE HOTFIX] Cleared stale is_disputed for CI ${ci} (${updated.changes} capture(s))`);
          }
        }
      }
    })();
    // ── CONCEPCION DATABASE CLEANUP ──
    (() => {
      try {
        // Ensure local exists
        db.prepare(`
          INSERT OR IGNORE INTO voting_locations (cod_local, nombre, lat, lng, direccion, icon, distrito, ciudad)
          VALUES ('LOC_CONCEPCION', 'INSTITUTO SALESIANO SAN JOSE', -23.408, -57.438, 'Concepción', 'Landmark', 'CONCEPCION', 'CONCEPCION')
        `).run();

        const delElectors = db.prepare("DELETE FROM electors WHERE distrito = 'CONCEPCION' AND local_votacion != 'INSTITUTO SALESIANO SAN JOSE'").run();
        if (delElectors.changes > 0) {
          console.log(`[BOOTSTRAP CLEANUP] Deleted ${delElectors.changes} incorrect electors from CONCEPCION`);
        }

        const delLocs = db.prepare("DELETE FROM voting_locations WHERE distrito = 'CONCEPCION' AND nombre != 'INSTITUTO SALESIANO SAN JOSE'").run();
        if (delLocs.changes > 0) {
          console.log(`[BOOTSTRAP CLEANUP] Deleted ${delLocs.changes} incorrect voting locations from CONCEPCION`);
        }

        const delDupLoc = db.prepare("DELETE FROM voting_locations WHERE distrito = 'CONCEPCION' AND nombre = 'INSTITUTO SALESIANO SAN JOSE' AND cod_local != 'LOC_CONCEPCION'").run();
        if (delDupLoc.changes > 0) {
          console.log(`[BOOTSTRAP CLEANUP] Deleted duplicate voting location for INSTITUTO SALESIANO SAN JOSE`);
        }

        const updateElectors = db.prepare("UPDATE electors SET cod_local = 'LOC_CONCEPCION' WHERE distrito = 'CONCEPCION' AND local_votacion = 'INSTITUTO SALESIANO SAN JOSE' AND (cod_local IS NULL OR cod_local != 'LOC_CONCEPCION')").run();
        if (updateElectors.changes > 0) {
          console.log(`[BOOTSTRAP CLEANUP] Mapped ${updateElectors.changes} electors to LOC_CONCEPCION`);
        }
      } catch (err: any) {
        console.error("[BOOTSTRAP CLEANUP ERROR] Failed to clean Concepcion data:", err.message);
      }
    })();
    // ── CONCEPCION STAFF IMPORT SELF-HEALING ──
    (() => {
      try {
        const concepcionUsersCount = db.prepare("SELECT COUNT(*) as c FROM users WHERE distrito = 'CONCEPCION' AND role IN ('VEEDOR', 'MIEMBRO_MESA', 'APODERADO')").get() as any;
        console.log(`[BOOTSTRAP IMPORT] Concepcion staff count: ${concepcionUsersCount?.c || 0}`);
        
        if ((concepcionUsersCount?.c || 0) > 50) {
          console.log('[BOOTSTRAP IMPORT] Concepcion staff already imported. Skipping to preserve manual changes.');
          return;
        }
        // Force clean if partially imported
        db.prepare("DELETE FROM users WHERE distrito = 'CONCEPCION' AND role IN ('VEEDOR', 'MIEMBRO_MESA', 'APODERADO')").run();
        
        const XLSX = require('xlsx');
        const { normalizePhone } = require('./utils/phone');
        
        // List directory contents for debugging
        try {
          const cwdFiles = fs.readdirSync(process.cwd());
          console.log(`[BOOTSTRAP IMPORT] Files in cwd (${process.cwd()}): ${cwdFiles.filter(f => f.includes('CONCEPCION') || f.endsWith('.xlsx')).join(', ') || 'NO XLSX FILES'}`);
          console.log(`[BOOTSTRAP IMPORT] All files in cwd: ${cwdFiles.join(', ')}`);
        } catch (e: any) { console.log(`[BOOTSTRAP IMPORT] Cannot read cwd: ${e.message}`); }
        try {
          const dirFiles = fs.readdirSync(__dirname);
          console.log(`[BOOTSTRAP IMPORT] Files in __dirname (${__dirname}): ${dirFiles.filter(f => f.includes('CONCEPCION') || f.endsWith('.xlsx')).join(', ') || 'NO XLSX FILES'}`);
        } catch (e: any) { console.log(`[BOOTSTRAP IMPORT] Cannot read __dirname: ${e.message}`); }
        
        const candidates = [
          path.resolve(dbDir, 'CONCEPCION APODERADOS Y MIEMBROS DE MESAS - APP.xlsx'),
          path.resolve(process.cwd(), 'CONCEPCION APODERADOS Y MIEMBROS DE MESAS - APP.xlsx'),
          path.resolve(process.cwd(), 'backend', 'CONCEPCION APODERADOS Y MIEMBROS DE MESAS - APP.xlsx'),
          path.resolve(__dirname, 'CONCEPCION APODERADOS Y MIEMBROS DE MESAS - APP.xlsx'),
          path.resolve(__dirname, '..', 'CONCEPCION APODERADOS Y MIEMBROS DE MESAS - APP.xlsx'),
          path.resolve(__dirname, '../..', 'CONCEPCION APODERADOS Y MIEMBROS DE MESAS - APP.xlsx'),
        ];
        
        console.log(`[BOOTSTRAP IMPORT] dbDir=${dbDir}, cwd=${process.cwd()}, __dirname=${__dirname}`);
        
        let excelPath = '';
        for (const p of candidates) {
          const exists = fs.existsSync(p);
          console.log(`[BOOTSTRAP IMPORT] Checking: ${p} => ${exists ? 'FOUND' : 'not found'}`);
          if (exists && !excelPath) excelPath = p;
        }
        
        if (excelPath) {
          console.log(`[BOOTSTRAP IMPORT] Using Excel: ${excelPath}`);
          const workbook = XLSX.readFile(excelPath);
          const sheet = workbook.Sheets[workbook.SheetNames[0]];
          const rows = XLSX.utils.sheet_to_json(sheet) as any[];
          
          const usersToImport: any[] = [];
          let currentCargo = '';
          
          for (const row of rows) {
            const cargoCol = row['APODERADOS Y MIEMBROS DE MESAS CONCEPCION- LOCAL SALESIANO SAN JOSE'];
            const nameCol = row['__EMPTY'];
            const ciCol = row['__EMPTY_1'];
            const phoneCol = row['__EMPTY_2'];
            
            if (!nameCol || nameCol === 'NOMBRES Y APELLIDOS') continue;
            if (cargoCol) currentCargo = String(cargoCol).trim();
            
            const cleanCI = String(ciCol).replace(/\D/g, '');
            if (!cleanCI) continue;
            
            const phoneStr = phoneCol ? String(phoneCol) : '';
            const normalizedPhoneVal = normalizePhone(phoneStr);
            
            let role = 'MIEMBRO_MESA';
            let mesaNum: number | null = null;
            
            if (currentCargo.includes('APODERADO')) {
              role = 'APODERADO';
            } else if (!isNaN(Number(currentCargo))) {
              role = 'MIEMBRO_MESA';
              mesaNum = Number(currentCargo);
            } else if (currentCargo === 'MESA') {
              role = 'MIEMBRO_MESA';
            }
            
            let dbName = String(nameCol).trim();
            const elector = db.prepare('SELECT nombre, apellido FROM electors WHERE ci = ?').get(cleanCI) as any;
            if (elector) {
              dbName = `${elector.nombre} ${elector.apellido || ''}`.trim().toUpperCase();
            }
            
            usersToImport.push({
              username: cleanCI,
              password: cleanCI,
              role,
              nombre: dbName,
              telefono: normalizedPhoneVal || null,
              ci: cleanCI,
              assigned_local: 'INSTITUTO SALESIANO SAN JOSE',
              assigned_mesa: mesaNum,
              distrito: 'CONCEPCION'
            });
          }
          
          const insertStmt = db.prepare(`
            INSERT INTO users (
              username, password, role, nombre, telefono, ci, 
              assigned_local, assigned_mesa, distrito, status, needs_password_change
            ) VALUES (
              @username, @password, @role, @nombre, @telefono, @ci,
              @assigned_local, @assigned_mesa, @distrito, 'ACTIVE', 0
            )
            ON CONFLICT(username) DO UPDATE SET
              role = excluded.role,
              nombre = excluded.nombre,
              telefono = excluded.telefono,
              ci = excluded.ci,
              assigned_local = excluded.assigned_local,
              assigned_mesa = excluded.assigned_mesa,
              distrito = excluded.distrito,
              status = 'ACTIVE'
          `);
          
          const insertTransaction = db.transaction((users) => {
            let count = 0;
            for (const u of users) {
              insertStmt.run(u);
              count++;
            }
            return count;
          });
          
          const count = insertTransaction(usersToImport);
          console.log(`[BOOTSTRAP IMPORT] Successfully imported/updated ${count} users for CONCEPCION.`);
        } else {
          console.log(`[BOOTSTRAP IMPORT] Concepcion Excel file NOT FOUND in any candidate path.`);
        }
      } catch (err: any) {
        console.log(`[BOOTSTRAP IMPORT ERROR] Failed to import Concepcion users: ${err.message}`);
        console.log(`[BOOTSTRAP IMPORT ERROR] Stack: ${err.stack}`);
      }
    })();
    console.log("DATABASE: Bootstrap checks complete.");

  } catch (e: any) {
    console.error("DATABASE ERROR (Bootstrap):", e.message);
  }
};

export default db;

