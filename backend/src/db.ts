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

// ── PERFORMANCE PRAGMAS ───────────────────────────────────────────────────
db.pragma('journal_mode = WAL');
db.pragma('synchronous = NORMAL');
db.pragma('cache_size = -131072');     // 128 MB cache
db.pragma('temp_store = MEMORY');
db.pragma('mmap_size = 3000000000');   // 3GB memory-mapped I/O (Railway standard containers can handle this)
db.pragma('busy_timeout = 30000');     // wait up to 30s (CRITICAL: prevents SQLite_BUSY on cold starts/heavy load)
db.pragma('auto_vacuum = INCREMENTAL');
db.pragma('page_size = 4096');

// 🏗️ SCHEMA & MIGRATIONS MANAGER
const currentSchemaVersion = 13; // Update this to trigger migrations
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

// Only run heavy schema checks if version changed
if (dbVersion < currentSchemaVersion) {
    console.log(`MIGRATION: Database version [${dbVersion}] detected. Updating to [${currentSchemaVersion}]...`);
    
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
        ciudad TEXT DEFAULT '',
        distrito TEXT DEFAULT '',
        barrio TEXT DEFAULT '',
        campaign_id INTEGER
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

      CREATE INDEX IF NOT EXISTS idx_users_list ON users(assigned_list_id);
      CREATE INDEX IF NOT EXISTS idx_users_campaign ON users(assigned_campaign_id);
      CREATE INDEX IF NOT EXISTS idx_users_parent ON users(parent_id);
      CREATE INDEX IF NOT EXISTS idx_users_ci ON users(ci);
      CREATE INDEX IF NOT EXISTS idx_users_distrito ON users(distrito);

      CREATE INDEX IF NOT EXISTS idx_electors_local ON electors(local_votacion);
      CREATE INDEX IF NOT EXISTS idx_electors_mesa ON electors(mesa);
      CREATE INDEX IF NOT EXISTS idx_electors_distrito ON electors(ciudad);

      CREATE INDEX IF NOT EXISTS idx_captures_ci ON elector_captures(elector_ci);
      CREATE INDEX IF NOT EXISTS idx_captures_coord ON elector_captures(coordinator_id);
      CREATE INDEX IF NOT EXISTS idx_captures_list ON elector_captures(list_id);
      CREATE INDEX IF NOT EXISTS idx_captures_campaign ON elector_captures(campaign_id);

      CREATE INDEX IF NOT EXISTS idx_conflicts_ci ON capture_conflicts(elector_ci);
      CREATE INDEX IF NOT EXISTS idx_conflicts_ids ON capture_conflicts(capture_id, capture_id_b);
      CREATE INDEX IF NOT EXISTS idx_conflicts_lists ON capture_conflicts(list_id_a, list_id_b);

      CREATE INDEX IF NOT EXISTS idx_lists_campaign ON lists(campaign_id);
      CREATE INDEX IF NOT EXISTS idx_lists_ciudad ON lists(ciudad);
      
      CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_terminal ON whatsapp_messages(terminal_id);
      CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_contact ON whatsapp_messages(contact_number);
    `);

    const addColumnIfNotExists = (tableName: string, columnName: string, columnDef: string) => {
      try {
        const columns = db.prepare(`PRAGMA table_info(${tableName})`).all() as any[];
        if (!columns.some(c => c.name === columnName)) {
          db.prepare(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${columnDef}`).run();
          console.log(`MIGRATION: Added column [${columnName}] to table [${tableName}]`);
        }
      } catch (e: any) { console.error(`MIGRATION ERROR adding ${columnName} to ${tableName}: ${e.message}`); }
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
    addColumnIfNotExists("elector_captures", "transport_status", "TEXT DEFAULT 'PENDING'");
    addColumnIfNotExists("electors", "ciudad", "TEXT DEFAULT ''");
    addColumnIfNotExists("electors", "distrito", "TEXT DEFAULT ''");
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
    addColumnIfNotExists("whatsapp_messages", "type", "TEXT DEFAULT 'chat'");
    addColumnIfNotExists("whatsapp_messages", "media_url", "TEXT");
    addColumnIfNotExists("whatsapp_broadcast_logs", "terminal_id", "TEXT DEFAULT 'default'");
    addColumnIfNotExists("electors", "campaign_id", "INTEGER");
    addColumnIfNotExists("whatsapp_terminals", "campaign_id", "INTEGER");
    addColumnIfNotExists("whatsapp_messages", "campaign_id", "INTEGER");
    addColumnIfNotExists("voting_locations", "campaign_id", "INTEGER");
    addColumnIfNotExists("vehicles", "lat", "REAL");
    addColumnIfNotExists("vehicles", "lng", "REAL");
    addColumnIfNotExists("vehicles", "last_update", "DATETIME");
    addColumnIfNotExists("vehicles", "driver_photo", "TEXT DEFAULT ''");
    addColumnIfNotExists("vehicles", "assigned_user_id", "INTEGER");
    addColumnIfNotExists("vehicles", "type", "TEXT");
    addColumnIfNotExists("vehicles", "plate", "TEXT");

    // Indexes for better JOIN performance
    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_electors_local_mesa ON electors (local_votacion, mesa);
      CREATE INDEX IF NOT EXISTS idx_electors_ciudad ON electors (ciudad);
      CREATE INDEX IF NOT EXISTS idx_electors_distrito ON electors (distrito);
      CREATE INDEX IF NOT EXISTS idx_electors_nombre ON electors (nombre, apellido);
      CREATE INDEX IF NOT EXISTS idx_users_parent ON users (parent_id);
      CREATE INDEX IF NOT EXISTS idx_users_ci ON users (ci);
      CREATE INDEX IF NOT EXISTS idx_users_username ON users (username);
      CREATE INDEX IF NOT EXISTS idx_users_list ON users (assigned_list_id);
      CREATE INDEX IF NOT EXISTS idx_users_campaign ON users (assigned_campaign_id);
      CREATE INDEX IF NOT EXISTS idx_lists_campaign ON lists (campaign_id);
      CREATE INDEX IF NOT EXISTS idx_lists_ciudad ON lists (ciudad);
      CREATE INDEX IF NOT EXISTS idx_elector_captures_ci ON elector_captures(elector_ci);
      CREATE INDEX IF NOT EXISTS idx_elector_captures_list ON elector_captures(list_id);
      CREATE INDEX IF NOT EXISTS idx_elector_captures_coord ON elector_captures(coordinator_id);
      CREATE INDEX IF NOT EXISTS idx_elector_captures_timestamp ON elector_captures(timestamp DESC);
      CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON audit_logs(user_id);
      CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_terminal ON whatsapp_messages(terminal_id, timestamp DESC);
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
        const idsString = invalidCaptureIds.map(c => c.id).join(',');
        db.prepare(`UPDATE elector_captures SET is_disputed = 0 WHERE id IN (${idsString})`).run();
      }

      // Delete the invalid conflict rows
      db.prepare(`
        DELETE FROM capture_conflicts 
        WHERE capture_id_b IS NULL OR capture_id IS NULL OR capture_id = capture_id_b;
      `).run();

      console.log("MIGRATION: Successfully repaired and synchronized existing capture conflicts.");
    } catch (err: any) {
      console.log("MIGRATION: Conflict repair skipped or error:", err.message);
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
        UPDATE electors SET 
          ci = REPLACE(REPLACE(TRIM(ci), '.', ''), ' ', ''),
          ciudad = UPPER(TRIM(ciudad)), 
          distrito = UPPER(TRIM(distrito)) 
        WHERE ci IS NOT NULL;
      `);
      
      // 2. Clean Captures (Critical for JOINs)
      db.exec(`
        UPDATE elector_captures SET 
          elector_ci = REPLACE(REPLACE(TRIM(elector_ci), '.', ''), ' ', '')
        WHERE elector_ci IS NOT NULL;
      `);

      // 3. Clean Conflicts
      db.exec(`
        UPDATE capture_conflicts SET 
          elector_ci = REPLACE(REPLACE(TRIM(elector_ci), '.', ''), ' ', '')
        WHERE elector_ci IS NOT NULL;
      `);

      // 4. Clean Users (CI and Username are often the same)
      db.exec(`
        UPDATE users SET 
          ci = REPLACE(REPLACE(TRIM(ci), '.', ''), ' ', ''),
          username = REPLACE(REPLACE(TRIM(username), '.', ''), ' ', ''),
          distrito = UPPER(TRIM(distrito)) 
        WHERE ci IS NOT NULL;
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

export default db;
