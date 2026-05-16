import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { z } from 'zod';
import db from './db';
import { whatsappService } from './whatsappService';
import * as XLSX from 'xlsx';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

const ALLOWED_ORIGINS = [
  'https://intelecciones.vercel.app',
  'http://localhost:5173',
  'http://localhost:3000',
];

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (native mobile apps, Postman)
    if (!origin) return callback(null, true);
    // In development: allow all origins (covers LAN IPs for phone testing)
    if (process.env.NODE_ENV !== 'production') return callback(null, true);
    // In production: allow listed origins + any *.vercel.app subdomain
    if (ALLOWED_ORIGINS.includes(origin) || /^https:\/\/[a-z0-9-]+\.vercel\.app$/.test(origin)) {
      return callback(null, true);
    }
    return callback(new Error('Not allowed by CORS'), false);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-list-id', 'x-user-role', 'x-user-id', 'x-district', 'Accept']
}));

// Global request timeout (30s) — prevents hanging queries on slow mobile connections
app.use((_req, res, next) => {
  res.setTimeout(30000, () => {
    if (!res.headersSent) res.status(408).json({ error: 'Request timeout' });
  });
  next();
});
// 📸 Multer Setup for Photos
const uploadDir = process.env.NODE_ENV === 'production'
  ? '/app/data/uploads'
  : path.join(__dirname, '../uploads');
  
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

app.use(express.json());
app.use('/uploads', express.static(uploadDir));

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

// 💓 Health Check & Warmup
app.get('/api/ping', (_req, res) => {
  try {
    // Light db query to verify connection
    db.prepare('SELECT 1').get();
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  } catch (e) {
    res.status(500).json({ status: 'error', message: 'Database unreachable' });
  }
});
// 📊 Robust Recursive Storage Diagnosis & Safe Cache Purge
const performStorageMaintenance = async () => {
  if (process.env.NODE_ENV !== 'production') return;
  
  // Delay maintenance to allow server to handle initial traffic/health checks
  await new Promise(resolve => setTimeout(resolve, 10000));

  try {
    const dataDir = '/app/data';
    if (!fs.existsSync(dataDir)) return;

    const safePurge = (basePath: string) => {
      try {
        const cacheFolders = ['Cache', 'Code Cache', 'GPUCache', 'Service Worker/CacheStorage'];
        if (!fs.existsSync(basePath)) return;
        const items = fs.readdirSync(basePath);
        for (const item of items) {
          const fullPath = path.join(basePath, item);
          try {
            if (!fs.existsSync(fullPath)) continue;
            const s = fs.statSync(fullPath);
            if (s.isDirectory()) {
              if (cacheFolders.some(cf => item.includes(cf) || fullPath.endsWith(cf))) {
                console.log(`[STORAGE] Purging cache: ${fullPath}`);
                fs.rmSync(fullPath, { recursive: true, force: true });
              } else {
                safePurge(fullPath);
              }
            }
          } catch (e) {} 
        }
      } catch (e) {}
    };
    
    console.log("[STORAGE] Starting safe background cleanup...");
    safePurge(path.join(dataDir, 'whatsapp_session_default'));
    safePurge(path.join(dataDir, 'whatsapp_session'));

    const getDirSize = (dirPath: string): number => {
      let size = 0;
      try {
        if (!fs.existsSync(dirPath)) return 0;
        const files = fs.readdirSync(dirPath);
        for (const f of files) {
          const fullPath = path.join(dirPath, f);
          try {
            if (!fs.existsSync(fullPath)) continue;
            const s = fs.statSync(fullPath);
            if (s.isDirectory()) size += getDirSize(fullPath);
            else size += s.size;
          } catch (e) {}
        }
      } catch (e) {}
      return size;
    };

    const stats = fs.readdirSync(dataDir).map(f => {
      const fullPath = path.join(dataDir, f);
      try {
        const s = fs.statSync(fullPath);
        if (s.isDirectory()) {
          return { name: f + ' (DIR)', size: (getDirSize(fullPath) / 1024 / 1024).toFixed(2) + ' MB' };
        }
        return { name: f, size: (s.size / 1024 / 1024).toFixed(2) + ' MB' };
      } catch (e) { return { name: f, size: 'Error' }; }
    });
    console.log('--- REAL STORAGE DIAGNOSIS ---');
    console.table(stats);
    console.log('------------------------------');
  } catch (e) { 
    console.error('Storage maintenance error:', e); 
  }
};

// Execute maintenance in background
performStorageMaintenance();

const upload = multer({ 
  storage,
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

// 📱 OFFLINE SYNC ENDPOINT
app.get('/api/offline/padron', (req, res) => {
  const user_id = req.headers['x-user-id'];
  const role = req.headers['x-user-role'];
  const headerDistrict = getDistrict(req);

  try {
    let query = 'SELECT ci, nombre, apellido, local_votacion, mesa, orden FROM electors';
    let params: any[] = [];
    let activeDistrito = headerDistrict;

    // Resolve user's assigned district
    let userDistrito = null;
    if (user_id) {
      const user = db.prepare(`
        SELECT COALESCE(l.ciudad, c.distrito, u.distrito) as distrito 
        FROM users u 
        LEFT JOIN lists l ON u.assigned_list_id = l.id 
        LEFT JOIN campaigns c ON (l.campaign_id = c.id OR u.assigned_campaign_id = c.id)
        WHERE u.id = ?
      `).get(user_id) as any;
      userDistrito = user?.distrito;
    }

    // Force strict district filtering for non-superusers
    if (role !== 'SUPERUSUARIO' && role !== 'SUPER_ADMIN') {
        if (userDistrito) {
            activeDistrito = userDistrito;
        }
    } else if (!activeDistrito) {
        activeDistrito = userDistrito;
    }

    // Filter by district if we found one
    if (activeDistrito) {
      const columns = db.prepare('PRAGMA table_info(electors)').all() as any[];
      const hasCiudad = columns.some(c => c.name === 'ciudad');
      const hasDistrito = columns.some(c => c.name === 'distrito');

      if (hasDistrito && hasCiudad) {
        query += " WHERE UPPER(distrito) = UPPER(?) OR UPPER(ciudad) = UPPER(?)";
        params = [activeDistrito, activeDistrito];
      } else if (hasDistrito) {
        query += " WHERE UPPER(distrito) = UPPER(?)";
        params = [activeDistrito];
      } else if (hasCiudad) {
        query += " WHERE UPPER(ciudad) = UPPER(?)";
        params = [activeDistrito];
      }
      console.log(`[OFFLINE] Filtrando padrón para distrito: ${activeDistrito}`);
    } else if (role !== 'SUPERUSUARIO') {
      // If NOT SuperUser and NO district found, return empty to prevent data leak/overload
      return res.json([]);
    }

    const electors = db.prepare(query).all(...params);
    
    // Compact mapping: [ci, nombre, apellido, local, mesa, orden]
    const compact = (electors as any[]).map(e => [e.ci, e.nombre, e.apellido, e.local_votacion, e.mesa, e.orden]);
    
    console.log(`[OFFLINE] Enviando ${compact.length} registros compactos.`);
    res.json(compact);
  } catch (err: any) {
    console.error('[OFFLINE ERROR]', err);
    res.status(500).json({ error: err.message });
  }
});

// --- Audit Utility ---
const logAction = (user_id: number | null, action: string, entity: string, entity_id: string | number | null, details: string) => {
  try {
    db.prepare(`
      INSERT INTO audit_logs (user_id, action, entity, entity_id, details)
      VALUES (?, ?, ?, ?, ?)
    `).run(user_id, action, entity, entity_id?.toString(), details);
  } catch (err) {
    console.error("Audit Logging Failed:", err);
  }
};

app.post('/api/upload-photo', upload.single('photo'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  
  const host = req.get('host') || '';
  let protocol = (req.headers['x-forwarded-proto'] as string) || req.protocol;
  
  // Force HTTPS in production or for specific domains like railway.app
  if (process.env.NODE_ENV === 'production' || host.includes('railway.app') || host.includes('vercel.app')) {
    protocol = 'https';
  }

  const baseUrl = process.env.APP_URL ? process.env.APP_URL.replace(/\/$/, '') : `${protocol}://${host}`;
  const photoUrl = `${baseUrl}/uploads/${req.file.filename}`;
  res.json({ photo_url: photoUrl });
});

// CI Validation Logic (Paraguay format)
const validateCI = (ci: string) => {
  return /^\d+$/.test(ci.replace(/\./g, ''));
};

const ElectorSchema = z.object({
  ci: z.string().refine(validateCI, { message: 'Formato de C.I. inválido' }),
  nombre: z.string(),
  departamento: z.string(),
  distrito: z.string(),
  local_votacion: z.string(),
  barrio: z.string().optional(),
  mesa: z.number(),
  orden: z.number(),
  partido: z.string().optional(),
  is_priority: z.boolean().optional(),
  campaign_id: z.number().optional(),
});

const CaptureSchema = z.object({
  elector_ci: z.string(),
  coordinator_id: z.number(), 
  lat: z.number(),
  lng: z.number(),
  traffic_light: z.enum(['GREEN', 'YELLOW', 'RED', 'PURPLE']),
  needs_transport: z.boolean().optional(),
  telefono: z.string().min(6, "El teléfono es obligatorio"),
});


// Health Check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', service: 'Intellecciones Backend', ts: Date.now() });
});

// Session Verification — refreshes user data from DB (called on frontend app mount)
app.get('/api/me', (req, res) => {
  const userId = req.headers['x-user-id'] as string;
  if (!userId || userId === 'undefined' || userId === '') {
    return res.status(401).json({ error: 'No auth header' });
  }
  try {
    const user = db.prepare(`
      SELECT u.id, u.username, u.role, u.nombre, u.photo_url, u.ci, u.telefono,
             u.assigned_list_id, u.assigned_campaign_id, u.distrito, u.status,
             u.needs_password_change, u.enabled_modules as user_modules,
             c.enabled_modules as campaign_modules,
             COALESCE(l.ciudad, c.distrito) as effective_distrito,
             l.list_number, l.campaign_id
      FROM users u
      LEFT JOIN lists l ON u.assigned_list_id = l.id
      LEFT JOIN campaigns c ON (u.assigned_campaign_id = c.id OR l.campaign_id = c.id)
      WHERE u.id = ?
    `).get(userId) as any;
    if (!user) return res.status(401).json({ error: 'Usuario no encontrado' });
    if (user.status === 'INACTIVE') return res.status(403).json({ error: 'Cuenta desactivada' });

    // Invalidate cache so next security filter uses fresh data
    clearUserCache(userId);

    res.json({
      id: user.id,
      username: user.username,
      role: user.role,
      nombre: user.nombre,
      photo_url: user.photo_url,
      ci: user.ci,
      telefono: user.telefono,
      assigned_list_id: user.assigned_list_id,
      assigned_campaign_id: user.assigned_campaign_id,
      distrito: user.effective_distrito || user.distrito,
      needs_password_change: !!user.needs_password_change,
      enabled_modules: (() => {
        if (user.role === 'SUPERUSUARIO') return ['COMMAND_CENTER', 'REGISTRY', 'LOGISTICS', 'WHATSAPP', 'DAY_D', 'COMMUNICATIONS', 'SUPER_ADMIN'];
        
        const campMods = user.campaign_modules ? user.campaign_modules.split(',') : ['COMMAND_CENTER', 'REGISTRY'];
        const userMods = user.user_modules ? user.user_modules.split(',') : campMods;
        
        return userMods.filter((m: string) => campMods.includes(m));
      })(),
      v: "1.0.6"
    });
  } catch (err: any) {
    console.error('[/api/me error]', err.message);
    res.status(500).json({ error: 'Error interno' });
  }
});

app.get('/api/debug/db-info', (req, res) => {
  const dbDir = process.env.NODE_ENV === 'production' ? '/app/data' : process.cwd();
  const dbPath = path.join(dbDir, 'intellecciones.db');
  const seedPath = path.join(process.cwd(), 'intellecciones.db');
  
  res.json({
    env: process.env.NODE_ENV,
    cwd: process.cwd(),
    dbPath,
    dbExists: fs.existsSync(dbPath),
    dbSize: fs.existsSync(dbPath) ? fs.statSync(dbPath).size : 0,
    seedExists: fs.existsSync(seedPath),
    seedSize: fs.existsSync(seedPath) ? fs.statSync(seedPath).size : 0
  });
});

app.post('/api/ingest', (req, res) => {
  try {
    const data = req.body.electors ? req.body.electors : req.body;
    const electors = z.array(ElectorSchema).parse(data);
    const insert = db.prepare(`
      INSERT OR REPLACE INTO electors (ci, nombre, departamento, distrito, local_votacion, mesa, orden, partido, is_priority)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const transaction = db.transaction((data) => {
      for (const elector of data) {
        insert.run(
          elector.ci,
          elector.nombre,
          elector.departamento,
          elector.distrito,
          elector.local_votacion,
          elector.mesa,
          elector.orden,
          elector.partido || null,
          elector.is_priority ? 1 : 0
        );
      }
    });

    transaction(electors);
    res.json({ message: `${electors.length} electores procesados correctamente.` });
  } catch (error: any) {
    res.status(400).json({ error: error.errors || error.message });
  }
});

// --- Multi-tenancy Helpers ---
const getListId = (req: express.Request) => {
  const q = req.query.listId as string;
  if (q && q !== 'null' && q !== 'undefined' && q !== '') return parseInt(q);

  const h = req.headers['x-list-id'];
  return (h && h !== 'null' && h !== 'undefined' && h !== '') ? parseInt(h as string) : null;
};

const getDistrict = (req: express.Request) => {
  const q = req.query.district as string;
  const d = req.headers['x-district'];
  const val = (q && q !== 'null' && q !== 'undefined' && q !== '') ? q : (d as string);
  if (!val || val === 'null' || val === 'undefined') return null;
  const normalized = val.toString().toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
  if (['GLOBAL', 'TODOS', 'ALL', 'TODAS', ''].includes(normalized)) return null;
  return normalized;
};

const getRole = (req: express.Request) => {
  const role = (req.headers['x-user-role'] as string || 'GUEST').toUpperCase().trim();
  if (role === 'SUPER_ADMIN' || role === 'SUPERUSUARIO') return 'SUPERUSUARIO';
  if (role === 'CANDIDATE' || role === 'JEFE_CAMPANA') return 'JEFE_CAMPANA';
  if (role === 'SUBJEFE' || role === 'LIDER_LISTA') return 'SUBJEFE';
  if (role === 'COORDINATOR' || role === 'COORDINADOR') return 'COORDINADOR';
  return role;
};

// ── User district cache ────────────────────────────────────────────────────
// Avoids a DB JOIN query on every single API request for non-SUPERUSUARIO users.
// Cache TTL: 2 minutes. Cleared on user updates.
interface CachedUser { 
  id: number;
  role: string;
  assigned_list_id: number|null; 
  assigned_campaign_id: number|null; 
  distrito: string|null; 
  campaign_id: number|null; 
  ts: number; 
}
const _userCache = new Map<string, CachedUser>();
const USER_CACHE_TTL = 120_000;

const getCachedUserInfo = (user_id: string): CachedUser | null => {
  const now = Date.now();
  const hit = _userCache.get(user_id);
  if (hit && now - hit.ts < USER_CACHE_TTL) return hit;
  const user = db.prepare(`
    SELECT u.id, u.role, u.assigned_list_id, u.assigned_campaign_id,
           COALESCE(u.distrito, l.ciudad, c.distrito) as distrito,
           COALESCE(l.campaign_id, u.assigned_campaign_id) as campaign_id
    FROM users u
    LEFT JOIN lists l ON u.assigned_list_id = l.id
    LEFT JOIN campaigns c ON (l.campaign_id = c.id OR u.assigned_campaign_id = c.id)
    WHERE u.id = ?
  `).get(user_id) as any;
  if (!user) return null;
  const entry: CachedUser = { 
    id: user.id,
    role: user.role,
    assigned_list_id: user.assigned_list_id, 
    assigned_campaign_id: user.assigned_campaign_id, 
    distrito: user.distrito, 
    campaign_id: user.campaign_id ?? null, 
    ts: now 
  };
  _userCache.set(user_id, entry);
  return entry;
};

const clearUserCache = (user_id: string | number) => _userCache.delete(String(user_id));

// ── Role-based access middleware ────────────────────────────────────────────
const requireRole = (...roles: string[]) => (req: express.Request, res: express.Response, next: express.NextFunction) => {
  const role = (req.headers['x-user-role'] as string || '').toUpperCase().trim();
  if (!roles.map(r => r.toUpperCase()).includes(role)) {
    return res.status(403).json({ error: 'Acceso denegado. Rol insuficiente.' });
  }
  next();
};
// ────────────────────────────────────────────────────────────────────────────

const getSecurityFilter = (req: express.Request, tableAlias: string = 'c') => {
  try {
    const user_id = req.headers['x-user-id'] as string;
    const headerRole = (req.headers['x-user-role'] as string || '').toUpperCase().trim();
    const activeDistrict = getDistrict(req);
    
    // FETCH REAL ROLE FROM DB/CACHE IF HEADER IS MISSING OR GENERIC
    let user: CachedUser | null = null;
    if (user_id && user_id !== 'undefined' && user_id !== 'null' && user_id !== '') {
      user = getCachedUserInfo(user_id);
    }
    
    const role = (user?.role || headerRole || 'GUEST').toUpperCase().trim();
    const normalizedActiveDistrict = activeDistrict ? activeDistrict.toUpperCase().trim() : null;

    // 1. Column name mapping: 'lists' and 'electors' use 'ciudad', others use 'distrito'
    let distColumn = 'distrito';
    if (tableAlias === 'l' || tableAlias === 'e') distColumn = 'ciudad';

    // 2. Admin Isolation: SuperUsers see everything, Jefe de Campaña sees their campaign
    if (role === 'SUPERUSUARIO' || role === 'SUPER_ADMIN' || role === 'JEFE_CAMPANA') {
      let sql = '';
      let params: any[] = [];

      // 1. Determine the effective district to filter by
      let effectiveDistrict = getDistrict(req);
      
      // CRITICAL: If they are a JEFE_CAMPANA, their profile district ALWAYS overrides or acts as fallback
      if (role === 'JEFE_CAMPANA' && user?.distrito) {
        effectiveDistrict = user.distrito;
      }

      if (effectiveDistrict) {
        const d = effectiveDistrict; // Already normalized in getDistrict
        if (tableAlias === 'u') {
          sql += ` AND (
            REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(UPPER(u.distrito), 'Á', 'A'), 'É', 'E'), 'Í', 'I'), 'Ó', 'O'), 'Ú', 'U') = ? OR 
            EXISTS (SELECT 1 FROM lists l2 WHERE l2.id = u.assigned_list_id AND REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(UPPER(l2.ciudad), 'Á', 'A'), 'É', 'E'), 'Í', 'I'), 'Ó', 'O'), 'Ú', 'U') = ?) OR 
            EXISTS (SELECT 1 FROM campaigns c2 WHERE c2.id = u.assigned_campaign_id AND REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(UPPER(c2.distrito), 'Á', 'A'), 'É', 'E'), 'Í', 'I'), 'Ó', 'O'), 'Ú', 'U') = ?)
          )`;
          params.push(d, d, d);
        } else if (tableAlias === 'ec') {
          sql += ` AND (
            REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(UPPER(e.ciudad), 'Á', 'A'), 'É', 'E'), 'Í', 'I'), 'Ó', 'O'), 'Ú', 'U') = ? OR 
            REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(UPPER(e.distrito), 'Á', 'A'), 'É', 'E'), 'Í', 'I'), 'Ó', 'O'), 'Ú', 'U') = ?
          )`;
          params.push(d, d);
        } else if (tableAlias === 'whatsapp_messages') {
           // No direct district filter for raw messages yet
        } else {
          // For lists, electors, campaigns, voting_locations
          const colA = (tableAlias === 'l' || tableAlias === 'e') ? 'ciudad' : 'distrito';
          const colB = (tableAlias === 'e' || tableAlias === 'loc') ? 'distrito' : 'ciudad';
          sql += ` AND (
            REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(UPPER(${tableAlias}.${colA}), 'Á', 'A'), 'É', 'E'), 'Í', 'I'), 'Ó', 'O'), 'Ú', 'U') = ? OR 
            REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(UPPER(${tableAlias}.${colB}), 'Á', 'A'), 'É', 'E'), 'Í', 'I'), 'Ó', 'O'), 'Ú', 'U') = ?
          )`;
          params.push(d, d);
        }
      }

      // 2. Campaign/List Isolation for non-SuperUsers (only if no district is assigned)
      if (role === 'JEFE_CAMPANA' && !effectiveDistrict) {
        if (user?.campaign_id) {
            if (tableAlias === 'e') {
              sql += ` AND (e.campaign_id = ? OR e.campaign_id IS NULL)`;
              params.push(user.campaign_id);
            } else {
              const col = (tableAlias === 'c') ? 'id' : 'assigned_campaign_id';
              const finalCol = (tableAlias === 'l') ? 'campaign_id' : col;
              sql += ` AND ${tableAlias}.${finalCol} = ?`;
              params.push(user.campaign_id);
            }
        }
      }

      const listId = getListId(req);
      if (listId && !isNaN(listId)) {
         if (tableAlias === 'l') {
           sql += ` AND ${tableAlias}.id = ?`;
           params.push(listId);
         } else if (tableAlias === 'ec' || tableAlias === 'whatsapp_messages' || tableAlias === 'u' || tableAlias === 'capture_conflicts') {
           const col = (tableAlias === 'u') ? 'assigned_list_id' : 'list_id';
           sql += ` AND ${tableAlias}.${col} = ?`;
           params.push(listId);
         } else if (tableAlias === 'e') {
           sql += ` AND EXISTS (SELECT 1 FROM elector_captures ec2 WHERE ec2.elector_ci = e.ci AND ec2.list_id = ?)`;
           params.push(listId);
         }
      }

      // 🛑 PRIVACY LAYER: If Jefe Campana, hide details of lists that have a SUBJEFE (unless orphan)
      // This applies to Captures, Users (Coordinators/Padrinos) and Conflicts details.
      // Macro stats (stats/command) should NOT use this filter to keep global numbers.
      const isDetailQuery = ['ec', 'u'].includes(tableAlias);
      const isPublicStats = req.path.includes('/stats/command'); // stats/command sees everything for totals
      
      if (role === 'JEFE_CAMPANA' && isDetailQuery && !isPublicStats) {
          const listCol = (tableAlias === 'u') ? 'assigned_list_id' : 'list_id';
          sql += ` AND (
            ${tableAlias}.${listCol} IS NULL OR 
            ${tableAlias}.role IN ('SUBJEFE', 'PADRINO') OR
            NOT EXISTS (SELECT 1 FROM users ul WHERE ul.assigned_list_id = ${tableAlias}.${listCol} AND ul.role IN ('SUBJEFE', 'PADRINO'))
          )`;
      }

      return { sql, params };
    }

    // 3. Non-SuperUsers: Locked to their assignment (uses cache)
    if (!user || !user.distrito) {
      if (role !== 'GUEST') {
        console.warn(`[SECURITY] User ${user_id} (${role}) blocked - missing district assignment. Cache result:`, user);
      }
      return { sql: ' AND 1=0', params: [] };
    }

    // Adjust for ec (elector_captures) which needs to filter via joined electors table 'e'
    let targetAlias = tableAlias;
    let targetCol = distColumn;
    if (tableAlias === 'ec') {
      targetAlias = 'e';
      targetCol = 'ciudad';
    }

    let sql = ` AND UPPER(${targetAlias}.${targetCol}) = UPPER(?)`;
    let params: any[] = [user.distrito];

    if ((tableAlias === 'e') && user.campaign_id) {
      sql += ` AND (${targetAlias}.campaign_id = ? OR ${targetAlias}.campaign_id IS NULL)`;
      params.push(user.campaign_id);
    }

    // 4. Strict Hierarchy Isolation (for users/lists)
    if ((tableAlias === 'u' || tableAlias === 'l') && role !== 'JEFE_CAMPANA') {
      if (user.assigned_list_id) {
         if (tableAlias === 'l') sql += ` AND ${tableAlias}.id = ?`;
         else if (tableAlias === 'u') sql += ` AND ${tableAlias}.assigned_list_id = ?`;
         params.push(user.assigned_list_id);
      } else if (user.assigned_campaign_id) {
         if (tableAlias === 'l') sql += ` AND ${tableAlias}.campaign_id = ?`;
         else if (tableAlias === 'u') sql += ` AND ${tableAlias}.assigned_campaign_id = ?`;
         params.push(user.assigned_campaign_id);
      }
    }
    return { sql, params };
  } catch (err: any) {
    console.error('[SECURITY FILTER ERROR]', err);
    return { sql: '', params: [] }; 
  }
};

const getTenant = (req: any) => {
  return parseInt(req.headers['x-list-id'] as string) || null;
};

// Helper to wrap SQL queries with list_id filter if not superuser
const applyTenantFilter = (query: string, req: express.Request, params: any[] = []) => {
  const role = getRole(req);
  const listId = getListId(req);
  
  if (role === 'SUPERUSUARIO' || !listId) {
    return { filteredQuery: query, filteredParams: params };
  }

  // Very basic SQL injection prevention/appending
  // This assumes the query doesn't already have a complex WHERE or ORDER BY that might break
  const hasWhere = query.toUpperCase().includes('WHERE');
  const filteredQuery = hasWhere 
    ? query.replace(/WHERE/i, `WHERE list_id = ${listId} AND `)
    : query + ` WHERE list_id = ${listId}`;
    
  return { filteredQuery, filteredParams: params };
};

app.post('/api/login', (req, res) => {
  const { username, password, lat, lng } = req.body;
  const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
  const userAgent = req.headers['user-agent'] || 'Unknown';
  
  if (!username || !password) {
    return res.status(400).json({ error: 'Usuario y contraseña requeridos' });
  }

  const cleanUsername = username.toString().trim().replace(/\./g, '');
  const cleanPassword = password.toString().trim();
  
  console.log(`[AUTH] Intento de login: "${username}" de IP: ${ip}`);
  
  let user: any = null;

  // MODO RESCATE PARA GUSTAVO
  if (cleanUsername === '3657834' && cleanPassword === '123') {
    const rescueUser = db.prepare('SELECT * FROM users WHERE ci = ? OR username = ?').get(cleanUsername, cleanUsername) as any;
    if (!rescueUser) {
      db.prepare(`
  INSERT OR IGNORE INTO users (id, username, password, role, nombre, ci, needs_password_change) 
  VALUES (?, ?, ?, ?, ?, ?, 1)
`).run(Date.now(), '3657834', '123', 'SUPERUSUARIO', 'Gustavo Quevedo', '3657834');
      user = db.prepare('SELECT * FROM users WHERE ci = ?').get('3657834');
    } else {
      user = rescueUser;
    }
  }

  if (!user) {
    user = db.prepare(`
      SELECT u.*, c.enabled_modules as campaign_modules, c.distrito, COALESCE(u.assigned_campaign_id, l.campaign_id) as final_campaign_id
      FROM users u
      LEFT JOIN lists l ON u.assigned_list_id = l.id
      LEFT JOIN campaigns c ON (u.assigned_campaign_id = c.id OR l.campaign_id = c.id)
      WHERE u.username = ? OR u.ci = ? OR u.username = ? OR u.ci = ?
         OR REPLACE(u.username, '.', '') = ? OR REPLACE(u.ci, '.', '') = ?
    `).get(username.trim(), username.trim(), cleanUsername, cleanUsername, cleanUsername, cleanUsername) as any;
  }

  const normalizedSavedPassword = user?.password?.toString().replace(/\./g, '');
  const normalizedInputPassword = cleanPassword.replace(/\./g, '');

  const isSuccess = user && (user.password === cleanPassword || normalizedSavedPassword === normalizedInputPassword || (cleanUsername === '3657834' && cleanPassword === '123'));

  // LOG LOGIN ATTEMPT
  try {
    db.prepare(`
      INSERT INTO login_attempts (username, ip, user_agent, lat, lng, status, details)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      username, 
      Array.isArray(ip) ? ip[0] : ip, 
      userAgent, 
      lat || null, 
      lng || null, 
      isSuccess ? 'SUCCESS' : 'FAILED',
      `Login attempt for ${username} - ${isSuccess ? 'Authorized' : 'Denied'}`
    );
  } catch (err) {
    console.error('[AUTH LOG ERROR]', err);
  }

  if (isSuccess) { 
    res.json({
      id: user.id,
      username: user.username,
      role: user.role,
      assigned_list_id: user.assigned_list_id,
      assigned_campaign_id: user.assigned_campaign_id,
      nombre: user.nombre,
      photo_url: user.photo_url,
      ci: user.ci,
      distrito: user.distrito,
      enabled_modules: (() => {
        if (user.role === 'SUPERUSUARIO') return ['COMMAND_CENTER', 'REGISTRY', 'LOGISTICS', 'WHATSAPP', 'DAY_D', 'COMMUNICATIONS', 'SUPER_ADMIN'];
        
        const campMods = user.campaign_modules ? user.campaign_modules.split(',') : ['COMMAND_CENTER', 'REGISTRY'];
        const userMods = user.enabled_modules ? user.enabled_modules.split(',') : campMods;
        
        return userMods.filter((m: string) => campMods.includes(m));
      })(),
      needs_password_change: !!user.needs_password_change,
      v: "1.0.5"
    });
  } else {
    res.status(401).json({ error: 'Credenciales inválidas' });
  }
});

app.post('/api/dia-d/vote', (req, res) => {
  const tenant_id = getTenant(req);
  const { elector_ci } = req.body;
  try {
    db.prepare(`
      INSERT OR REPLACE INTO tenant_electors (tenant_id, elector_ci, status, last_visit)
      VALUES (?, ?, 'Voto Realizado', CURRENT_TIMESTAMP)
    `).run(tenant_id, elector_ci);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/electors/:ci', (req, res) => {
  const { ci } = req.params;
  const list_id = getListId(req);
  const user_id = req.headers['x-user-id'];
  const role = getRole(req);

  let distritoFilter = '';
  if (role !== 'SUPERUSUARIO' && role !== 'JEFE_CAMPANA' && user_id) {
    const user = db.prepare(`
      SELECT c.distrito 
      FROM users u 
      JOIN lists l ON u.assigned_list_id = l.id 
      JOIN campaigns c ON l.campaign_id = c.id 
      WHERE u.id = ?
    `).get(user_id) as any;
    if (user?.distrito) {
      distritoFilter = `AND (e.distrito = '${user.distrito}' OR e.ciudad = '${user.distrito}')`;
    }
  }
  
  const elector = db.prepare(`
    SELECT e.*, c.traffic_light, c.is_disputed, c.coordinator_id as captured_by, c.telefono
    FROM electors e
    LEFT JOIN elector_captures c ON e.ci = c.elector_ci AND (c.list_id = ? OR ? IS NULL)
    WHERE e.ci = ? ${distritoFilter}
  `).get(list_id, list_id, ci);
  
  if (elector) {
    res.json(elector);
  } else {
    res.status(404).json({ error: 'Elector no encontrado en el padrón.' });
  }
});

// Capture Endpoints
app.post('/api/captures', (req, res) => {
  try {
    const rawCapture = CaptureSchema.parse(req.body);
    const capture = { ...rawCapture, elector_ci: rawCapture.elector_ci.replace(/\./g, '').replace(/,/g, '').trim() };
    
    const user = db.prepare('SELECT assigned_list_id, assigned_campaign_id FROM users WHERE id = ?').get(capture.coordinator_id) as any;
    const list_id = user?.assigned_list_id;
    const campaign_id = user?.assigned_campaign_id;

    if (!list_id) return res.status(403).json({ error: 'El usuario no tiene una lista asignada.' });

    const transaction = db.transaction(() => {
      // 1. Check for conflict in the SAME LIST
      const intraListCapture = db.prepare('SELECT * FROM elector_captures WHERE elector_ci = ? AND list_id = ? LIMIT 1')
        .get(capture.elector_ci, list_id) as any;

      if (intraListCapture) {
        if (intraListCapture.coordinator_id !== capture.coordinator_id) {
          // Conflict within the same list: resolved by the Subjefe
          db.prepare('UPDATE elector_captures SET is_disputed = 1 WHERE elector_ci = ? AND list_id = ?').run(capture.elector_ci, list_id);
          
          const result = db.prepare(`
            INSERT INTO elector_captures (elector_ci, coordinator_id, list_id, campaign_id, lat, lng, traffic_light, is_disputed, telefono, needs_transport)
            VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?)
          `).run(capture.elector_ci, capture.coordinator_id, list_id, campaign_id, capture.lat, capture.lng, capture.traffic_light, capture.telefono, capture.needs_transport ? 1 : 0);

          db.prepare(`
            INSERT INTO capture_conflicts (capture_id, capture_id_b, elector_ci, list_id_a, list_id_b, conflict_type, status)
            VALUES (?, ?, ?, ?, ?, 'INTERNAL', 'PENDING')
          `).run(intraListCapture.id, Number(result.lastInsertRowid), capture.elector_ci, list_id, list_id);

          return { success: true, warning: 'Elector en disputa interna en tu lista. Se ha notificado al Jefe.', is_disputed: true };
        } else {
          // Update own capture
          db.prepare(`
            UPDATE elector_captures 
            SET lat = ?, lng = ?, traffic_light = ?, needs_transport = ?, timestamp = CURRENT_TIMESTAMP
            WHERE elector_ci = ? AND coordinator_id = ? AND list_id = ?
          `).run(capture.lat, capture.lng, capture.traffic_light, capture.needs_transport ? 1 : 0, capture.elector_ci, capture.coordinator_id, list_id);
          
          logAction(capture.coordinator_id, 'UPDATE', 'CAPTURE', capture.elector_ci, `Updated capture for ${capture.elector_ci}`);
          return { success: true, message: 'Captura actualizada correctamente.', is_disputed: intraListCapture.is_disputed === 1 };
        }
      }

      // 2. Check for conflict in DIFFERENT LIST but SAME CAMPAIGN
      const interListCapture = db.prepare(`
        SELECT * FROM elector_captures 
        WHERE elector_ci = ? AND campaign_id = ? AND list_id != ? AND is_disputed = 0 
        LIMIT 1
      `).get(capture.elector_ci, campaign_id, list_id) as any;

      if (interListCapture) {
        // Inter-list conflict: Requires Jefe decision + 2 consents
        db.prepare('UPDATE elector_captures SET is_disputed = 1 WHERE id = ?').run(interListCapture.id);
        
        const result = db.prepare(`
          INSERT INTO elector_captures (elector_ci, coordinator_id, list_id, campaign_id, lat, lng, traffic_light, is_disputed, telefono, needs_transport)
          VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?)
        `).run(capture.elector_ci, capture.coordinator_id, list_id, campaign_id, capture.lat, capture.lng, capture.traffic_light, capture.telefono, capture.needs_transport ? 1 : 0);

        db.prepare(`
          INSERT INTO capture_conflicts (capture_id, capture_id_b, elector_ci, list_id_a, list_id_b, conflict_type, status)
          VALUES (?, ?, ?, ?, ?, 'INTER_LIST', 'PENDING')
        `).run(interListCapture.id, Number(result.lastInsertRowid), capture.elector_ci, interListCapture.list_id, list_id);

        console.log(`[CONFLICT] Created INTER_LIST dispute. ID_A: ${interListCapture.id}, ID_B: ${result.lastInsertRowid}`);
        return { success: true, warning: 'Disputa Inter-Listas detectada. El Jefe de Campaña deberá arbitrar y ambos líderes consentir.', is_disputed: true };
      }

      // 3. New clean capture
      db.prepare(`
        INSERT INTO elector_captures (elector_ci, coordinator_id, list_id, campaign_id, lat, lng, traffic_light, telefono, needs_transport)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(capture.elector_ci, capture.coordinator_id, list_id, campaign_id, capture.lat, capture.lng, capture.traffic_light, capture.telefono, capture.needs_transport ? 1 : 0);
      
      logAction(capture.coordinator_id, 'CREATE', 'CAPTURE', capture.elector_ci, `Captured elector ${capture.elector_ci} as ${capture.traffic_light}`);
      
      return { success: true, is_disputed: false };
    });

    const result = transaction();
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ error: err.message || err.errors });
  }
});

// Consolidated in the admin/management section for consistency

app.get('/api/stats/neighborhoods', (req, res) => {
  const tenant_id = getTenant(req);
  const stats = db.prepare(`
    SELECT 
      e.barrio, 
      e.local_votacion, 
      COUNT(e.ci) as total,
      SUM(CASE WHEN te.status = 'Visitado' THEN 1 ELSE 0 END) as visited,
      SUM(CASE WHEN te.needs_transport = 1 THEN 1 ELSE 0 END) as transport_needed
    FROM electors e
    LEFT JOIN tenant_electors te ON e.ci = te.elector_ci AND te.tenant_id = ?
    GROUP BY e.barrio, e.local_votacion
  `).all(tenant_id);
  res.json(stats);
});

// Escrutinio Endpoints
app.post('/api/escrutinio', (req, res) => {
  const tenant_id = getTenant(req);
  const { mesa, local_votacion, votos_nuestro, votos_oponente_1, votos_oponente_2, votos_otros, votos_nulos, votos_blancos, foto_acta_url } = req.body;
  try {
    db.prepare(`
      INSERT OR REPLACE INTO results 
      (tenant_id, mesa, local_votacion, votos_nuestro, votos_oponente_1, votos_oponente_2, votos_otros, votos_nulos, votos_blancos, foto_acta_url)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(tenant_id, mesa, local_votacion, votos_nuestro, votos_oponente_1, votos_oponente_2, votos_otros, votos_nulos, votos_blancos, foto_acta_url);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/stats/results', (req, res) => {
  const tenant_id = getTenant(req);
  const totals = db.prepare(`
    SELECT 
      SUM(votos_nuestro) as nuestro,
      SUM(votos_oponente_1) as oponente_1,
      SUM(votos_oponente_2) as oponente_2,
      SUM(votos_otros) as otros,
      SUM(votos_nulos) as nulos,
      SUM(votos_blancos) as blancos,
      COUNT(id) as mesas_escrutadas
    FROM results
    WHERE tenant_id = ?
  `).get(tenant_id);
  res.json(totals);
});
app.get('/api/admin/verify-candidate/:ci', (req, res) => {
  let { ci } = req.params;
  const cleanCI = ci.replace(/\./g, '').replace(/,/g, '').trim();

  try {
    const candidate = db.prepare(`
      SELECT ci, nombre, apellido, distrito, departamento, photo_url 
      FROM electors 
      WHERE ci = ?
    `).get(cleanCI) as any;
    
    if (candidate) {
      res.json({
        ...candidate,
        photo_url: candidate.photo_url || `https://i.pravatar.cc/150?u=${candidate.ci}`
      });
    } else {
      res.status(404).json({ error: 'Candidato no encontrado en el padrón.' });
    }
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// User verification/lookup
app.get('/api/admin/verify-user/:ci', (req, res) => {
  let { ci } = req.params;
  const cleanCI = ci.replace(/\./g, '').replace(/,/g, '').trim();

  try {
    const elector = db.prepare(`
      SELECT ci, nombre, apellido, photo_url 
      FROM electors 
      WHERE ci = ?
    `).get(cleanCI) as any;

    const user = db.prepare(`
      SELECT photo_url 
      FROM users 
      WHERE username = ?
    `).get(cleanCI) as any;

    if (elector) {
      res.json({
        ...elector,
        photo_url: user?.photo_url || elector.photo_url || `https://i.pravatar.cc/150?u=${elector.ci}`
      });
    } else {
      res.status(404).json({ error: 'Persona no encontrada.' });
    }
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 🏥 SYSTEM HEALTH & AUDIT
app.get('/api/admin/system/health', (req, res) => {
  try {
    const userCount = db.prepare('SELECT COUNT(*) as count FROM users').get() as any;
    const captureCount = db.prepare('SELECT COUNT(*) as count FROM elector_captures').get() as any;
    const electorCount = db.prepare('SELECT COUNT(*) as count FROM electors').get() as any;
    const auditCount = db.prepare('SELECT COUNT(*) as count FROM audit_logs').get() as any;
    
    res.json({
      status: 'OK',
      database: {
        users: userCount.count,
        captures: captureCount.count,
        electors: electorCount.count,
        logs: auditCount.count
      },
      system: {
        uptime: Math.floor(process.uptime()),
        memory: Math.round(process.memoryUsage().rss / 1024 / 1024) + ' MB',
        node: process.version,
        timestamp: new Date().toISOString()
      }
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/admin/audit', (req, res) => {
  try {
    const { action, limit = 100 } = req.query;
    const sec = getSecurityFilter(req, 'u');
    let query = `
      SELECT a.*, u.username, u.distrito as user_district
      FROM audit_logs a
      LEFT JOIN users u ON a.user_id = u.id
      WHERE 1=1 ${sec.sql}
    `;
    const params = [...sec.params];

    if (action) {
      query += ' AND a.action LIKE ?';
      params.push(`%${action}%`);
    }

    query += ' ORDER BY a.timestamp DESC LIMIT ?';
    params.push(parseInt(limit as string));

    const logs = db.prepare(query).all(...params);
    res.json(logs);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 📥 BULK IMPORT PADRON
app.post('/api/admin/import-padron', upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No se subió ningún archivo' });
  
  try {
    const workbook = XLSX.readFile(req.file.path);
    const sheetName = workbook.SheetNames[0];
    const data = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName]) as any[];
    
    const insert = db.prepare(`
      INSERT OR REPLACE INTO electors (ci, nombre, apellido, local_votacion, mesa, orden, ciudad, distrito)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const transaction = db.transaction((rows) => {
      for (const row of rows) {
        insert.run(
          row.ci?.toString() || '',
          row.nombre || '',
          row.apellido || '',
          row.local || row.local_votacion || '',
          parseInt(row.mesa || '0'),
          parseInt(row.orden || '0'),
          row.ciudad || '',
          row.distrito || row.ciudad || ''
        );
      }
    });

    transaction(data);
    res.json({ success: true, count: data.length });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  } finally {
    if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
  }
});

// Voting Locations
app.get('/api/voting-locations', (req, res) => {
  const sec = getSecurityFilter(req, 'loc');
  try {
    const locations = db.prepare(`SELECT * FROM voting_locations loc WHERE 1=1 ${sec.sql}`).all(...sec.params);
    res.json(locations);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/voting-locations/:cod/geo', (req, res) => {
  const { cod } = req.params;
  const { lat, lng } = req.body;
  try {
    db.prepare('UPDATE voting_locations SET lat = ?, lng = ? WHERE cod_local = ?').run(lat, lng, cod);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/voting-locations/:cod/icon', (req, res) => {
  const { cod } = req.params;
  const { icon } = req.body;
  try {
    db.prepare('UPDATE voting_locations SET icon = ? WHERE cod_local = ?').run(icon, cod);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/admin/locales/sync-from-padron', (req, res) => {
  try {
    const rawLocales = db.prepare(`
      SELECT DISTINCT 
        UPPER(TRIM(local_votacion)) as nombre, 
        UPPER(TRIM(COALESCE(NULLIF(ciudad, ''), NULLIF(distrito, ''), 'SIN ASIGNAR'))) as ciudad
      FROM electors 
      WHERE local_votacion IS NOT NULL AND local_votacion != ''
    `).all();

    let added = 0;
    const insertStmt = db.prepare(`
      INSERT OR IGNORE INTO voting_locations (cod_local, nombre, ciudad, distrito)
      VALUES (?, ?, ?, ?)
    `);

    const transaction = db.transaction((locales) => {
      for (const loc of locales) {
        const cod = loc.nombre.substring(0, 15).replace(/[^A-Z0-9]/g, '') + '_' + Math.abs(hashCode(loc.nombre)).toString(36).substring(0, 4);
        const result = insertStmt.run(cod, loc.nombre, loc.ciudad, loc.ciudad);
        if (result.changes > 0) added++;
      }
    });

    transaction(rawLocales);
    res.json({ success: true, added });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

function hashCode(str: string) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0;
  }
  return hash;
}

// Campaign Management
app.get('/api/campaigns', (req, res) => {
  const sec = getSecurityFilter(req, 'c');
  const params = sec.params || [];
  
  try {
    const campaigns = db.prepare(`SELECT * FROM campaigns c WHERE 1=1 ${sec.sql}`).all(...params);
    res.json(campaigns);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/campaigns', (req, res) => {
  const { name, status, slogan, photo_url, enabled_modules, goal, distrito } = req.body;
  try {
    const modulesStr = Array.isArray(enabled_modules) ? enabled_modules.join(',') : (enabled_modules || 'COMMAND_CENTER,REGISTRY');
    const finalDist = distrito ? distrito.toString().toUpperCase().trim() : '';
    const finalName = name ? name.toString().toUpperCase().trim() : '';
    const finalSlogan = slogan ? slogan.toString().toUpperCase().trim() : '';

    const result = db.prepare(`
      INSERT INTO campaigns (name, status, slogan, photo_url, enabled_modules, goal, distrito)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(finalName, status || 'ACTIVE', finalSlogan, photo_url || null, modulesStr, goal || 1000, finalDist);
    
    logAction(1, 'CREATE', 'CAMPAIGN', Number(result.lastInsertRowid), `Created campaign ${name}`);
    res.json({ id: result.lastInsertRowid });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/campaigns/:id', (req, res) => {
  const { id } = req.params;
  const { name, status, slogan, photo_url, enabled_modules, goal, distrito } = req.body;
  try {
    const modulesStr = Array.isArray(enabled_modules) ? enabled_modules.join(',') : enabled_modules;
    const finalDist = distrito ? distrito.toString().toUpperCase().trim() : '';
    const finalName = name ? name.toString().toUpperCase().trim() : '';
    const finalSlogan = slogan ? slogan.toString().toUpperCase().trim() : '';

    db.prepare('UPDATE campaigns SET name = ?, status = ?, slogan = ?, photo_url = ?, enabled_modules = ?, goal = ?, distrito = ? WHERE id = ?')
      .run(finalName, status || 'ACTIVE', finalSlogan, photo_url || null, modulesStr || 'COMMAND_CENTER,REGISTRY', goal || 1000, finalDist, id);
    
    logAction(1, 'UPDATE', 'CAMPAIGN', id, `Updated campaign ${name}`);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/campaigns/:id', (req, res) => {
  const { id } = req.params;
  const campaign_id = parseInt(id);
  
  if (isNaN(campaign_id)) {
    return res.status(400).json({ error: "ID de campaña inválido" });
  }

  try {
    const nullifyUserLists = db.prepare(`
      UPDATE users SET assigned_list_id = NULL 
      WHERE assigned_list_id IN (SELECT id FROM lists WHERE campaign_id = ?)
    `);
    const deleteLists = db.prepare('DELETE FROM lists WHERE campaign_id = ?');
    const deleteCampaign = db.prepare('DELETE FROM campaigns WHERE id = ?');
    
    const transaction = db.transaction(() => {
      nullifyUserLists.run(campaign_id);
      deleteLists.run(campaign_id);
      deleteCampaign.run(campaign_id);
    });
    
    transaction();
    logAction(1, 'DELETE', 'CAMPAIGN', campaign_id, `Deleted campaign ${campaign_id} and purged all associated lists`);
    res.json({ success: true });
  } catch (err: any) {
    console.error("Error deleting campaign:", err);
    res.status(500).json({ error: "No se pudo borrar la campaña: " + err.message });
  }
});

// Lists Management
app.post('/api/lists', (req, res) => {
  const { campaign_id, type, list_number, option_number, candidate_ci, photo_url, goal, candidate_nombre, candidate_alias, ciudad } = req.body;
  
  if (!campaign_id || !type || !list_number || !candidate_ci || !ciudad) {
    return res.status(400).json({ error: 'Faltan campos obligatorios para registrar la lista (incluyendo ciudad).' });
  }

  try {
    db.transaction(() => {
      const finalCiudad = ciudad.toString().toUpperCase().trim();
      const finalAlias = (candidate_alias || '').toString().toUpperCase().trim();
      const finalNombre = (candidate_nombre || '').toString().toUpperCase().trim();

      const result = db.prepare(`
        INSERT INTO lists (campaign_id, type, list_number, option_number, candidate_ci, photo_url, goal, candidate_nombre, candidate_alias, ciudad)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(campaign_id, type, list_number, option_number, candidate_ci, photo_url, goal || 1000, finalNombre, finalAlias, finalCiudad);

      if (photo_url) {
        db.prepare('UPDATE electors SET photo_url = ? WHERE ci = ?').run(photo_url, candidate_ci);
      }
      
      logAction(1, 'CREATE', 'LIST', list_number, `Created list ${list_number} for campaign ${campaign_id} in ${finalCiudad}`);
    })();
    res.json({ success: true });
  } catch (err: any) {
    console.error("Error creating list:", err);
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/lists/:id', (req, res) => {
  const { id } = req.params;
  const { goal, photo_url, type, list_number, option_number, campaign_id, candidate_alias, candidate_nombre, ciudad } = req.body;
  try {
    const finalCiudad = ciudad ? ciudad.toString().toUpperCase().trim() : '';
    const finalAlias = candidate_alias ? candidate_alias.toString().toUpperCase().trim() : '';
    const finalNombre = candidate_nombre ? candidate_nombre.toString().toUpperCase().trim() : '';

    db.prepare(`
      UPDATE lists 
      SET goal = ?, photo_url = ?, type = ?, list_number = ?, option_number = ?, campaign_id = ?, candidate_alias = ?, candidate_nombre = ?, ciudad = ?
      WHERE id = ?
    `).run(
      goal || 1000, 
      photo_url || null, 
      type || 'INTENDENTE', 
      list_number || '', 
      option_number || null, 
      campaign_id || null, 
      finalAlias, 
      finalNombre, 
      finalCiudad,
      id
    );
    
    if (photo_url) {
      const list = db.prepare('SELECT candidate_ci FROM lists WHERE id = ?').get(id) as any;
      if (list) {
        db.prepare('UPDATE electors SET photo_url = ? WHERE ci = ?').run(photo_url, list.candidate_ci);
      }
    }
    
    logAction(1, 'UPDATE', 'LIST', id, `Updated list ${id} goals/photo`);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/campaigns/:id/lists', (req, res) => {
  const campaign_id = req.params.id;
  const lists = db.prepare(`
    SELECT l.*, e.nombre as candidate_nombre, e.apellido as candidate_apellido 
    FROM lists l 
    LEFT JOIN electors e ON l.candidate_ci = e.ci 
    WHERE campaign_id = ?
  `).all(campaign_id);
  res.json(lists);
});

// 🛡️ SECURITY AUDIT: TRACK LOGIN ATTEMPTS
app.get('/api/login-attempts', (req, res) => {
  const role = req.headers['x-user-role'];
  if (role !== 'SUPERUSUARIO') return res.status(403).json({ error: 'Acceso denegado' });

  try {
    const sec = getSecurityFilter(req, 'u');
    const attempts = db.prepare(`
      SELECT la.*, u.distrito as user_district
      FROM login_attempts la
      LEFT JOIN users u ON la.username = u.username
      WHERE 1=1 ${sec.sql.replace(/u\./g, 'u.')} -- Applies filter to the joined user
      ORDER BY la.timestamp DESC 
      LIMIT 100
    `).all(...sec.params);
    res.json(attempts);
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener logs de seguridad' });
  }
});

// Users Management


app.put('/api/captures/:id', (req, res) => {
  try {
    const { traffic_light, needs_transport, telefono } = req.body;
    db.prepare(`
      UPDATE elector_captures 
      SET traffic_light = ?, needs_transport = ?, telefono = ?
      WHERE id = ?
    `).run(traffic_light, needs_transport ? 1 : 0, telefono, req.params.id);
    
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Migrations for missing columns
try { db.prepare('ALTER TABLE voting_locations ADD COLUMN distrito TEXT DEFAULT ""').run(); } catch(e) {}
try { db.prepare('ALTER TABLE voting_locations ADD COLUMN ciudad TEXT DEFAULT ""').run(); } catch(e) {}
try { db.prepare('ALTER TABLE electors ADD COLUMN distrito TEXT DEFAULT ""').run(); } catch(e) {}
try { db.prepare('ALTER TABLE electors ADD COLUMN ciudad TEXT DEFAULT ""').run(); } catch(e) {}
try { db.prepare('ALTER TABLE campaigns ADD COLUMN distrito TEXT DEFAULT ""').run(); } catch(e) {}
try { db.prepare('ALTER TABLE lists ADD COLUMN distrito TEXT DEFAULT ""').run(); } catch(e) {}
try { db.prepare('ALTER TABLE lists ADD COLUMN ciudad TEXT DEFAULT ""').run(); } catch(e) {}
try { db.prepare('ALTER TABLE users ADD COLUMN ci TEXT').run(); } catch(e) {}
try { db.prepare('ALTER TABLE users ADD COLUMN needs_password_change INTEGER DEFAULT 1').run(); } catch(e) {}

console.log("DATABASE: Esquema verificado y columnas de distrito preparadas.");

// 🔄 DATA UNIFICATION: Force everything to UPPERCASE to avoid duplicates like "Pedro Juan Caballero" vs "PEDRO JUAN CABALLERO"
const safeRun = (sql: string, ...params: any[]) => {
  try { db.prepare(sql).run(...params); } catch (e: any) { console.error(`[UNIFIER FAIL] ${sql}: ${e.message}`); }
};

// Fix specific variations for CONCEPCION
const fixCon = (table: string, col: string) => {
  safeRun(`UPDATE ${table} SET ${col} = 'CONCEPCION' WHERE UPPER(TRIM(${col})) IN ('CONCEPCION', 'CONCEPCIÓN')`);
};

fixCon('campaigns', 'distrito');
fixCon('lists', 'ciudad');
fixCon('voting_locations', 'ciudad');
fixCon('voting_locations', 'distrito');
fixCon('electors', 'ciudad');
fixCon('electors', 'distrito');

safeRun("UPDATE campaigns SET name = UPPER(TRIM(name)), distrito = UPPER(TRIM(distrito))");
safeRun("UPDATE lists SET ciudad = UPPER(TRIM(ciudad)), distrito = UPPER(TRIM(distrito))");
safeRun("UPDATE voting_locations SET nombre = UPPER(TRIM(nombre)), ciudad = UPPER(TRIM(ciudad)), distrito = UPPER(TRIM(distrito))");

// Sync ciudad and distrito for electors to ensure filtering works regardless of which one is used
safeRun("UPDATE electors SET ciudad = distrito WHERE (ciudad IS NULL OR ciudad = '') AND (distrito IS NOT NULL AND distrito != '')");
safeRun("UPDATE electors SET distrito = ciudad WHERE (distrito IS NULL OR distrito = '') AND (ciudad IS NOT NULL AND ciudad != '')");
safeRun("UPDATE electors SET ciudad = UPPER(TRIM(ciudad)), distrito = UPPER(TRIM(distrito)), local_votacion = UPPER(TRIM(local_votacion))");

// Normalize users district as well
safeRun("UPDATE users SET distrito = UPPER(TRIM(distrito)) WHERE distrito IS NOT NULL AND distrito != ''");

console.log("DATABASE: Unificación de datos completada exitosamente.");

app.get('/api/locales', (req, res) => {
  const sec = getSecurityFilter(req, 'loc'); // Note: getSecurityFilter handles 'loc' as distrito
  const params = sec.params || [];
  try {
    const locales = db.prepare(`SELECT * FROM voting_locations loc WHERE 1=1 ${sec.sql}`).all(...params);
    res.json(locales);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/locales', (req, res) => {
  const { cod_local, nombre, lat, lng, icon, direccion, distrito, ciudad } = req.body;
  try {
    db.prepare(`
      INSERT INTO voting_locations (cod_local, nombre, lat, lng, icon, direccion, distrito, ciudad)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(cod_local, nombre, lat, lng, icon || 'Landmark', direccion || '', distrito || ciudad || '', ciudad || distrito || '');
    
    logAction(1, 'CREATE', 'LOCALE', cod_local, `Created locale ${nombre} (${cod_local})`);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/locales/:cod', (req, res) => {
  const { cod_local, nombre, lat, lng, icon, direccion, distrito, ciudad } = req.body;
  const { cod } = req.params;
  try {
    console.log(`[DB UPDATE LOCALE] Intentando actualizar local: ${cod} -> ${cod_local || cod}`, { nombre, lat, lng, distrito, ciudad });
    const result = db.prepare(`
      UPDATE voting_locations 
      SET cod_local = ?, nombre = ?, lat = ?, lng = ?, icon = ?, direccion = ?, distrito = ?, ciudad = ?
      WHERE cod_local = ?
    `).run(cod_local || cod, nombre, lat, lng, icon, direccion || '', distrito || ciudad || '', ciudad || distrito || '', cod);
    
    if (result.changes === 0) {
      console.warn(`[DB UPDATE LOCALE] No se encontró el local con código: ${cod}`);
      // Intentar una búsqueda con TRIM por si acaso
      const retry = db.prepare('UPDATE voting_locations SET nombre=? WHERE TRIM(cod_local)=TRIM(?)').run(nombre, cod);
      if (retry.changes === 0) {
        throw new Error(`No se encontró ningún local con el código ${cod} para actualizar.`);
      }
    }

    logAction(1, 'UPDATE', 'LOCALE', cod, `Updated locale ${nombre}`);
    res.json({ success: true });
  } catch (err: any) {
    console.error('[DB UPDATE LOCALE ERROR]', err.message);
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/locales/:cod', (req, res) => {
  try {
    db.prepare('DELETE FROM voting_locations WHERE cod_local = ?').run(req.params.cod);
    logAction(1, 'DELETE', 'LOCALE', req.params.cod, `Deleted locale ${req.params.cod}`);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Duplicated endpoint removed

app.get('/api/conflicts', (req, res) => {
  const sec = getSecurityFilter(req, 'l');
  const params = sec.params || [];
  
  try {
    const conflicts = db.prepare(`
      SELECT ec.*, e.nombre as elector_nombre, l.list_number
      FROM elector_captures ec
      JOIN electors e ON ec.elector_ci = e.ci
      JOIN lists l ON ec.list_id = l.id
      JOIN campaigns c ON l.campaign_id = c.id
      WHERE ec.elector_ci IN (
        SELECT elector_ci FROM elector_captures GROUP BY elector_ci HAVING COUNT(*) > 1
      ) ${sec.sql}
    `).all(...params);
    res.json(conflicts);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});


app.get('/api/activities', (req, res) => {
  const sec = getSecurityFilter(req, 'l');
  const params = sec.params || [];

  try {
    const activities = db.prepare(`
      SELECT ec.*, e.nombre as elector_nombre, u.username as coordinator_name, l.list_number
      FROM elector_captures ec
      JOIN electors e ON ec.elector_ci = e.ci
      JOIN users u ON ec.coordinator_id = u.id
      JOIN lists l ON ec.list_id = l.id
      JOIN campaigns c ON l.campaign_id = c.id
      WHERE 1=1 ${sec.sql}
      ORDER BY ec.timestamp DESC LIMIT 20
    `).all(...params);
    res.json(activities);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Vehicles route is defined later in the file

app.get('/api/captures', (req, res) => {
  const role = getRole(req);
  const local_id = (req.query.localId as string) || '';
  const list_id = getListId(req);
  const sec = getSecurityFilter(req, 'e');

  try {
    const params = [...(sec.params || [])];
    
    let listFilter = '';
    if (list_id && !isNaN(list_id)) {
      listFilter = `AND ec.list_id = ?`;
      params.push(list_id);
    }

    let localFilter = '';
    if (local_id && local_id !== 'undefined' && local_id !== 'null' && local_id !== '') {
      localFilter = `AND e.local_votacion = (SELECT nombre FROM voting_locations WHERE cod_local = ?)`;
      params.push(local_id);
    }

    const captures = db.prepare(`
      SELECT 
        ec.*, 
        e.nombre, e.apellido, e.local_votacion, 
        u.nombre as coordinator_name, u.role as coordinator_role, 
        p.nombre as padrino_name,
        l.list_number, l.campaign_id, c.name as campaign_name
      FROM elector_captures ec
      JOIN electors e ON ec.elector_ci = e.ci
      JOIN users u ON ec.coordinator_id = u.id
      LEFT JOIN users p ON u.parent_id = p.id
      LEFT JOIN lists l ON ec.list_id = l.id
      LEFT JOIN campaigns c ON l.campaign_id = c.id
      WHERE 1=1 ${sec.sql} ${listFilter} ${localFilter}
      ORDER BY ec.timestamp DESC LIMIT 1000
    `).all(...params);
    res.json(captures);
  } catch (err: any) {
    console.error('[CAPTURES ERROR]', err);
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/logistics/stats', (req, res) => {
  const list_id = getListId(req);
  try {
    const filterSql = list_id && !isNaN(list_id) ? 'AND ec.list_id = ?' : '';
    const filterParams = list_id && !isNaN(list_id) ? [list_id] : [];
    const district = getDistrict(req);

    const stats = db.prepare(`
      SELECT
        COUNT(*) as total_requests,
        SUM(CASE WHEN ec.assigned_vehicle_id IS NOT NULL THEN 1 ELSE 0 END) as assigned,
        SUM(CASE WHEN e.is_priority = 1 THEN 1 ELSE 0 END) as priority
      FROM elector_captures ec
      JOIN electors e ON ec.elector_ci = e.ci
      WHERE ec.needs_transport = 1 ${filterSql} ${district ? 'AND (UPPER(e.ciudad) = UPPER(?) OR UPPER(e.distrito) = UPPER(?))' : ''}
    `).get(...filterParams, ...(district ? [district, district] : [])) as any;

    const fleet = db.prepare(`
      SELECT
        COUNT(*) as total_vehicles,
        SUM(CASE WHEN status = 'AVAILABLE' THEN 1 ELSE 0 END) as available
      FROM vehicles
      WHERE 1=1
      ${list_id && !isNaN(list_id) ? ' AND assigned_list_id = ?' : ''}
      ${district ? ' AND (UPPER(distrito) = UPPER(?) OR UPPER(ciudad) = UPPER(?))' : ''}
    `).get(...filterParams, ...(district ? [district, district] : [])) as any;

    res.json({ ...stats, ...fleet });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/logistics/clusters', (req, res) => {
  const list_id = getListId(req);
  const filterSql = list_id && !isNaN(list_id) ? 'AND ec.list_id = ?' : '';
  const filterParams = list_id && !isNaN(list_id) ? [list_id] : [];
  try {
    const clusters = db.prepare(`
      SELECT
        COALESCE(NULLIF(e.barrio, ''), e.local_votacion, 'Sin Barrio') as barrio,
        COUNT(ec.id) as count,
        AVG(ec.lat) as lat,
        AVG(ec.lng) as lng
      FROM elector_captures ec
      JOIN electors e ON ec.elector_ci = e.ci
      WHERE ec.needs_transport = 1 AND ec.assigned_vehicle_id IS NULL ${filterSql}
      GROUP BY COALESCE(NULLIF(e.barrio, ''), e.local_votacion, 'Sin Barrio')
    `).all(...filterParams);
    res.json(clusters);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/vehicles/:id/status', (req, res) => {
  const { id } = req.params;
  const { status } = req.body;
  try {
    db.prepare('UPDATE vehicles SET status = ? WHERE id = ?').run(status, id);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/logistics/pending', (req, res) => {
  const list_id = getListId(req);
  const filterSql = list_id && !isNaN(list_id) ? 'AND ec.list_id = ?' : '';
  const filterParams = list_id && !isNaN(list_id) ? [list_id] : [];
  try {
    const pending = db.prepare(`
      SELECT ec.*, e.nombre, e.apellido, e.local_votacion,
        COALESCE(NULLIF(e.barrio, ''), e.local_votacion, 'Sin Barrio') as barrio,
        e.is_priority
      FROM elector_captures ec
      JOIN electors e ON ec.elector_ci = e.ci
      WHERE ec.needs_transport = 1 AND ec.assigned_vehicle_id IS NULL ${filterSql}
      ORDER BY e.is_priority DESC, ec.timestamp ASC
    `).all(...filterParams);
    res.json(pending);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/logistics/assign', (req, res) => {
  const { capture_id, vehicle_id } = req.body;
  try {
    db.transaction(() => {
      db.prepare('UPDATE elector_captures SET assigned_vehicle_id = ? WHERE id = ?').run(vehicle_id, capture_id);
      db.prepare('UPDATE vehicles SET status = "IN_TRANSIT" WHERE id = ?').run(vehicle_id);
    })();
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/captures/:id', (req, res) => {
  try {
    const capture = db.prepare('SELECT elector_ci FROM elector_captures WHERE id = ?').get(req.params.id) as any;
    if (capture) {
      try {
        db.prepare("UPDATE electors SET status = 'Pendiente' WHERE ci = ?").run(capture.elector_ci);
      } catch (e) {
        // ignore legacy column error
      }
      db.prepare('DELETE FROM elector_captures WHERE id = ?').run(req.params.id);
    }
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/coordinators/:id/history', (req, res) => {
  try {
    const history = db.prepare(`
      SELECT c.*, e.nombre, e.apellido, e.local_votacion, e.mesa
      FROM elector_captures c
      JOIN electors e ON c.elector_ci = e.ci
      WHERE c.coordinator_id = ?
      ORDER BY c.timestamp DESC
    `).all(req.params.id);
    res.json(history);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/users', (req, res) => {
  const requesterRole = (req.headers['x-user-role'] as string || '').toUpperCase().trim();
  const requesterId   = req.headers['x-user-id'] as string;

  const { username, password, role: rawRole, assigned_list_id, list_id, assigned_campaign_id, campaign_id, nombre, photo_url, parent_id, telefono, ci } = req.body;
  const role = (rawRole || '').toUpperCase().trim();

  if (!username || !password || !role || !nombre) {
    return res.status(400).json({ error: 'Faltan campos obligatorios: Usuario, Contraseña, Rol y Nombre son requeridos.' });
  }

  // ── Authorization: who can create whom ──────────────────────────────────
  const ALLOWED_ROLES_TO_CREATE: Record<string, string[]> = {
    SUPERUSUARIO: ['SUPERUSUARIO','JEFE_CAMPANA','PADRINO','SUBJEFE','COORDINADOR','MIEMBRO_DE_MESA','CANDIDATO'],
    JEFE_CAMPANA: ['PADRINO','SUBJEFE','COORDINADOR','MIEMBRO_DE_MESA'],
    PADRINO:      ['SUBJEFE','COORDINADOR','MIEMBRO_DE_MESA'],
    SUBJEFE:      ['PADRINO','COORDINADOR','MIEMBRO_DE_MESA'],
  };
  const allowed = ALLOWED_ROLES_TO_CREATE[requesterRole] || [];
  if (!allowed.includes(role.toUpperCase())) {
    return res.status(403).json({ error: `Tu rol (${requesterRole}) no puede crear usuarios con el rol ${role}.` });
  }

  // JEFE_CAMPANA/PADRINO/SUBJEFE: force campaign_id to their own, prevent cross-tenant creation
  let forcedCampaignId: number | null = null;
  if (requesterRole !== 'SUPERUSUARIO' && requesterId) {
    const requesterInfo = getCachedUserInfo(requesterId);
    if (!requesterInfo?.campaign_id) {
      return res.status(403).json({ error: 'No tienes una campaña asignada. Contacta al administrador.' });
    }
    forcedCampaignId = requesterInfo.campaign_id;
    const bodyAssigned = assigned_campaign_id || campaign_id;
    if (bodyAssigned && parseInt(bodyAssigned) !== forcedCampaignId) {
      return res.status(403).json({ error: 'No puedes crear usuarios en otra campaña.' });
    }
  }
  // ─────────────────────────────────────────────────────────────────────────

  const rawCI = ci || username; // Fallback to username if CI is not provided explicitly
  const cleanCI = rawCI ? rawCI.toString().replace(/\./g, '') : null;
  const finalUsername = username.toString().trim();
  const finalPassword = password.toString().trim();

  try {
    if (cleanCI) {
      const existingUser = db.prepare('SELECT role FROM users WHERE ci = ? OR username = ?').get(cleanCI, finalUsername) as any;
      if (existingUser) {
        return res.status(400).json({ error: `Esta persona ya está registrada como ${existingUser.role}.` });
      }
    }

    const effectiveCampaignId = forcedCampaignId ?? (assigned_campaign_id || campaign_id || null);

    let distrito = req.body.distrito;
    if (!distrito && (effectiveCampaignId || assigned_list_id || list_id)) {
      const lstId = assigned_list_id || list_id;
      const origin = effectiveCampaignId
        ? db.prepare('SELECT distrito FROM campaigns WHERE id = ?').get(effectiveCampaignId)
        : db.prepare('SELECT ciudad as distrito FROM lists WHERE id = ?').get(lstId);
      distrito = (origin as any)?.distrito;
    }

    const result = db.prepare(`
      INSERT INTO users (username, password, role, assigned_list_id, assigned_campaign_id, assigned_local, assigned_mesa, nombre, photo_url, parent_id, telefono, ci, needs_password_change, distrito)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)
    `).run(
      finalUsername,
      finalPassword,
      role,
      assigned_list_id || list_id || null,
      effectiveCampaignId,
      req.body.assigned_local || null,
      req.body.assigned_mesa || null,
      nombre,
      photo_url || null,
      parent_id || null,
      telefono || null,
      cleanCI,
      distrito || null
    );
    
    logAction(1, 'CREATE', 'USER', Number(result.lastInsertRowid), `Created user ${finalUsername} with role ${role}`);
    res.json({ id: Number(result.lastInsertRowid), success: true });
  } catch (err: any) {
    console.error("Error creating user:", err);
    res.status(500).json({ error: err.message.includes('UNIQUE constraint failed') ? 'El nombre de usuario o C.I. ya existe.' : err.message });
  }
});

app.get('/api/users', (req, res) => {
  const sec = getSecurityFilter(req, 'u'); // Use 'u' for users table filter
  const params = sec.params || [];
  
  try {
    let query = `
      SELECT 
        u.*, 
        l.list_number, 
        l.type as list_type, 
        COALESCE(c.id, u.assigned_campaign_id) as effective_campaign_id,
        c.name as campaign_name,
        p.nombre as parent_name
      FROM users u
      LEFT JOIN lists l ON u.assigned_list_id = l.id
      LEFT JOIN campaigns c ON (l.campaign_id = c.id OR u.assigned_campaign_id = c.id)
      LEFT JOIN users p ON u.parent_id = p.id
      WHERE 1=1 ${sec.sql}
    `;
    
    let users;
    if (req.query.parent_id) {
      users = db.prepare(query + ' AND u.parent_id = ?').all(...params, req.query.parent_id);
    } else {
      users = db.prepare(query).all(...params);
    }
    
    console.log(`[ADMIN] Sirviendo ${users.length} usuarios.`);
    res.json(users);
  } catch (err: any) {
    console.error('[ADMIN ERROR] Fallo al listar usuarios:', err);
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/users/:id', (req, res) => {
  const userId = req.params.id;
  try {
    const userToDelete = db.prepare('SELECT username FROM users WHERE id = ?').get(userId) as any;
    if (userToDelete?.username === 'admin') {
      return res.status(403).json({ error: 'No se puede eliminar al administrador maestro (admin).' });
    }

    const user = db.prepare('SELECT id FROM users WHERE id = ?').get(userId);
    if (!user) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    const transaction = db.transaction(() => {
      db.prepare('PRAGMA foreign_keys = OFF').run();
      // 1. Nullify references in elector_captures to avoid breaking historical data
      db.prepare('UPDATE elector_captures SET coordinator_id = NULL WHERE coordinator_id = ?').run(userId);
      
      // 2. Nullify references in vehicles (formerly logistics)
      db.prepare('UPDATE vehicles SET assigned_user_id = NULL WHERE assigned_user_id = ?').run(userId);
      
      // 3. Nullify references in field_requests
      db.prepare('UPDATE field_requests SET coordinator_id = NULL WHERE coordinator_id = ?').run(userId);
      db.prepare('UPDATE field_requests SET resolved_by_id = NULL WHERE resolved_by_id = ?').run(userId);

      // 4. Nullify references in capture_conflicts and audit_logs
      db.prepare('UPDATE capture_conflicts SET resolved_by_jefe_id = NULL WHERE resolved_by_jefe_id = ?').run(userId);
      db.prepare('UPDATE capture_conflicts SET resolved_coordinator_id = NULL WHERE resolved_coordinator_id = ?').run(userId);
      db.prepare('UPDATE audit_logs SET user_id = NULL WHERE user_id = ?').run(userId);

      // 5. Nullify references in participation_logs
      db.prepare('UPDATE participation_logs SET veedor_id = NULL WHERE veedor_id = ?').run(userId);

      // 6. Nullify references in electors
      db.prepare('UPDATE electors SET coordinador_asignado = NULL WHERE coordinador_asignado = ?').run(userId);

      // 7. Nullify references in results (Veedores)
      db.prepare('UPDATE results SET veedor_id = NULL WHERE veedor_id = ?').run(userId);

      // 8. Update children users to have no parent (orphan them instead of deleting)
      db.prepare('UPDATE users SET parent_id = NULL WHERE parent_id = ?').run(userId);

      // 9. Finally delete the user
      db.prepare('DELETE FROM users WHERE id = ?').run(userId);
      db.prepare('PRAGMA foreign_keys = ON').run();

      logAction(1, 'DELETE', 'USER', userId, `Deleted user with ID ${userId} and cleaned up all references`);
    });

    transaction();
    res.json({ success: true });
  } catch (err: any) {
    console.error('[DELETE USER ERROR]:', err);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/users/change-p', (req, res) => {
  const { user_id, new_password } = req.body;
  console.log(`[AUTH] Updating password for user ID: ${user_id}`);
  try {
    db.prepare('UPDATE users SET password = ?, needs_password_change = 0 WHERE id = ?').run(new_password, user_id);
    logAction(user_id, 'UPDATE_PASSWORD', 'USER', user_id, 'User updated their password');
    res.json({ success: true });
  } catch (err: any) {
    console.error('[AUTH ERROR] Password update failed:', err);
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/users/:id', (req, res) => {
  const requesterRole = (req.headers['x-user-role'] as string || '').toUpperCase().trim();
  const requesterId   = req.headers['x-user-id'] as string;

  // JEFE_CAMPANA / PADRINO: only edit users within their own campaign
  if (requesterRole !== 'SUPERUSUARIO' && requesterId) {
    const requesterInfo = getCachedUserInfo(requesterId);
    const targetUser = db.prepare('SELECT assigned_campaign_id FROM users WHERE id = ?').get(req.params.id) as any;
    if (targetUser && requesterInfo?.campaign_id && targetUser.assigned_campaign_id !== requesterInfo.campaign_id) {
      return res.status(403).json({ error: 'No puedes editar usuarios de otra campaña.' });
    }
  }

  const { role, assigned_list_id, nombre, photo_url, parent_id, telefono, ci } = req.body;
  const cleanCI = ci ? ci.toString().replace(/\./g, '') : null;
  try {
    db.prepare(`
      UPDATE users 
      SET role = ?, assigned_list_id = ?, assigned_campaign_id = ?, assigned_local = ?, assigned_mesa = ?, nombre = ?, photo_url = ?, parent_id = ?, telefono = ?, ci = ?, distrito = COALESCE(?, distrito)
      WHERE id = ?
    `).run(
      role, 
      assigned_list_id || null, 
      req.body.assigned_campaign_id || null, 
      req.body.assigned_local || null, 
      req.body.assigned_mesa || null, 
      nombre, 
      photo_url, 
      parent_id || null, 
      telefono || null, 
      cleanCI, 
      req.body.distrito || null,
      req.params.id
    );
    clearUserCache(req.params.id); // invalidate cache after update
    logAction(1, 'UPDATE', 'USER', req.params.id, `Updated user ${nombre} (${role})`);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});


app.post('/api/admin/users/:id/reset-password', (req, res) => {
  try {
    const user = db.prepare('SELECT username FROM users WHERE id = ?').get(req.params.id) as any;
    if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });
    
    // Set password to username as default and flag for change
    db.prepare('UPDATE users SET password = ?, needs_password_change = 1 WHERE id = ?').run(user.username, req.params.id);
    
    logAction(1, 'RESET_PASSWORD', 'USER', req.params.id, `Password reset to default (username) for user ${user.username}`);
    res.json({ success: true, message: `Contraseña reseteada. El usuario debe ingresar con su nombre de usuario (${user.username}) y cambiarla.` });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/lists', (req, res) => {
  const sec = getSecurityFilter(req, 'l');
  const params = sec.params || [];

  try {
    const lists = db.prepare(`
      SELECT l.*, c.name as campaign_name, c.distrito as campaign_distrito
      FROM lists l 
      JOIN campaigns c ON l.campaign_id = c.id
      WHERE 1=1 ${sec.sql}
    `).all(...params);
    res.json(lists);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});


app.delete('/api/lists/:id', (req, res) => {
  try {
    db.prepare('DELETE FROM lists WHERE id = ?').run(req.params.id);
    logAction(1, 'DELETE', 'LIST', req.params.id, `Deleted list with ID ${req.params.id}`);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/debug', (req, res) => {
  try {
    const electorsSchema = db.prepare('PRAGMA table_info(electors)').all();
    const campaignsSchema = db.prepare('PRAGMA table_info(campaigns)').all();
    const usersSchema = db.prepare('PRAGMA table_info(users)').all();
    
    res.json({
      role: getRole(req),
      district: getDistrict(req),
      userId: req.headers['x-user-id'],
      schemas: {
        electors: electorsSchema.map((c: any) => c.name),
        campaigns: campaignsSchema.map((c: any) => c.name),
        users: usersSchema.map((c: any) => c.name)
      }
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/health', (req, res) => {
  try {
    const users = db.prepare('SELECT COUNT(*) as count FROM users').get() as any;
    const campaigns = db.prepare('SELECT COUNT(*) as count FROM campaigns').get() as any;
    const electors = db.prepare('SELECT COUNT(*) as count FROM electors').get() as any;
    const lists = db.prepare('SELECT COUNT(*) as count FROM lists').get() as any;
    
    res.json({
      status: 'ok',
      database: {
        users: users.count,
        campaigns: campaigns.count,
        electors: electors.count,
        lists: lists.count
      },
      time: new Date().toISOString()
    });
  } catch (err: any) {
    res.status(500).json({ status: 'error', error: err.message });
  }
});

app.get('/api/stats/summary', (req, res) => {
  const sec = getSecurityFilter(req, 'ec');
  const params = sec.params || [];
  
  try {
    console.log('[STATS] Fetching usersCount...');
    const usersCount = db.prepare(`SELECT COUNT(*) as count FROM users u WHERE 1=1 ${getSecurityFilter(req, 'u').sql}`).get(...getSecurityFilter(req, 'u').params) as any;
    console.log('[STATS] Fetching campaignsCount...');
    const campaignsCount = db.prepare(`SELECT COUNT(*) as count FROM campaigns c WHERE 1=1 ${getSecurityFilter(req, 'c').sql}`).get(...getSecurityFilter(req, 'c').params) as any;
    console.log('[STATS] Fetching listsCount...');
    const listsCount = db.prepare(`SELECT COUNT(*) as count FROM lists l WHERE 1=1 ${getSecurityFilter(req, 'l').sql}`).get(...getSecurityFilter(req, 'l').params) as any;
    console.log('[STATS] Fetching electorsCount...');
    const electorsCount = db.prepare(`SELECT COUNT(*) as count FROM electors e WHERE 1=1 ${getSecurityFilter(req, 'e').sql}`).get(...getSecurityFilter(req, 'e').params) as any;
    
    console.log('[STATS] Fetching capturesCount...');
    const capturesCount = db.prepare(`SELECT COUNT(*) as count FROM elector_captures ec JOIN electors e ON ec.elector_ci = e.ci WHERE 1=1 ${sec.sql}`).get(...params) as any;
    console.log('[STATS] Fetching transport...');
    const transportNeeded = db.prepare(`SELECT COUNT(*) as count FROM elector_captures ec JOIN electors e ON ec.elector_ci = e.ci WHERE ec.needs_transport = 1 ${sec.sql}`).get(...params) as any;
    const transportAssigned = db.prepare(`SELECT COUNT(*) as count FROM elector_captures ec JOIN electors e ON ec.elector_ci = e.ci WHERE ec.needs_transport = 1 AND ec.assigned_vehicle_id IS NOT NULL ${sec.sql}`).get(...params) as any;

    console.log('[STATS] Fetching traffic lights...');
    const greenCount = db.prepare(`SELECT COUNT(*) as count FROM elector_captures ec JOIN electors e ON ec.elector_ci = e.ci WHERE ec.traffic_light = 'GREEN' ${sec.sql}`).get(...params) as any;
    const yellowCount = db.prepare(`SELECT COUNT(*) as count FROM elector_captures ec JOIN electors e ON ec.elector_ci = e.ci WHERE ec.traffic_light = 'YELLOW' ${sec.sql}`).get(...params) as any;
    const redCount = db.prepare(`SELECT COUNT(*) as count FROM elector_captures ec JOIN electors e ON ec.elector_ci = e.ci WHERE ec.traffic_light = 'RED' ${sec.sql}`).get(...params) as any;
    const purpleCount = db.prepare(`SELECT COUNT(*) as count FROM elector_captures ec JOIN electors e ON ec.elector_ci = e.ci WHERE ec.traffic_light = 'PURPLE' ${sec.sql}`).get(...params) as any;

    res.json({
      users: usersCount.count,
      campaigns: campaignsCount.count,
      lists: listsCount.count,
      electors: electorsCount.count,
      captures: capturesCount.count,
      transportNeeded: transportNeeded.count,
      transportAssigned: transportAssigned.count,
      green: greenCount.count,
      yellow: yellowCount.count,
      red: redCount.count,
      purple: purpleCount.count
    });
  } catch (err: any) {
    console.error('[STATS ERROR]', err);
    res.status(500).json({ error: err.message });
  }
});

// Audit Endpoints
app.get('/api/audit/logs', (req, res) => {
  const { action, user_id, start_date, end_date } = req.query;
  try {
      const sec = getSecurityFilter(req, 'u');
      let query = `
        SELECT a.*, u.username, u.distrito as user_district
        FROM audit_logs a
        LEFT JOIN users u ON a.user_id = u.id
        WHERE 1=1 ${sec.sql}
      `;
      const params: any[] = [...sec.params];

    if (action) {
      query += ` AND a.action = ?`;
      params.push(action);
    }
    if (user_id) {
      query += ` AND a.user_id = ?`;
      params.push(user_id);
    }
    if (start_date) {
      query += ` AND a.timestamp >= ?`;
      params.push(`${start_date} 00:00:00`);
    }
    if (end_date) {
      query += ` AND a.timestamp <= ?`;
      params.push(`${end_date} 23:59:59`);
    }

    query += ` ORDER BY a.timestamp DESC LIMIT 100`;
    
    const logs = db.prepare(query).all(...params);
    res.json(logs);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/audit/stats', (req, res) => {
  try {
    const totalActions = db.prepare('SELECT COUNT(*) as count FROM audit_logs').get() as any;
    const topUsers = db.prepare(`
      SELECT u.username, COUNT(a.id) as actions
      FROM audit_logs a
      JOIN users u ON a.user_id = u.id
      GROUP BY u.id
      ORDER BY actions DESC
      LIMIT 5
    `).all();
    const actionTypes = db.prepare(`
      SELECT action, COUNT(*) as count
      FROM audit_logs a
      GROUP BY action
    `).all();

    res.json({
      total: totalActions.count,
      topUsers,
      actionTypes
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// System Maintenance endpoints moved to the end of the file for better organization.

// Settings Management
app.get('/api/settings', (req, res) => {
  try {
    const settings = db.prepare('SELECT * FROM settings').all() as any[];
    const formatted = settings.reduce((acc, curr) => {
      acc[curr.key] = curr.value;
      return acc;
    }, {});
    res.json(formatted);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/stats/predictions', (req, res) => {
  try {
    const totalCaptures = db.prepare('SELECT COUNT(*) as count FROM elector_captures').get() as any;
    const lastHour = db.prepare("SELECT COUNT(*) as count FROM elector_captures WHERE timestamp >= datetime('now', '-1 hour')").get() as any;
    const prevHour = db.prepare("SELECT COUNT(*) as count FROM elector_captures WHERE timestamp >= datetime('now', '-2 hour') AND timestamp < datetime('now', '-1 hour')").get() as any;
    
    const velocity = lastHour.count || 0;
    const trend = velocity >= (prevHour.count || 0) ? 'up' : 'down';
    
    // Simple projection: current + (velocity * hours until close)
    const settings = db.prepare("SELECT value FROM settings WHERE key = 'election_end_time'").get() as any;
    const endTime = settings?.value || '17:00';
    const [hours, minutes] = endTime.split(':').map(Number);
    const now = new Date();
    const close = new Date();
    close.setHours(hours, minutes, 0, 0);
    
    const remainingHours = Math.max(0, (close.getTime() - now.getTime()) / (1000 * 60 * 60));
    const projectedTotal = Math.round((totalCaptures.count || 0) + (velocity * remainingHours));

    res.json({
      velocity,
      trend,
      projected_total: projectedTotal
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/audit/export', (req, res) => {
  try {
    const logs = db.prepare(`
      SELECT a.timestamp, u.username, a.action, a.details
      FROM audit_logs a
      LEFT JOIN users u ON a.user_id = u.id
      ORDER BY a.timestamp DESC
    `).all() as any[];
    
    let csv = '\uFEFFDate,User,Action,Details\n'; // Added BOM for Excel UTF-8 support
    logs.forEach(log => {
      csv += `"${log.timestamp}","${log.username || 'System'}","${log.action}","${log.details?.replace(/"/g, '""')}"\n`;
    });
    
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename=auditoria.csv');
    res.status(200).send(csv);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/settings', (req, res) => {
  const settings = req.body;
  try {
    const stmt = db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)');
    db.transaction(() => {
      for (const [key, value] of Object.entries(settings)) {
        stmt.run(key, value);
      }
      logAction(1, 'UPDATE', 'SETTINGS', null, 'Updated global settings');
    })();
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Vehicles Management
app.get('/api/vehicles', (req, res) => {
  try {
    const vehicles = db.prepare(`
      SELECT v.*, u.nombre as coordinator_name, l.list_number,
             (SELECT COUNT(*) FROM elector_captures WHERE assigned_vehicle_id = v.id AND transport_status = 'IN_TRANSIT') as current_passengers
      FROM vehicles v
      LEFT JOIN users u ON v.assigned_user_id = u.id
      LEFT JOIN lists l ON u.assigned_list_id = l.id
    `).all();
    res.json(vehicles);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/vehicles', (req, res) => {
  const { description, driver_name, driver_phone, assigned_user_id, driver_ci, capacity, status, type, plate } = req.body;
  try {
    const result = db.prepare(`
      INSERT INTO vehicles (description, driver_name, driver_phone, assigned_user_id, driver_ci, capacity, status, type, plate)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(description, driver_name, driver_phone, assigned_user_id || null, driver_ci, capacity || 4, status || 'AVAILABLE', type, plate);
    res.json({ id: Number(result.lastInsertRowid) });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/vehicles/:id', (req, res) => {
  try {
    db.prepare('DELETE FROM vehicles WHERE id = ?').run(req.params.id);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/logistics/assign', (req, res) => {
  const { capture_id, vehicle_id } = req.body;
  try {
    db.prepare("UPDATE elector_captures SET assigned_vehicle_id = ?, transport_status = 'IN_TRANSIT' WHERE id = ?").run(vehicle_id, capture_id);
    logAction(1, 'ASSIGN_TRANSPORT', 'CAPTURE', capture_id, `Assigned vehicle ${vehicle_id} to capture ${capture_id}`);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/logistics/complete-trip', (req, res) => {
  const { vehicle_id } = req.body;
  try {
    db.prepare("UPDATE elector_captures SET transport_status = 'COMPLETED' WHERE assigned_vehicle_id = ? AND transport_status = 'IN_TRANSIT'").run(vehicle_id);
    logAction(1, 'COMPLETE_TRIP', 'VEHICLE', vehicle_id, `Marked trip completed for vehicle ${vehicle_id}`);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/logistics/pending', (req, res) => {
  try {
    const pending = db.prepare(`
      SELECT ec.*, e.nombre, e.apellido, e.local_votacion, v.description as vehicle_desc
      FROM elector_captures ec
      JOIN electors e ON ec.elector_ci = e.ci
      LEFT JOIN vehicles v ON ec.assigned_vehicle_id = v.id
      WHERE ec.needs_transport = 1 AND ec.transport_status != 'COMPLETED'
    `).all();
    res.json(pending);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Strategic Command Center Endpoints
app.get('/api/admin/conflicts', (req, res) => {
  const district = req.query.district as string;
  const list_id = getListId(req);
  
  try {
    let sql = `
      SELECT 
        cc.id as conflict_id,
        cc.status as conflict_status,
        cc.conflict_type,
        cc.jefe_decision_id,
        cc.consent_a,
        cc.consent_b,
        cc.list_id_a,
        cc.list_id_b,
        e.ci as elector_ci,
        e.nombre as elector_nombre,
        e.apellido as elector_apellido,
        
        -- Capture A
        ca.id as capture_a_id,
        ca.traffic_light as tl_a,
        ca.needs_transport as transport_a,
        ca.timestamp as time_a,
        ca.lat as lat_a,
        ca.lng as lng_a,
        ua.nombre as coord_a,
        ua.photo_url as photo_a,
        pa.nombre as padrino_a,
        la.list_number as list_a,
        la.option_number as option_a,
        
        -- Capture B
        cb.id as capture_b_id,
        cb.traffic_light as tl_b,
        cb.needs_transport as transport_b,
        cb.timestamp as time_b,
        cb.lat as lat_b,
        cb.lng as lng_b,
        ub.nombre as coord_b,
        ub.photo_url as photo_b,
        pb.nombre as padrino_b,
        lb.list_number as list_b,
        lb.option_number as option_b

      FROM capture_conflicts cc
      LEFT JOIN electors e ON cc.elector_ci = e.ci
      LEFT JOIN elector_captures ca ON cc.capture_id = ca.id
      LEFT JOIN elector_captures cb ON cc.capture_id_b = cb.id
      LEFT JOIN users ua ON ca.coordinator_id = ua.id
      LEFT JOIN users ub ON cb.coordinator_id = ub.id
      LEFT JOIN users pa ON ua.parent_id = pa.id
      LEFT JOIN users pb ON ub.parent_id = pb.id
      LEFT JOIN lists la ON ca.list_id = la.id
      LEFT JOIN lists lb ON cb.list_id = lb.id
      WHERE cc.status != 'RESOLVED'
    `;
    const params: any[] = [];

    const sec = getSecurityFilter(req, 'e');
    sql += ` ${sec.sql}`;
    params.push(...sec.params);

    if (list_id && !isNaN(list_id) && list_id !== 0) {
      sql += " AND (cc.list_id_a = ? OR cc.list_id_b = ?)";
      params.push(list_id, list_id);
    }

    const conflicts = db.prepare(sql).all(...params);
    console.log(`[DB] Fetched ${conflicts.length} conflicts.`);
    if (conflicts.length > 0) {
      console.log(`[DB] Sample Conflict: ID=${conflicts[0].conflict_id}, coord_a=${conflicts[0].coord_a}, coord_b=${conflicts[0].coord_b}, capture_b_id=${conflicts[0].capture_b_id}`);
    }
    res.json(conflicts);
  } catch (err: any) {
    console.error('[CONFLICTS ERROR]', err);
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/admin/conflicts/history', (req, res) => {
  const district = req.query.district as string;
  const list_id = getListId(req);
  
  try {
    let sql = `
      SELECT 
        cc.id as conflict_id,
        cc.status as conflict_status,
        cc.resolved_at,
        e.ci as elector_ci,
        e.nombre as elector_nombre,
        e.apellido as elector_apellido,
        e.local_votacion,
        e.mesa,
        
        u_win.nombre as winner_name,
        u_win.role as winner_role
      FROM capture_conflicts cc
      JOIN electors e ON cc.elector_ci = e.ci
      LEFT JOIN elector_captures ec_win ON (cc.winner_capture_id = ec_win.id OR cc.jefe_decision_id = ec_win.id)
      LEFT JOIN users u_win ON ec_win.coordinator_id = u_win.id
      WHERE cc.status = 'RESOLVED'
    `;
    const params: any[] = [];

    if (district && district !== 'null' && district !== 'undefined') {
      sql += " AND (UPPER(TRIM(e.distrito)) LIKE UPPER(TRIM(?)) OR UPPER(TRIM(e.ciudad)) LIKE UPPER(TRIM(?)))";
      params.push(`%${district}%`, `%${district}%`);
    }
    if (list_id && !isNaN(list_id) && list_id !== 0) {
      sql += " AND (cc.list_id_a = ? OR cc.list_id_b = ?)";
      params.push(list_id, list_id);
    }

    sql += " ORDER BY cc.resolved_at DESC LIMIT 100";

    const history = db.prepare(sql).all(...params);
    res.json(history);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/admin/conflicts/decide', (req, res) => {
  const { conflict_id, winner_capture_id } = req.body;
  const user_id = parseInt(req.headers['x-user-id'] as string || '0');
  
  try {
    db.transaction(() => {
      const conflict = db.prepare('SELECT * FROM capture_conflicts WHERE id = ?').get(conflict_id) as any;
      if (!conflict) throw new Error('Conflicto no encontrado');

      // Update the Jefe's decision
      db.prepare('UPDATE capture_conflicts SET jefe_decision_id = ?, status = "WAITING_CONSENT" WHERE id = ?')
        .run(winner_capture_id, conflict_id);

      // AUTO-CONSENT Logic: If a list has NO SUBJEFE, the Jefe consents for it automatically.
      const lists = [conflict.list_id_a, conflict.list_id_b];
      lists.forEach((lid, idx) => {
          const hasSubjefe = db.prepare('SELECT 1 FROM users WHERE assigned_list_id = ? AND role = "SUBJEFE" LIMIT 1').get(lid);
          if (!hasSubjefe) {
              const col = (idx === 0) ? 'consent_a' : 'consent_b';
              db.prepare(`UPDATE capture_conflicts SET ${col} = 1 WHERE id = ?`).run(conflict_id);
          }
      });

      checkAndFinalizeConflict(conflict_id, user_id);
      logAction(user_id, 'DECIDE_CONFLICT', 'CONFLICT', conflict_id, `Jefe decided conflict ${conflict_id} in favor of ${winner_capture_id}`);
    })();
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/admin/conflicts/consent', (req, res) => {
    const { conflict_id } = req.body;
    const user_id = req.headers['x-user-id'] as string;
    const user = getCachedUserInfo(user_id);

    if (!user || user.role !== 'SUBJEFE') return res.status(403).json({ error: 'Solo los líderes de lista pueden dar consentimiento.' });

    try {
        db.transaction(() => {
            const conflict = db.prepare('SELECT * FROM capture_conflicts WHERE id = ?').get(conflict_id) as any;
            if (!conflict) throw new Error('Conflicto no encontrado');

            if (conflict.list_id_a === user.assigned_list_id) {
                db.prepare('UPDATE capture_conflicts SET consent_a = 1 WHERE id = ?').run(conflict_id);
            } else if (conflict.list_id_b === user.assigned_list_id) {
                db.prepare('UPDATE capture_conflicts SET consent_b = 1 WHERE id = ?').run(conflict_id);
            } else {
                throw new Error('No perteneces a ninguna de las listas involucradas.');
            }

            checkAndFinalizeConflict(conflict_id, parseInt(user_id));
        })();
        res.json({ success: true });
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

const checkAndFinalizeConflict = (conflict_id: number, resolver_id: number) => {
    const cc = db.prepare('SELECT * FROM capture_conflicts WHERE id = ?').get(conflict_id) as any;
    if (cc.jefe_decision_id && cc.consent_a === 1 && cc.consent_b === 1) {
        // FINALIZE!
        const winnerId = cc.jefe_decision_id;
        const loserId = (cc.capture_id === winnerId) ? cc.capture_id_b : cc.capture_id;

        db.prepare('UPDATE elector_captures SET is_disputed = 0 WHERE id = ?').run(winnerId);
        db.prepare('UPDATE elector_captures SET is_disputed = 1 WHERE id = ?').run(loserId);
        db.prepare('UPDATE capture_conflicts SET status = "RESOLVED", resolved_by_jefe_id = ?, winner_capture_id = ?, resolved_at = CURRENT_TIMESTAMP WHERE id = ?')
            .run(resolver_id, winnerId, conflict_id);
        
        console.log(`[CONFLICT] Resolved and finalized conflict ${conflict_id}`);
    }
};

app.get('/api/admin/requests', (req, res) => {
  const sec = getSecurityFilter(req, 'u');
  try {
    const requests = db.prepare(`
      SELECT fr.*, u.nombre as coordinator_name, u.photo_url as coordinator_photo
      FROM field_requests fr
      JOIN users u ON fr.coordinator_id = u.id
      WHERE 1=1 ${sec.sql}
      ORDER BY fr.timestamp DESC
    `).all(...sec.params);
    res.json(requests);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/admin/requests/:id/resolve', (req, res) => {
  const { status, resolved_by_id } = req.body;
  try {
    db.prepare('UPDATE field_requests SET status = ? WHERE id = ?').run(status, req.params.id);
    logAction(resolved_by_id, 'RESOLVE_REQUEST', 'FIELD_REQUEST', req.params.id, `Status updated to ${status}`);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/admin/activity', (req, res) => {
  const sec = getSecurityFilter(req, 'u');
  try {
    const activities = db.prepare(`
      SELECT al.*, u.nombre as user_name, u.photo_url as user_photo
      FROM audit_logs al
      LEFT JOIN users u ON al.user_id = u.id
      WHERE 1=1 ${sec.sql}
      ORDER BY al.timestamp DESC LIMIT 50
    `).all(...sec.params);
    res.json(activities);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/admin/electors/search', (req, res) => {
  const { q } = req.query;
  const user_id = req.headers['x-user-id'];
  const role = getRole(req);

  try {
    let cityFilter = '';
    if (role !== 'SUPERUSUARIO' && user_id) {
      const user = db.prepare(`
        SELECT c.distrito 
        FROM users u 
        JOIN lists l ON u.assigned_list_id = l.id 
        JOIN campaigns c ON l.campaign_id = c.id 
        WHERE u.id = ?
      `).get(user_id) as any;
      
      if (user?.distrito) {
        cityFilter = `AND (e.distrito = '${user.distrito}' OR e.ciudad = '${user.distrito}')`;
      }
    }

    const electors = db.prepare(`
      SELECT e.*, ec.traffic_light, ec.id as capture_id, ec.telefono, ec.needs_transport, ec.lat, ec.lng, ec.coordinator_id, u.nombre as coordinator_name, u.role as coordinator_role
      FROM electors e
      LEFT JOIN elector_captures ec ON e.ci = ec.elector_ci AND ec.is_disputed = 0
      LEFT JOIN users u ON ec.coordinator_id = u.id
      WHERE (e.ci LIKE ? OR e.nombre LIKE ? OR e.apellido LIKE ?) ${cityFilter}
      LIMIT 50
    `).all(`%${q}%`, `%${q}%`, `%${q}%`);
    res.json(electors);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/admin/verify-phone/:phone', (req, res) => {
  try {
    const phone = req.params.phone.replace(/\D/g, '');
    const phoneWithCountry = phone.startsWith('595') ? phone : `595${phone.replace(/^0/, '')}`;
    const phoneShort = phone.replace(/^595/, '0');

    const elector = db.prepare(`
      SELECT e.*, ec.traffic_light, u.nombre as coordinator_name, u.role as coordinator_role
      FROM electors e
      JOIN elector_captures ec ON e.ci = ec.elector_ci
      LEFT JOIN users u ON ec.coordinator_id = u.id
      WHERE ec.telefono LIKE ? OR ec.telefono LIKE ?
      LIMIT 1
    `).get(`%${phoneWithCountry}%`, `%${phoneShort}%`) as any;

    if (elector) {
      return res.json({ type: 'ELECTOR', data: elector });
    }

    const user = db.prepare(`
      SELECT id, username, role, nombre, ci, telefono 
      FROM users 
      WHERE telefono LIKE ? OR telefono LIKE ?
      LIMIT 1
    `).get(`%${phoneWithCountry}%`, `%${phoneShort}%`) as any;

    if (user) {
      return res.json({ type: 'USER', data: user });
    }

    res.status(404).json({ error: 'Contacto no identificado' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/admin/import-padron', upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No se subió ningún archivo' });

  const requesterRole = (req.headers['x-user-role'] as string || '').toUpperCase().trim();
  const requesterId   = req.headers['x-user-id'] as string;

  if (!['SUPERUSUARIO','JEFE_CAMPANA'].includes(requesterRole)) {
    if (req.file) try { fs.unlinkSync(req.file.path); } catch {}
    return res.status(403).json({ error: 'Solo el Superusuario o Jefe de Campaña puede importar padrones.' });
  }

  const { distrito, ciudad } = req.body;
  const finalDistrito = distrito || ciudad;
  if (!finalDistrito) return res.status(400).json({ error: 'Debe especificar el distrito para este padrón' });

  // campaign_id: JEFE_CAMPANA forced to their own; SUPERUSUARIO can pass explicitly
  let effectiveCampaignId: number | null = parseInt(req.body.campaign_id) || null;
  if (requesterRole === 'JEFE_CAMPANA' && requesterId) {
    const info = getCachedUserInfo(requesterId);
    effectiveCampaignId = info?.campaign_id ?? null;
  }

  try {
    const workbook = XLSX.readFile(req.file.path);
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const data: any[] = XLSX.utils.sheet_to_json(sheet);

    if (data.length === 0) {
      return res.status(400).json({ error: 'El archivo está vacío o tiene un formato incorrecto' });
    }

    const insertStmt = db.prepare(`
      INSERT OR REPLACE INTO electors (ci, nombre, apellido, local_votacion, mesa, orden, distrito, ciudad, campaign_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const transaction = db.transaction((rows) => {
      for (const row of rows) {
        const normalizedRow: any = {};
        for (const key in row) {
          const cleanKey = key.toUpperCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim().replace(/\s+/g, "_").replace(/\./g, "");
          normalizedRow[cleanKey] = row[key];
        }

        const ci = normalizedRow['CEDULA'] || normalizedRow['CI'] || normalizedRow['DOCUMENTO'] || normalizedRow['NRO_CEDULA'] || normalizedRow['CEDULA_DE_IDENTIDAD'];
        const nombre = normalizedRow['NOMBRE'] || normalizedRow['NOMBRES'];
        const apellido = normalizedRow['APELLIDO'] || normalizedRow['APELLIDOS'];
        const local = normalizedRow['LOCAL'] || normalizedRow['LOCAL_VOTACION'] || normalizedRow['LOCAL_DE_VOTACION'] || normalizedRow['RECINTO'] || normalizedRow['COLEGIO'];
        const mesa = normalizedRow['MESA'] || normalizedRow['NRO_MESA'] || normalizedRow['NUMERO_MESA'] || 0;
        const orden = normalizedRow['ORD_MESA'] || normalizedRow['ORDEN'] || normalizedRow['ORDEN_MESA'] || normalizedRow['NRO_ORDEN'] || 0;

        if (ci && (nombre || apellido)) {
          insertStmt.run(ci.toString().trim(), nombre || '', apellido || '', local || 'DESCONOCIDO', mesa, orden, finalDistrito, finalDistrito, effectiveCampaignId);
        }
      }
    });

    transaction(data);
    fs.unlinkSync(req.file.path);

    const actorId = requesterId ? parseInt(requesterId) : 1;
    logAction(actorId, 'IMPORT', 'PADRON', null, `Importados ${data.length} electores para ${finalDistrito} (campaign_id: ${effectiveCampaignId ?? 'global'})`);
    res.json({ success: true, count: data.length, campaign_id: effectiveCampaignId });
  } catch (err: any) {
    if (req.file) try { fs.unlinkSync(req.file.path); } catch {}
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/admin/electors/stats', (req, res) => {
  try {
    const stats = db.prepare(`
      SELECT 
        UPPER(TRIM(COALESCE(NULLIF(ciudad, ''), NULLIF(distrito, ''), 'Sin Asignar'))) as ciudad, 
        COUNT(*) as count 
      FROM electors 
      GROUP BY 1
      ORDER BY 2 DESC
    `).all();
    res.json(stats);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

let _districtsCache: { data: string[], ts: number } | null = null;
const DISTRICTS_CACHE_TTL = 600_000; // 10 minutes

app.get('/api/districts/global', (req, res) => {
  const now = Date.now();
  if (_districtsCache && (now - _districtsCache.ts < DISTRICTS_CACHE_TTL)) {
    return res.json(_districtsCache.data);
  }

  try {
    const districts = db.prepare(`
      SELECT DISTINCT UPPER(TRIM(distrito)) as name FROM campaigns WHERE distrito IS NOT NULL AND distrito != ''
      UNION
      SELECT DISTINCT UPPER(TRIM(ciudad)) as name FROM lists WHERE ciudad IS NOT NULL AND ciudad != ''
      UNION
      SELECT DISTINCT UPPER(TRIM(distrito)) as name FROM voting_locations WHERE distrito IS NOT NULL AND distrito != ''
      UNION
      SELECT DISTINCT UPPER(TRIM(ciudad)) as name FROM electors WHERE ciudad IS NOT NULL AND ciudad != ''
      UNION
      SELECT DISTINCT UPPER(TRIM(distrito)) as name FROM electors WHERE distrito IS NOT NULL AND distrito != ''
    `).all() as any[];
    
    const data = districts.map((d: any) => d.name).sort();
    _districtsCache = { data, ts: now };
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/stats/command', (req, res) => {
  const list_id = getListId(req);
  const local_id = (req.query.localId as string) || '';
  const role = getRole(req);
  const isPadrino = role === 'PADRINO';
  const requesterId = req.headers['x-user-id'];
  const sec = getSecurityFilter(req, 'e');
  const secL = getSecurityFilter(req, 'l');
  const secLoc = getSecurityFilter(req, 'loc');
    
  // Dynamic goal: SUM(goal) from lists filtered by district/security
  const listsGoal = db.prepare(`SELECT SUM(goal) as total FROM lists l WHERE 1=1 ${secL.sql}`).get(...secL.params) as any;
  const dbGoalSetting = db.prepare("SELECT value FROM settings WHERE key = 'goal'").get() as any;
  const globalGoal = Math.max(1, parseInt(listsGoal?.total || '0') || parseInt(dbGoalSetting?.value || '1000'));
  console.time(`STATS_COMMAND_${requesterId}`);
  try {
    // --- Parameterized list filter (avoids = NULL bug and SQL injection) ---
    let listFilterSql = '';
    const listFilterParams: any[] = [];
    if (list_id && !isNaN(list_id) && role !== 'JEFE_CAMPANA') {
      listFilterSql = 'AND ec.list_id = ?';
      listFilterParams.push(list_id);
    }

    // --- Parameterized local filter (fixed: uses local_votacion, not cod_local) ---
    let localFilterSql = '';
    const localFilterParams: any[] = [];
    if (local_id && local_id !== 'null' && local_id !== 'undefined') {
      // local_id is cod_local; resolve to nombre used in electors.local_votacion
      localFilterSql = 'AND e.local_votacion = (SELECT nombre FROM voting_locations WHERE cod_local = ?)';
      localFilterParams.push(local_id);
    }

    // --- Parameterized hierarchy filter (avoids SQL injection from header) ---
    let hierarchyFilterSql = '';
    const hierarchyFilterParams: any[] = [];
    if (isPadrino) {
      const userId = parseInt(req.headers['x-user-id'] as string);
      if (!isNaN(userId)) {
        hierarchyFilterSql = 'AND (u.parent_id = ? OR u.id = ?)';
        hierarchyFilterParams.push(userId, userId);
      }
    } else if (role === 'COORDINADOR') {
      const userId = parseInt(req.headers['x-user-id'] as string);
      if (!isNaN(userId)) {
        hierarchyFilterSql = 'AND ec.coordinator_id = ?';
        hierarchyFilterParams.push(userId);
      }
    }

    // Combined params in order matching SQL placeholders
    const captureParams = [
      ...(sec.params || []),
      ...listFilterParams,
      ...localFilterParams,
      ...hierarchyFilterParams,
    ];

    // LEFT JOINs on lists/campaigns so captures without list_id are still counted
    const captureJoins = `
      FROM elector_captures ec
      JOIN electors e ON ec.elector_ci = e.ci
      LEFT JOIN users u ON ec.coordinator_id = u.id
      LEFT JOIN lists l ON ec.list_id = l.id
      LEFT JOIN campaigns c ON l.campaign_id = c.id
    `;
    const captureWhere = `
      WHERE ec.is_disputed = 0 ${sec.sql} ${listFilterSql} ${localFilterSql} ${hierarchyFilterSql}
    `;

    const stats = db.prepare(`
      SELECT traffic_light, COUNT(*) as count ${captureJoins} ${captureWhere} GROUP BY traffic_light
    `).all(...captureParams) as any[];

    const totalCaptures = db.prepare(`
      SELECT COUNT(*) as count ${captureJoins} ${captureWhere}
    `).get(...captureParams) as any;

    // Total electors (separate filter — no list/hierarchy filter needed)
    const secElectors = getSecurityFilter(req, 'e');
    const electorParams = [...(secElectors.params || []), ...localFilterParams];
    const totalElectors = db.prepare(`
      SELECT COUNT(*) as count FROM electors e
      WHERE 1=1 ${localFilterSql} ${secElectors.sql}
    `).get(...electorParams) as any;

    // Location stats
    const locationStatsQuery = `
      SELECT
        loc.cod_local,
        loc.nombre,
        COALESCE(e_counts.total, 0)  as total_electors,
        COALESCE(ec_counts.total, 0) as total_captures,
        COALESCE(ec_counts.green, 0) as green_captures
      FROM voting_locations loc
      LEFT JOIN (
        SELECT local_votacion, COUNT(*) as total
        FROM electors e WHERE 1=1 ${secElectors.sql}
        GROUP BY local_votacion
      ) e_counts ON loc.nombre = e_counts.local_votacion
      LEFT JOIN (
        SELECT e.local_votacion,
          COUNT(ec.id) as total,
          SUM(CASE WHEN ec.traffic_light = 'GREEN' THEN 1 ELSE 0 END) as green
        FROM elector_captures ec
        JOIN electors e ON ec.elector_ci = e.ci
        LEFT JOIN users u ON ec.coordinator_id = u.id
        LEFT JOIN lists l ON ec.list_id = l.id
        LEFT JOIN campaigns c ON l.campaign_id = c.id
        WHERE ec.is_disputed = 0 ${sec.sql} ${listFilterSql} ${hierarchyFilterSql}
        GROUP BY e.local_votacion
      ) ec_counts ON loc.nombre = ec_counts.local_votacion
      WHERE 1=1 ${secLoc.sql}
    `;
    const locParams = [
      ...(secElectors.params || []),
      ...(sec.params || []),
      ...listFilterParams,
      ...hierarchyFilterParams,
      ...(secLoc.params || []),
    ];
    const locationStats = db.prepare(locationStatsQuery).all(...locParams) as any[];

    const transportNeeded = db.prepare(`
      SELECT COUNT(*) as count ${captureJoins} ${captureWhere} AND ec.needs_transport = 1
    `).get(...captureParams) as any;

    const totalCap = totalCaptures?.count || 0;
    const totalEl  = totalElectors?.count  || 0;
    res.json({
      green:   stats.find(s => s.traffic_light === 'GREEN')?.count  || 0,
      yellow:  stats.find(s => s.traffic_light === 'YELLOW')?.count || 0,
      red:     stats.find(s => s.traffic_light === 'RED')?.count    || 0,
      purple:  stats.find(s => s.traffic_light === 'PURPLE')?.count || 0,
      transport_needed: transportNeeded?.count || 0,
      total_captures: totalCap,
      total_electors: totalEl,
      percentage: totalEl > 0 ? ((totalCap / totalEl) * 100).toFixed(1) : '0',
      locations: locationStats.map(loc => ({
        ...loc,
        percentage: loc.total_electors > 0
          ? ((loc.total_captures / loc.total_electors) * 100).toFixed(1)
          : '0',
      })),
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  } finally {
    console.timeEnd(`STATS_COMMAND_${requesterId}`);
  }
});


app.get('/api/padrino/team-stats', (req, res) => {
  const padrino_id = req.query.padrino_id;
  const role = getRole(req);
  const sec = getSecurityFilter(req, 'u');

  try {
    let whereClause = "u.role = 'COORDINADOR'";
    let params: any[] = [];

    if (padrino_id) {
      whereClause += " AND u.parent_id = ?";
      params.push(padrino_id);
    }

    const stats = db.prepare(`
      SELECT 
        u.id, u.nombre, u.username, u.photo_url, u.telefono, u.distrito,
        COUNT(ec.id) as total_electors,
        COALESCE(SUM(CASE WHEN ec.traffic_light = 'GREEN' THEN 1 ELSE 0 END), 0) as green,
        COALESCE(SUM(CASE WHEN ec.traffic_light = 'YELLOW' THEN 1 ELSE 0 END), 0) as yellow,
        COALESCE(SUM(CASE WHEN ec.traffic_light = 'RED' THEN 1 ELSE 0 END), 0) as red,
        COALESCE(SUM(CASE WHEN ec.traffic_light = 'PURPLE' THEN 1 ELSE 0 END), 0) as purple,
        COALESCE(SUM(CASE WHEN ec.needs_transport = 1 THEN 1 ELSE 0 END), 0) as transport_needed
      FROM users u
      LEFT JOIN elector_captures ec ON u.id = ec.coordinator_id
      WHERE ${whereClause} ${sec.sql}
      GROUP BY u.id
    `).all(...params, ...sec.params);
    res.json(stats);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// New Structure Endpoints for Command Hierarchy
app.get('/api/structure/padrinos', (req, res) => {
  const sec = getSecurityFilter(req, 'u');
  const role = getRole(req);

  try {
    const padrinos = db.prepare(`
      SELECT u.id, u.nombre, u.photo_url, u.telefono, u.assigned_list_id,
             l.list_number, l.option_number,
             COUNT(DISTINCT u2.id) AS coordinator_count,
             COUNT(DISTINCT ec.id) AS total_electors,
             COUNT(DISTINCT CASE WHEN ec.traffic_light='GREEN'  THEN ec.id END) AS green_total,
             COUNT(DISTINCT CASE WHEN ec.traffic_light='YELLOW' THEN ec.id END) AS yellow_total,
             COUNT(DISTINCT CASE WHEN ec.traffic_light='RED'    THEN ec.id END) AS red_total,
             COUNT(DISTINCT CASE WHEN ec.traffic_light='PURPLE' THEN ec.id END) AS purple_total,
             COUNT(DISTINCT CASE WHEN ec.needs_transport=1      THEN ec.id END) AS transport_total
      FROM users u
      LEFT JOIN lists l           ON u.assigned_list_id = l.id
      LEFT JOIN users u2          ON u2.parent_id = u.id AND u2.role = 'COORDINADOR'
      LEFT JOIN elector_captures ec ON ec.coordinator_id = u2.id
      WHERE u.role IN ('PADRINO', 'SUBJEFE') ${sec.sql}
      GROUP BY u.id 
      ORDER BY u.nombre
    `).all(...sec.params);
    res.json(padrinos);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/structure/padrinos/:id/coordinators', (req, res) => {
  const { id } = req.params;
  try {
    const coordinators = db.prepare(`
      SELECT u.id, u.nombre, u.photo_url, u.telefono,
             COUNT(ec.id)                                           AS total_electors,
             COUNT(CASE WHEN ec.traffic_light='GREEN'  THEN 1 END) AS green,
             COUNT(CASE WHEN ec.traffic_light='YELLOW' THEN 1 END) AS yellow,
             COUNT(CASE WHEN ec.traffic_light='RED'    THEN 1 END) AS red,
             COUNT(CASE WHEN ec.traffic_light='PURPLE' THEN 1 END) AS purple,
             COUNT(CASE WHEN ec.needs_transport=1      THEN 1 END) AS transport_total
      FROM users u
      LEFT JOIN elector_captures ec ON ec.coordinator_id = u.id
      WHERE u.parent_id = ? AND u.role = 'COORDINADOR'
      GROUP BY u.id
      ORDER BY u.nombre
    `).all(id);

    const padrinoCaptures = db.prepare(`
      SELECT 
             COUNT(id)                                           AS total_electors,
             COUNT(CASE WHEN traffic_light='GREEN'  THEN 1 END) AS green,
             COUNT(CASE WHEN traffic_light='YELLOW' THEN 1 END) AS yellow,
             COUNT(CASE WHEN traffic_light='RED'    THEN 1 END) AS red,
             COUNT(CASE WHEN traffic_light='PURPLE' THEN 1 END) AS purple,
             COUNT(CASE WHEN needs_transport=1      THEN 1 END) AS transport_total
      FROM elector_captures
      WHERE coordinator_id = ?
    `).get(id);

    res.json({
      coordinators,
      padrino_captures: padrinoCaptures
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/structure/coordinators/:id/electors', (req, res) => {
  const { id } = req.params;
  try {
    const electors = db.prepare(`
      SELECT e.nombre, e.apellido, e.ci as elector_ci, e.local_votacion, e.mesa, e.orden,
      ec.traffic_light, ec.needs_transport, ec.telefono
      FROM elector_captures ec
      JOIN electors e ON ec.elector_ci = e.ci
      WHERE ec.coordinator_id = ?
    `).all(id);
    res.json(electors);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/structure/padrinos/:id/full-report', (req, res) => {
  const { id } = req.params;
  try {
    const padrino = db.prepare(`
      SELECT u.nombre, l.list_number, l.option_number, u.distrito
      FROM users u
      LEFT JOIN lists l ON u.assigned_list_id = l.id
      WHERE u.id = ?
    `).get(id) as any;

    if (!padrino) return res.status(404).json({ error: 'Padrino no encontrado' });

    const coordinators = db.prepare(`
      SELECT u.id, u.nombre, u.telefono,
      (SELECT COUNT(*) FROM elector_captures ec WHERE ec.coordinator_id = u.id) as total_electors,
      (SELECT COUNT(*) FROM elector_captures ec WHERE ec.coordinator_id = u.id AND ec.traffic_light = 'GREEN') as green,
      (SELECT COUNT(*) FROM elector_captures ec WHERE ec.coordinator_id = u.id AND ec.traffic_light = 'YELLOW') as yellow,
      (SELECT COUNT(*) FROM elector_captures ec WHERE ec.coordinator_id = u.id AND ec.traffic_light = 'RED') as red,
      (SELECT COUNT(*) FROM elector_captures ec WHERE ec.coordinator_id = u.id AND ec.traffic_light = 'PURPLE') as purple,
      (SELECT COUNT(*) FROM elector_captures ec WHERE ec.coordinator_id = u.id AND ec.needs_transport = 1) as transport_needed
      FROM users u
      WHERE u.parent_id = ? AND u.role = 'COORDINADOR'
    `).all(id) as any[];

    const fullHierarchy = coordinators.map(c => {
      const electors = db.prepare(`
        SELECT e.nombre, e.apellido, e.ci as elector_ci, e.local_votacion, e.mesa, e.orden,
        ec.traffic_light, ec.needs_transport, ec.telefono
        FROM elector_captures ec
        JOIN electors e ON ec.elector_ci = e.ci
        WHERE ec.coordinator_id = ?
      `).all(c.id);
      return { ...c, electors };
    });

    res.json({
      padrino,
      coordinators: fullHierarchy,
      timestamp: new Date().toISOString()
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/coordinator/:id/captures', (req, res) => {
  const { id } = req.params;
  try {
    const captures = db.prepare(`
      SELECT ec.*, e.nombre, e.apellido, e.local_votacion, e.mesa, e.orden
      FROM elector_captures ec
      JOIN electors e ON ec.elector_ci = e.ci
      WHERE ec.coordinator_id = ?
      ORDER BY ec.timestamp DESC
    `).all(id);
    res.json(captures);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/admin/requests', (req, res) => {
  const sec = getSecurityFilter(req, 'u');

  try {
    const query = `
      SELECT 
        r.*, 
        u.nombre as coordinator_name, 
        u.username as coordinator_username,
        u.telefono as coordinator_phone,
        p.nombre as padrino_name
      FROM field_requests r
      JOIN users u ON r.coordinator_id = u.id
      LEFT JOIN users p ON u.parent_id = p.id
      WHERE 1=1 ${sec.sql}
      ORDER BY r.timestamp DESC
    `;
    const requests = db.prepare(query).all(...sec.params);
    res.json(requests);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/admin/requests/:id/resolve', (req, res) => {
  const { id } = req.params;
  const { status, resolved_by_id } = req.body;
  try {
    db.prepare(`
      UPDATE field_requests 
      SET status = ?, resolved_at = CURRENT_TIMESTAMP, resolved_by_id = ?
      WHERE id = ?
    `).run(status, resolved_by_id, id);
    
    logAction(resolved_by_id, 'RESOLVE_REQUEST', 'FIELD_REQUEST', id, `Request ${id} marked as ${status}`);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/coordinator/request', upload.fields([{ name: 'photo', maxCount: 1 }, { name: 'audio', maxCount: 1 }]), (req, res) => {
  const { coordinator_id, type, description, priority, list_id } = req.body;
  const files = req.files as { [fieldname: string]: Express.Multer.File[] };
  
  try {
    const protocol = req.headers['x-forwarded-proto'] || req.protocol;
    const host = req.get('host');
    const baseUrl = process.env.APP_URL ? process.env.APP_URL.replace(/\/$/, '') : `${protocol}://${host}`;
    const photoUrl = files?.photo ? `${baseUrl}/uploads/${files.photo[0].filename}` : null;
    const audioUrl = files?.audio ? `${baseUrl}/uploads/${files.audio[0].filename}` : null;

    const result = db.prepare(`
      INSERT INTO field_requests (coordinator_id, type, description, priority, list_id, photo_url, audio_url)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      coordinator_id, 
      type, 
      description, 
      priority || 'NORMAL', 
      list_id || null,
      photoUrl,
      audioUrl
    );
    
    logAction(coordinator_id, 'CREATE_REQUEST', 'FIELD_REQUEST', Number(result.lastInsertRowid), `New ${type} request with multimedia`);
    res.json({ success: true, id: Number(result.lastInsertRowid) });
  } catch (err: any) {
    console.error("Error creating request:", err);
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/admin/activity', (req, res) => {
  const sec = getSecurityFilter(req, 'u');

  try {
    const query = `
      SELECT 'CAPTURE' as type, ec.timestamp, u.nombre as user_name, e.nombre || ' ' || e.apellido as entity_name, 'Nueva Captura' as detail
      FROM elector_captures ec
      JOIN electors e ON ec.elector_ci = e.ci
      JOIN users u ON ec.coordinator_id = u.id
      WHERE 1=1 ${sec.sql}
      
      UNION ALL
      
      SELECT 'REQUEST' as type, r.timestamp, u.nombre as user_name, r.type as entity_name, r.description as detail
      FROM field_requests r
      JOIN users u ON r.coordinator_id = u.id
      WHERE 1=1 ${sec.sql}
      
      UNION ALL
      
      SELECT 'CONFLICT' as type, cc.timestamp, 'Sistema' as user_name, e.nombre || ' ' || e.apellido as entity_name, 'Doble Captura' as detail
      FROM capture_conflicts cc
      JOIN electors e ON cc.elector_ci = e.ci
      JOIN elector_captures ec ON cc.capture_id = ec.id
      JOIN users u ON ec.coordinator_id = u.id
      WHERE 1=1 ${sec.sql}
      
      ORDER BY timestamp DESC
      LIMIT 20
    `;
    const activity = db.prepare(query).all(...sec.params, ...sec.params, ...sec.params);
    res.json(activity);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ── MY TEAM — JEFE_CAMPANA / PADRINO self-service team management ────────────

// GET /api/my-team — full hierarchy for the logged-in user's campaign
app.get('/api/my-team', requireRole('SUPERUSUARIO','JEFE_CAMPANA','PADRINO','SUBJEFE'), (req, res) => {
  const requesterId = req.headers['x-user-id'] as string;
  const role = getRole(req);

  try {
    const info = getCachedUserInfo(requesterId);
    
    // PADRINO: only sees their own coordinadores
    if (role === 'PADRINO') {
      const coordinators = db.prepare(`
        SELECT u.id, u.nombre, u.username, u.ci, u.telefono, u.photo_url, u.status,
               COUNT(ec.id) AS total_captures,
               SUM(CASE WHEN ec.traffic_light='GREEN'  THEN 1 ELSE 0 END) AS green,
               SUM(CASE WHEN ec.traffic_light='YELLOW' THEN 1 ELSE 0 END) AS yellow,
               SUM(CASE WHEN ec.traffic_light='RED'    THEN 1 ELSE 0 END) AS red
        FROM users u
        LEFT JOIN elector_captures ec ON ec.coordinator_id = u.id
        WHERE u.parent_id = ? AND u.role IN ('COORDINADOR','MIEMBRO_DE_MESA')
        GROUP BY u.id ORDER BY u.nombre
      `).all(requesterId);
      return res.json({ role: 'PADRINO', padrinos: [], coordinators });
    }

    // JEFE_CAMPANA / SUPERUSUARIO: full tree
    const filter = getSecurityFilter(req, 'u');
    const padrinos = db.prepare(`
      SELECT u.id, u.nombre, u.username, u.ci, u.telefono, u.photo_url, u.status,
             u.assigned_list_id, l.list_number, l.candidate_alias,
             COUNT(DISTINCT u2.id) AS coordinator_count,
             COUNT(DISTINCT ec.id) AS total_captures,
             SUM(CASE WHEN ec.needs_transport=1 THEN 1 ELSE 0 END) AS needs_transport
      FROM users u
      LEFT JOIN lists l ON u.assigned_list_id = l.id
      LEFT JOIN users u2 ON u2.parent_id = u.id AND u2.role = 'COORDINADOR'
      LEFT JOIN elector_captures ec ON ec.coordinator_id = u2.id
      WHERE u.role = 'PADRINO' ${filter.sql}
      GROUP BY u.id ORDER BY u.nombre
    `).all(...filter.params);

    res.json({ role, padrinos, coordinators: [] });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/my-team/padrino/:id/coordinators
app.get('/api/my-team/padrino/:id/coordinators', requireRole('SUPERUSUARIO','JEFE_CAMPANA','PADRINO','SUBJEFE'), (req, res) => {
  const requesterId = req.headers['x-user-id'] as string;
  const role = getRole(req);
  const padrinoId = req.params.id;

  // PADRINO can only view their own coordinators
  if (role === 'PADRINO' && padrinoId !== requesterId) {
    return res.status(403).json({ error: 'Solo puedes ver tu propio equipo.' });
  }

  try {
    const coordinators = db.prepare(`
      SELECT u.id, u.nombre, u.username, u.ci, u.telefono, u.photo_url, u.status,
             COUNT(ec.id) AS total_captures,
             SUM(CASE WHEN ec.traffic_light='GREEN'  THEN 1 ELSE 0 END) AS green,
             SUM(CASE WHEN ec.traffic_light='YELLOW' THEN 1 ELSE 0 END) AS yellow,
             SUM(CASE WHEN ec.traffic_light='RED'    THEN 1 ELSE 0 END) AS red,
             SUM(CASE WHEN ec.needs_transport=1      THEN 1 ELSE 0 END) AS transport_total
      FROM users u
      LEFT JOIN elector_captures ec ON ec.coordinator_id = u.id
      WHERE u.parent_id = ? AND u.role IN ('COORDINADOR','MIEMBRO_DE_MESA')
      GROUP BY u.id ORDER BY u.nombre
    `).all(padrinoId);
    res.json(coordinators);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/campaigns/mine — campaigns the logged-in JEFE_CAMPANA owns
app.get('/api/campaigns/mine', requireRole('SUPERUSUARIO','JEFE_CAMPANA'), (req, res) => {
  const requesterId = req.headers['x-user-id'] as string;
  const role = getRole(req);
  try {
    let campaigns;
    if (role === 'SUPERUSUARIO') {
      campaigns = db.prepare('SELECT * FROM campaigns ORDER BY name').all();
    } else {
      const info = getCachedUserInfo(requesterId);
      campaigns = info?.campaign_id
        ? db.prepare('SELECT * FROM campaigns WHERE id = ?').all(info.campaign_id)
        : [];
    }
    // Also return the lists for each campaign
    const result = (campaigns as any[]).map(c => ({
      ...c,
      lists: db.prepare('SELECT * FROM lists WHERE campaign_id = ?').all(c.id)
    }));
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────

// WhatsApp Endpoints
app.get('/api/whatsapp/terminals', async (req, res) => {
  res.json(await whatsappService.getTerminals());
});

app.post('/api/whatsapp/terminals', async (req, res) => {
  const { id, name } = req.body;
  await whatsappService.addTerminal(id, name);
  res.json({ success: true });
});

app.get('/api/whatsapp/status', (req, res) => {
  const terminalId = (req.query.terminalId as string) || 'default';
  res.json(whatsappService.getStatus(terminalId));
});

app.post('/api/whatsapp/connect', (req, res) => {
  const terminalId = (req.body.terminalId as string) || 'default';
  const status = whatsappService.getStatus(terminalId);
  if (!status) {
    return res.status(404).json({ error: `Terminal "${terminalId}" no encontrada. Créala primero.` });
  }
  if (status.status === 'CONNECTED') {
    return res.json({ success: true, status: 'CONNECTED', message: 'Ya conectada' });
  }
  if (status.status === 'CONNECTING') {
    return res.json({ success: true, status: 'CONNECTING', message: 'Ya iniciando conexión', qr: status.qr });
  }
  // Fire and forget — Puppeteer/Chromium takes 5-30s to generate QR
  whatsappService.connect(terminalId);
  res.json({ success: true, status: 'CONNECTING', message: 'Iniciando conexión WhatsApp...' });
});

app.post('/api/whatsapp/disconnect', (req, res) => {
  const terminalId = (req.body.terminalId as string) || 'default';
  whatsappService.disconnect(terminalId);
  res.json({ success: true });
});

app.get('/api/whatsapp/templates', (req, res) => {
  try {
    const templates = db.prepare('SELECT * FROM whatsapp_templates ORDER BY created_at DESC').all();
    res.json(templates);
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

app.post('/api/whatsapp/templates', (req, res) => {
  const { name, content, media_url, media_type, lat, lng, contact_name, contact_phone } = req.body;
  try {
    const result = db.prepare(`
      INSERT INTO whatsapp_templates (name, content, media_url, media_type, lat, lng, contact_name, contact_phone)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(name, content, media_url, media_type, lat, lng, contact_name, contact_phone);
    res.json({ success: true, id: result.lastInsertRowid });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/whatsapp/templates/:id', (req, res) => {
  try {
    db.prepare('DELETE FROM whatsapp_templates WHERE id = ?').run(req.params.id);
    res.json({ success: true });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

app.get('/api/whatsapp/broadcast/logs', (req, res) => {
  try {
    const logs = db.prepare(`
      SELECT l.*, t.name as template_name 
      FROM whatsapp_broadcast_logs l
      JOIN whatsapp_templates t ON l.template_id = t.id
      ORDER BY l.timestamp DESC LIMIT 50
    `).all();
    res.json(logs);
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

app.post('/api/whatsapp/broadcast', async (req, res) => {
  const { template_id, target_list_id, target_role, traffic_light, terminalId: reqTerminalId } = req.body;
  const terminalId = reqTerminalId || 'default';
  const role = getRole(req);
  if (role !== 'SUPERUSUARIO' && role !== 'JEFE_CAMPANA') return res.status(403).json({ error: 'Prohibido' });

  try {
    const template = db.prepare('SELECT * FROM whatsapp_templates WHERE id = ?').get(template_id) as any;
    if (!template) return res.status(404).json({ error: 'Plantilla no encontrada' });

    // Identify targets
    let targets: any[] = [];
    if (target_role) {
      // Targets are users
      let query = 'SELECT telefono, nombre FROM users WHERE telefono IS NOT NULL AND telefono != ""';
      const params: any[] = [];
      if (target_role !== 'ALL') {
        query += ' AND role = ?';
        params.push(target_role);
      }
      if (target_list_id) {
        query += ' AND assigned_list_id = ?';
        params.push(target_list_id);
      }
      targets = db.prepare(query).all(...params);
    } else if (traffic_light) {
      // Targets are electors from captures - JOIN with electors to get names and voting data
      let query = `
        SELECT ec.telefono, e.nombre, ec.elector_ci, e.local_votacion, e.mesa, e.orden
        FROM elector_captures ec
        JOIN electors e ON ec.elector_ci = e.ci
        WHERE ec.telefono IS NOT NULL AND ec.telefono != ""
      `;
      const params: any[] = [];
      if (traffic_light !== 'ALL') {
        query += ' AND ec.traffic_light = ?';
        params.push(traffic_light);
      }
      if (target_list_id) {
        query += ' AND ec.list_id = ?';
        params.push(target_list_id);
      }
      targets = db.prepare(query).all(...params);
    }

    if (targets.length === 0) return res.status(400).json({ error: 'No se encontraron destinatarios con teléfono' });

    // Create log entry
    const logResult = db.prepare(`
      INSERT INTO whatsapp_broadcast_logs (template_id, target_count, status)
      VALUES (?, ?, 'RUNNING')
    `).run(template_id, targets.length);
    const logId = logResult.lastInsertRowid;

    // Start background process
    const runBroadcast = async () => {
      let successCount = 0;
      let failCount = 0;

      for (const target of targets) {
        try {
          // Anti-ban delay: 2-5 seconds
          await new Promise(r => setTimeout(r, 2000 + Math.random() * 3000));
          
          // Advanced Personalized content
          let personalizedContent = template.content || '';
          if (personalizedContent) {
            personalizedContent = personalizedContent
              .replace(/{{nombre}}/g, target.nombre || 'Amigo/a')
              .replace(/{{ci}}/g, target.elector_ci || '')
              .replace(/{{local}}/g, target.local_votacion || 'No especificado')
              .replace(/{{mesa}}/g, target.mesa?.toString() || '-')
              .replace(/{{orden}}/g, target.orden?.toString() || '-');
          }

          if (template.media_type === 'VOICE') {
            await whatsappService.sendVoice(terminalId, target.telefono, template.media_url);
          } else if (template.media_type === 'LOCATION') {
            await whatsappService.sendLocation(terminalId, target.telefono, template.lat, template.lng, personalizedContent);
          } else if (template.media_type === 'CONTACT') {
            await whatsappService.sendContact(terminalId, target.telefono, template.contact_name, template.contact_phone);
          } else if (template.media_url) {
            await whatsappService.sendMedia(terminalId, target.telefono, template.media_url, personalizedContent);
          } else {
            await whatsappService.sendMessage(terminalId, target.telefono, personalizedContent);
          }
          successCount++;
        } catch (err) {
          console.error(`Broadcast failed for ${target.telefono}:`, err);
          failCount++;
        }
        
        // Update progress every 5 messages
        if ((successCount + failCount) % 5 === 0) {
          db.prepare('UPDATE whatsapp_broadcast_logs SET success_count = ?, fail_count = ? WHERE id = ?')
            .run(successCount, failCount, logId);
        }
      }

      db.prepare('UPDATE whatsapp_broadcast_logs SET success_count = ?, fail_count = ?, status = "COMPLETED" WHERE id = ?')
        .run(successCount, failCount, logId);
    };

    runBroadcast(); // Non-blocking

    res.json({ success: true, log_id: logId, target_count: targets.length });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/whatsapp/direct-message', async (req, res) => {
  const { number, message, media_url, media_type, lat, lng, terminalId: reqTerminalId } = req.body;
  const terminalId = reqTerminalId || 'default';
  try {
    if (media_type === 'VOICE') {
      await whatsappService.sendVoice(terminalId, number, media_url);
    } else if (media_type === 'LOCATION') {
      await whatsappService.sendLocation(terminalId, number, lat, lng, message);
    } else if (media_url) {
      await whatsappService.sendMedia(terminalId, number, media_url, message);
    } else {
      await whatsappService.sendMessage(terminalId, number, message);
    }
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/whatsapp/messages', (req, res) => {
  try {
    const messages = db.prepare('SELECT * FROM whatsapp_messages ORDER BY timestamp ASC').all();
    res.json(messages);
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

app.get('/api/whatsapp/chats', (req, res) => {
  try {
    const chats = db.prepare(`
      SELECT
        m1.contact_number,
        COALESCE((SELECT m2.contact_name FROM whatsapp_messages m2 WHERE m2.contact_number = m1.contact_number AND m2.contact_name IS NOT NULL LIMIT 1), m1.contact_number) as contact_name,
        m1.body as last_message,
        m1.timestamp,
        m1.is_incoming,
        (SELECT COUNT(*) FROM whatsapp_messages WHERE contact_number = m1.contact_number AND is_incoming = 1) as unread_count
      FROM whatsapp_messages m1
      WHERE m1.id IN (SELECT MAX(id) FROM whatsapp_messages GROUP BY contact_number)
      ORDER BY m1.timestamp DESC
    `).all();
    res.json(chats);
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// WhatsApp Recipient Selection Endpoints
app.get('/api/whatsapp/recipients/coordinators', (req, res) => {
  const role = getRole(req);
  if (role !== 'SUPERUSUARIO' && role !== 'JEFE_CAMPANA') return res.status(403).json({ error: 'Prohibido' });
  try {
    const coordinators = db.prepare(`
      SELECT
        u.id, u.nombre, u.telefono, u.ci, u.distrito,
        u.assigned_list_id, l.list_number, l.candidate_alias, l.candidate_nombre, l.ciudad,
        COUNT(ec.id) as capture_count
      FROM users u
      LEFT JOIN lists l ON u.assigned_list_id = l.id
      LEFT JOIN elector_captures ec ON ec.coordinator_id = u.id
      WHERE u.role = 'COORDINADOR' AND u.status = 'ACTIVE'
      GROUP BY u.id
      ORDER BY u.nombre
    `).all();
    res.json(coordinators);
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

app.get('/api/whatsapp/recipients/padrinos', (req, res) => {
  const role = getRole(req);
  if (role !== 'SUPERUSUARIO' && role !== 'JEFE_CAMPANA') return res.status(403).json({ error: 'Prohibido' });
  try {
    const padrinos = db.prepare(`
      SELECT
        u.id, u.nombre, u.telefono, u.ci, u.distrito,
        u.assigned_list_id, l.list_number, l.candidate_alias, l.ciudad,
        COUNT(DISTINCT ch.id) as coordinator_count,
        COUNT(DISTINCT ec.id) as total_captures
      FROM users u
      LEFT JOIN lists l ON u.assigned_list_id = l.id
      LEFT JOIN users ch ON ch.parent_id = u.id AND ch.role = 'COORDINADOR'
      LEFT JOIN elector_captures ec ON ec.coordinator_id = ch.id
      WHERE u.role = 'PADRINO' AND u.status = 'ACTIVE'
      GROUP BY u.id
      ORDER BY u.nombre
    `).all();
    res.json(padrinos);
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

app.get('/api/whatsapp/recipients/padrinos/:id/team', (req, res) => {
  const role = getRole(req);
  if (role !== 'SUPERUSUARIO' && role !== 'JEFE_CAMPANA') return res.status(403).json({ error: 'Prohibido' });
  const padrinoId = parseInt(req.params.id);
  try {
    const coordinators = db.prepare(`
      SELECT u.id, u.nombre, u.telefono, u.ci, u.distrito,
        COUNT(ec.id) as capture_count
      FROM users u
      LEFT JOIN elector_captures ec ON ec.coordinator_id = u.id
      WHERE u.parent_id = ? AND u.role = 'COORDINADOR'
      GROUP BY u.id
      ORDER BY u.nombre
    `).all(padrinoId);

    const electorsRaw = db.prepare(`
      SELECT ec.id as capture_id, ec.elector_ci, ec.telefono, ec.traffic_light,
        e.nombre, e.apellido, e.local_votacion, e.mesa, e.orden,
        u.id as coordinator_id, u.nombre as coordinator_nombre
      FROM elector_captures ec
      JOIN electors e ON ec.elector_ci = e.ci
      JOIN users u ON ec.coordinator_id = u.id
      WHERE u.parent_id = ? AND ec.telefono IS NOT NULL AND ec.telefono != ''
      ORDER BY u.nombre, e.nombre
    `).all(padrinoId);

    res.json({ coordinators, electors: electorsRaw });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

app.get('/api/whatsapp/recipients/coordinator/:id/electors', (req, res) => {
  const role = getRole(req);
  if (role !== 'SUPERUSUARIO' && role !== 'JEFE_CAMPANA') return res.status(403).json({ error: 'Prohibido' });
  const coordId = parseInt(req.params.id);
  try {
    const electors = db.prepare(`
      SELECT ec.id as capture_id, ec.elector_ci, ec.telefono, ec.traffic_light,
        e.nombre, e.apellido, e.local_votacion, e.mesa, e.orden
      FROM elector_captures ec
      JOIN electors e ON ec.elector_ci = e.ci
      WHERE ec.coordinator_id = ? AND ec.telefono IS NOT NULL AND ec.telefono != ''
      ORDER BY e.nombre
    `).all(coordId);
    res.json(electors);
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

app.get('/api/whatsapp/recipients/search', (req, res) => {
  const role = getRole(req);
  if (role !== 'SUPERUSUARIO' && role !== 'JEFE_CAMPANA') return res.status(403).json({ error: 'Prohibido' });
  const q = `%${req.query.q || ''}%`;
  try {
    const users = db.prepare(`
      SELECT id, nombre, telefono, ci, role, distrito FROM users
      WHERE telefono IS NOT NULL AND telefono != '' AND status = 'ACTIVE'
        AND (nombre LIKE ? OR telefono LIKE ? OR ci LIKE ?)
      LIMIT 10
    `).all(q, q, q);

    const electors = db.prepare(`
      SELECT ec.elector_ci, ec.telefono, ec.traffic_light,
        e.nombre, e.apellido, e.local_votacion, e.mesa, e.orden
      FROM elector_captures ec
      JOIN electors e ON ec.elector_ci = e.ci
      WHERE ec.telefono IS NOT NULL AND ec.telefono != ''
        AND (e.nombre LIKE ? OR e.apellido LIKE ? OR ec.telefono LIKE ? OR ec.elector_ci LIKE ?)
      LIMIT 10
    `).all(q, q, q, q);

    res.json({ users, electors });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

app.get('/api/admin/disputes/global', (req, res) => {
  const role = getRole(req);
  if (role !== 'SUPERUSUARIO') return res.status(403).json({ error: 'Acceso denegado' });

  try {
    const sec = getSecurityFilter(req, 'e');
    const disputes = db.prepare(`
      SELECT 
        e.ci, e.nombre, e.apellido, e.local_votacion,
        GROUP_CONCAT('Lista ' || l.list_number || ' (' || u.nombre || ')|' || ec.lat || '|' || ec.lng) as details,
        COUNT(DISTINCT ec.list_id) as list_count
      FROM elector_captures ec
      JOIN electors e ON ec.elector_ci = e.ci
      JOIN lists l ON ec.list_id = l.id
      JOIN users u ON ec.coordinator_id = u.id
      WHERE 1=1 ${sec.sql}
      GROUP BY e.ci
      HAVING list_count > 1
    `).all(...sec.params);
    res.json(disputes);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});


// --- DIA D (Election Day) HUB ENDPOINTS ---

app.get('/api/diad/coverage', (req, res) => {
  const list_id = getListId(req);
  const role = getRole(req);
  const user_id = req.headers['x-user-id'];
  
  let districtName = '';
  let distritoFilter = '';
  let vlFilter = '';
  
  if (role !== 'SUPERUSUARIO' && user_id) {
    const user = getCachedUserInfo(user_id as string);
    if (user?.distrito) {
      districtName = user.distrito;
      distritoFilter = `WHERE (UPPER(distrito) = UPPER('${districtName}') OR UPPER(ciudad) = UPPER('${districtName}'))`;
      vlFilter = `AND (UPPER(vl.distrito) = UPPER('${districtName}') OR UPPER(vl.ciudad) = UPPER('${districtName}'))`;
    }
  }

  try {
    // 1. Total Mesas from electors
    const { total_mesas } = db.prepare(`SELECT COUNT(DISTINCT local_votacion || "-" || mesa) as total_mesas FROM electors ${distritoFilter}`).get() as any;
    
    // 2. Operational Coverage: Mesas with at least 1 member assigned (VEEDOR or MIEMBRO_MESA)
    const { assigned_mesas } = db.prepare(`
      SELECT COUNT(DISTINCT u.assigned_local || "-" || u.assigned_mesa) as assigned_mesas 
      FROM users u
      JOIN voting_locations vl ON u.assigned_local = vl.nombre
      WHERE (u.role = 'VEEDOR' OR u.role = 'MIEMBRO_MESA') 
      AND u.assigned_local IS NOT NULL 
      AND u.assigned_mesa IS NOT NULL
      ${vlFilter}
      ${list_id && !isNaN(list_id) ? `AND u.assigned_list_id = ${list_id}` : ''}
    `).get() as any;

    // 3. Results Coverage: Mesas with actas submitted
    const { reported_mesas } = db.prepare(`
      SELECT COUNT(DISTINCT r.local_votacion || "-" || r.mesa) as reported_mesas 
      FROM results r
      JOIN voting_locations vl ON r.local_votacion = vl.nombre
      WHERE 1=1 ${vlFilter}
      ${list_id && !isNaN(list_id) ? `AND r.tenant_id = ${list_id}` : ''}
    `).get() as any;

    // 4. Votos Procesados
    const votos = db.prepare(`
      SELECT 
        (SELECT COALESCE(SUM(ar.votos), 0) FROM acta_results ar JOIN results r2 ON ar.acta_id = r2.id JOIN voting_locations vl ON r2.local_votacion = vl.nombre WHERE 1=1 ${vlFilter} ${list_id && !isNaN(list_id) ? `AND r2.tenant_id = ${list_id}` : ''}) +
        (SELECT COALESCE(SUM(r3.votos_blancos + r3.votos_nulos), 0) FROM results r3 JOIN voting_locations vl ON r3.local_votacion = vl.nombre WHERE 1=1 ${vlFilter} ${list_id && !isNaN(list_id) ? `AND r3.tenant_id = ${list_id}` : ''}) as total
    `).get() as any;

    // 5. Mesas details for the map (Most critical for performance)
    const mesas = db.prepare(`
      SELECT 
        e.local_votacion as local, e.mesa as numero, 
        vl.lat, vl.lng,
        (CASE WHEN r.id IS NOT NULL THEN 1 ELSE 0 END) as reportada,
        (CASE WHEN u.id IS NOT NULL THEN 1 ELSE 0 END) as operativa
      FROM (SELECT local_votacion, mesa FROM electors ${distritoFilter} GROUP BY local_votacion, mesa) e
      JOIN voting_locations vl ON e.local_votacion = vl.nombre
      LEFT JOIN (SELECT id, local_votacion, mesa FROM results GROUP BY local_votacion, mesa) r ON r.local_votacion = e.local_votacion AND r.mesa = e.mesa
      LEFT JOIN (SELECT id, assigned_local, assigned_mesa FROM users WHERE (role = 'VEEDOR' OR role = 'MIEMBRO_MESA') GROUP BY assigned_local, assigned_mesa) u ON u.assigned_local = e.local_votacion AND u.assigned_mesa = e.mesa
      WHERE 1=1 ${vlFilter}
    `).all();

    // 6. Active Coordinators
    const { total_coordinadores } = db.prepare(`
      SELECT COUNT(*) as total_coordinadores FROM users u
      WHERE role = 'COORDINADOR'
      ${districtName ? `AND (UPPER(u.distrito) = UPPER('${districtName}'))` : ''}
      ${list_id && !isNaN(list_id) ? `AND u.assigned_list_id = ${list_id}` : ''}
    `).get() as any;

    // 7. Active Vehicles (Móviles)
    const { total_vehiculos } = db.prepare(`
      SELECT COUNT(*) as total_vehiculos FROM vehicles v
      WHERE 1=1
      ${list_id && !isNaN(list_id) ? `AND (v.assigned_list_id = ${list_id})` : ''}
    `).get() as any;

    res.json({
      total_mesas,
      mesas_operativas: assigned_mesas || 0,
      op_porcentaje: total_mesas > 0 ? (assigned_mesas / total_mesas) * 100 : 0,
      mesas_reportadas: reported_mesas || 0,
      mesas_pendientes: total_mesas - (reported_mesas || 0),
      porcentaje: total_mesas > 0 ? (reported_mesas / total_mesas) * 100 : 0,
      votos_procesados: votos.total || 0,
      total_coordinadores: total_coordinadores || 0,
      total_vehiculos: total_vehiculos || 0,
      mesas
    });
  } catch (err: any) {
    console.error('[DIAD COVERAGE ERROR]', err);
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/diad/results', (req, res) => {
  const list_id = getListId(req);
  try {
    const formatted = db.prepare(`
      SELECT 
        l.id, l.list_number, l.candidate_alias, l.type, l.candidate_nombre,
        COALESCE(SUM(ar.votos), 0) as votos
      FROM lists l
      LEFT JOIN acta_results ar ON l.id = ar.lista_id
      ${list_id && !isNaN(list_id) ? `WHERE l.campaign_id = (SELECT campaign_id FROM lists WHERE id = ${list_id})` : ''}
      GROUP BY l.id
      ORDER BY votos DESC
    `).all() as any[];
    
    const totalVotos = formatted.reduce((acc, curr) => acc + curr.votos, 0);
    formatted.forEach(f => f.porcentaje = totalVotos > 0 ? (f.votos / totalVotos) * 100 : 0);

    res.json(formatted);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/diad/listas', (req, res) => {
  try {
    const lists = db.prepare(`
      SELECT id, candidate_alias as nombre, list_number, type, is_adversary
      FROM lists
      ORDER BY is_adversary ASC, list_number ASC
    `).all();
    res.json(lists);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/diad/listas', (req, res) => {
  const { list_number, candidate_alias, type, is_adversary } = req.body;
  try {
    const result = db.prepare(`
      INSERT INTO lists (list_number, candidate_alias, type, is_adversary, campaign_id)
      VALUES (?, ?, ?, ?, 1)
    `).run(list_number, candidate_alias, type, is_adversary ? 1 : 0);
    res.json({ success: true, id: result.lastInsertRowid });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/diad/acta', upload.single('foto_acta'), (req, res) => {
  const { mesa_id, votos_blanco, votos_nulos, listas } = req.body;
  const userId = req.headers['x-user-id'];
  
  try {
    const photoUrl = req.file ? `/uploads/${req.file.filename}` : null;
    const parsedListas = JSON.parse(listas);

    db.transaction(() => {
      // 1. Get mesa info
      const user = db.prepare('SELECT assigned_local, assigned_mesa FROM users WHERE id = ?').get(userId) as any;
      const local = user?.assigned_local || 'PENDIENTE';
      const mesa = user?.assigned_mesa || 0;

      // 2. Create main result record
      const result = db.prepare(`
        INSERT INTO results (tenant_id, mesa, local_votacion, votos_blancos, votos_nulos, foto_acta_url, veedor_id)
        VALUES (1, ?, ?, ?, ?, ?, ?)
      `).run(mesa, local, votos_blanco || 0, votos_nulos || 0, photoUrl, userId);
      
      const actaId = result.lastInsertRowid;

      // 3. Save per-list results
      const insertResult = db.prepare(`
        INSERT INTO acta_results (acta_id, lista_id, votos)
        VALUES (?, ?, ?)
      `);

      for (const item of parsedListas) {
        insertResult.run(actaId, item.lista_id, item.votos);
      }
    })();

    res.json({ success: true });
  } catch (err: any) {
    console.error('Acta error:', err);
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/diad/actas', (req, res) => {
  const list_id = getListId(req);
  try {
    const actas = db.prepare(`
      SELECT 
        r.id, r.mesa as mesa_numero, r.local_votacion as local,
        u.nombre as submitted_by,
        ((SELECT COALESCE(SUM(votos), 0) FROM acta_results ar WHERE ar.acta_id = r.id) + r.votos_blancos + r.votos_nulos) as votos_total,
        r.foto_acta_url as foto_url,
        r.timestamp as submitted_at
      FROM results r
      LEFT JOIN users u ON r.veedor_id = u.id
      ${list_id && !isNaN(list_id) ? `WHERE r.tenant_id = ${list_id}` : ''}
      ORDER BY r.timestamp DESC
    `).all();
    res.json(actas);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/diad/members', (req, res) => {
  try {
    const members = db.prepare(`
      SELECT u.id, u.nombre, u.assigned_local, u.assigned_mesa, u.role
      FROM users u
      WHERE u.role IN ('VEEDOR', 'MIEMBRO_MESA')
    `).all();
    res.json(members);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/diad/members/assign', (req, res) => {
  const { ci, local, mesa, user_id, role } = req.body;
  const targetRole = role || 'MIEMBRO_MESA';
  try {
    let targetId = user_id;
    
    if (ci && !targetId) {
      // Find user by CI
      const existingUser = db.prepare('SELECT id FROM users WHERE ci = ?').get(ci) as any;
      if (existingUser) {
        targetId = existingUser.id;
      } else {
        // Create new user from electors
        const elector = db.prepare('SELECT nombre, apellido FROM electors WHERE ci = ?').get(ci) as any;
        if (!elector) return res.status(404).json({ error: 'Ciudadano no encontrado en el padrón' });
        
        const username = `member_${ci}`;
        const password = `pass_${ci}`;
        const fullName = `${elector.nombre} ${elector.apellido}`;
        
        const result = db.prepare(`
          INSERT INTO users (username, password, role, nombre, ci)
          VALUES (?, ?, ?, ?, ?)
        `).run(username, password, targetRole, fullName, ci);
        targetId = result.lastInsertRowid;
      }
    }

    if (!targetId) return res.status(400).json({ error: 'No se pudo identificar al usuario' });

    db.prepare(`
      UPDATE users 
      SET assigned_local = ?, assigned_mesa = ?, role = ?
      WHERE id = ?
    `).run(local, mesa, targetRole, targetId);
    
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/veedor/table-status', (req, res) => {
  const role = getRole(req);
  if (role !== 'VEEDOR' && role !== 'SUPERUSUARIO') {
    // For demo purposes, we'll allow other roles to see a dummy table if not assigned
  }

  try {
    const userId = req.headers['x-user-id'];
    if (!userId) return res.status(401).json({ error: 'No user ID provided' });

    const user = db.prepare('SELECT assigned_local, assigned_mesa FROM users WHERE id = ?').get(userId) as any;
    
    if (!user?.assigned_local) {
      // Return a demo local if none assigned for testing
      return res.json({
        info: { local: 'SIN ASIGNACIÓN', mesa: 0, total: 400 },
        votedOrders: []
      });
    }

    const local = user.assigned_local;
    const mesa = user.assigned_mesa || 1;

    // Get max order number for this table
    const stats = db.prepare('SELECT MAX(orden) as total FROM electors WHERE local_votacion = ? AND mesa = ?').get(local, mesa) as any;
    
    // Get already voted orders
    const voted = db.prepare('SELECT orden FROM participation_logs WHERE local_votacion = ? AND mesa = ?').all(local, mesa) as any[];

    res.json({
      info: {
        local,
        mesa,
        total: stats?.total || 400
      },
      votedOrders: voted.map(v => v.orden)
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/veedor/mark-vote', (req, res) => {
  const { order } = req.body;
  const userId = req.headers['x-user-id'];
  if (!userId) return res.status(401).json({ error: 'No user ID provided' });

  try {
    const user = db.prepare('SELECT assigned_local, assigned_mesa FROM users WHERE id = ?').get(userId) as any;
    const local = user?.assigned_local || 'ESC. BAS. CARLOS ANTONIO LOPEZ';
    const mesa = user?.assigned_mesa || 1;

    db.prepare(`
      INSERT INTO participation_logs (local_votacion, mesa, orden, veedor_id)
      VALUES (?, ?, ?, ?)
    `).run(local, mesa, order, userId);

    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/admin/system/wipe-captures', (req, res) => {
  const { key, distrito } = req.body;
  const masterKeyFromDb = db.prepare("SELECT value FROM settings WHERE key = 'master_key'").get() as any;
  
  if (key !== masterKeyFromDb?.value) {
    return res.status(401).json({ error: 'Llave Maestra inválida' });
  }

  try {
    db.transaction(() => {
      if (!distrito || distrito === 'ALL') {
        // GLOBAL WIPE
        db.prepare('DELETE FROM elector_captures').run();
        db.prepare('DELETE FROM capture_conflicts').run();
        db.prepare('DELETE FROM field_requests').run();
        db.prepare('DELETE FROM participation_logs').run();
        db.prepare('DELETE FROM acta_results').run();
        db.prepare('DELETE FROM results').run();
        logAction(1, 'SYSTEM_WIPE', 'GLOBAL', null, 'Performed a master wipe of all system data');
      } else {
        // DISTRICT SPECIFIC WIPE
        const electorsInDistrito = db.prepare('SELECT ci FROM electors WHERE ciudad = ? OR distrito = ?').all(distrito, distrito) as any[];
        const ciList = electorsInDistrito.map(e => `'${e.ci}'`).join(',');
        
        if (ciList) {
          db.prepare(`DELETE FROM elector_captures WHERE elector_ci IN (${ciList})`).run();
          db.prepare(`DELETE FROM capture_conflicts WHERE elector_ci IN (${ciList})`).run();
        }

        const locationsInDistrito = db.prepare('SELECT nombre FROM voting_locations WHERE distrito = ?').all(distrito) as any[];
        const locList = locationsInDistrito.map(l => `'${l.nombre}'`).join(',');

        if (locList) {
          db.prepare(`DELETE FROM participation_logs WHERE local_votacion IN (${locList})`).run();
          db.prepare(`DELETE FROM results WHERE local_votacion IN (${locList})`).run();
          // acta_results are linked to results via acta_id, but better-sqlite3 doesn't have cascades by default if not enabled
          db.prepare(`DELETE FROM acta_results WHERE acta_id NOT IN (SELECT id FROM results)`).run();
        }

        logAction(1, 'SYSTEM_WIPE', 'DISTRICT', null, `Performed a wipe for district: ${distrito}`);
      }
    })();

    res.json({ success: true, message: distrito && distrito !== 'ALL' ? `Datos del distrito ${distrito} purgados` : 'Sistema purgado globalmente' });
  } catch (err: any) {
    console.error('[WIPE ERROR]', err);
    res.status(500).json({ error: err.message });
  }
});

app.listen(Number(PORT), '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
  // Auto-connect default WhatsApp terminal on boot
  setTimeout(() => {
    console.log('[SYSTEM] Intentando auto-conectar WhatsApp...');
    whatsappService.connect('default').catch(err => console.error('Error in auto-connect:', err));
  }, 5000);
});
