import express from 'express';
import crypto from 'crypto';
import cors from 'cors';
import { PostHog } from 'posthog-node';
import helmet from 'helmet';
import { rateLimit } from 'express-rate-limit';
import pinoHttp from 'pino-http';

const posthogClient = process.env.POSTHOG_API_KEY
  ? new PostHog(process.env.POSTHOG_API_KEY, { host: process.env.POSTHOG_HOST || 'https://us.i.posthog.com' })
  : null;

export const trackEvent = (userId: string | number | null, event: string, properties: Record<string, any> = {}) => {
  if (posthogClient) {
    try {
      posthogClient.capture({
        distinctId: userId ? String(userId) : 'anonymous',
        event,
        properties
      });
    } catch (e) {
      console.error('[POSTHOG ERROR]', e);
    }
  }
};
import dotenv from 'dotenv';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { z } from 'zod';
import db, { runBootstrapChecks } from './db';
import { whatsappService } from './whatsappService';
import * as XLSX from 'xlsx';
import logger from './utils/logger';
import { normalizePhone } from './utils/phone';
import { dbQueryAsync, dbGetAsync } from './db-async';

// Safe wrapper for global console logging methods to prevent recursion and log cleanly using Pino
console.log = (...args: any[]) => {
  if (args.length === 1 && typeof args[0] === 'string') {
    logger.info(args[0]);
  } else {
    logger.info({ args }, 'Console log');
  }
};
console.warn = (...args: any[]) => {
  if (args.length === 1 && typeof args[0] === 'string') {
    logger.warn(args[0]);
  } else {
    logger.warn({ args }, 'Console warn');
  }
};
console.error = (...args: any[]) => {
  if (args.length === 1 && typeof args[0] === 'string') {
    logger.error(args[0]);
  } else {
    logger.error({ args }, 'Console error');
  }
};

dotenv.config();

export const app = express();
app.disable('etag');

// Logging HTTP estructurado
app.use(pinoHttp({
  logger,
  genReqId: (req) => req.headers['x-request-id'] || crypto.randomUUID(),
  autoLogging: {
    ignore: (req) => {
      const ignoredUrls = ['/api/ping', '/api/health'];
      return ignoredUrls.includes(req.url || '');
    }
  }
}));

// Cabeceras de seguridad Helmet
app.use(helmet({
  hsts: {
    maxAge: 31536000, // 1 año en segundos
    includeSubDomains: true,
    preload: true
  },
  frameguard: {
    action: 'deny'
  },
  referrerPolicy: {
    policy: 'strict-origin'
  }
}));

// Rate limiters específicos
export const loginLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  message: { error: 'Demasiados intentos de inicio de sesión. Intente de nuevo en 1 minuto.' },
  standardHeaders: true,
  legacyHeaders: false,
});

export const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  message: { error: 'Límite de peticiones excedido (100/min).' },
  standardHeaders: true,
  legacyHeaders: false,
});

export const captureLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  message: { error: 'Límite de capturas de electores excedido (30/min).' },
  standardHeaders: true,
  legacyHeaders: false,
});

export const uploadLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  message: { error: 'Límite de subidas de archivos excedido (10/min).' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Aplicar rate limiter general a todas las rutas de API
app.use('/api', apiLimiter);

const PORT = process.env.PORT || 5000;

const BUILD_VERSION = Date.now().toString();
let serverReady = false;

import { cacheService } from './services/cache';

// --- REDIS-BACKED CACHE (WITH LOCAL MEMORY FALLBACK) ---
export const clearElectorsCache = async () => {
  console.log('[CACHE] Clearing all electors-related cache entries...');
  await cacheService.invalidate('electors:');
};

export function createCache<T>(prefix: string, defaultTtlMs: number) {
  return {
    get: async (key: string): Promise<T | null> => {
      return cacheService.get<T>(`${prefix}:${key}`);
    },
    set: async (key: string, data: T, ttlMs?: number): Promise<void> => {
      const ttlSec = Math.round((ttlMs !== undefined ? ttlMs : defaultTtlMs) / 1000);
      await cacheService.set<T>(`${prefix}:${key}`, data, ttlSec);
    },
    invalidate: async (): Promise<void> => {
      await cacheService.invalidate(`${prefix}:`);
    },
    cleanup: () => {}
  };
}

export const fullReportCache = createCache<any>('fullReport', 60000); // 60s
export const myTeamReportsCache = createCache<any>('myTeamReports', 30000); // 30s
export const commandStatsCache = createCache<any>('commandStats', 15000); // 15s
export const diadCoverageCache = createCache<any>('diadCoverage', 30000); // 30s

const allCaches = [fullReportCache, myTeamReportsCache, commandStatsCache, diadCoverageCache];

export const invalidateAllReportsCaches = async () => {
  console.log('[CACHE] Invalidating all heavy reports caches due to mutation...');
  for (const c of allCaches) {
    await c.invalidate();
  }
};



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
  allowedHeaders: ['Content-Type', 'Authorization', 'x-list-id', 'x-user-role', 'x-user-id', 'x-district', 'Accept', 'If-None-Match'],
  exposedHeaders: ['ETag', 'X-Build-Version']
}));
// app.options wildcard removed – global cors() middleware already handles preflight for all routes
// CORS rejection logging & global error reporting
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  if (err && err.message && err.message.includes('CORS')) {
    console.error('CORS error:', err);
  }
  const userId = req.headers['x-user-id'] as string || null;
  const role = req.headers['x-user-role'] as string || null;
  const district = req.headers['x-district'] as string || null;
  trackEvent(userId, 'server_error', {
    message: err.message || String(err),
    stack: err.stack || '',
    path: req.path,
    method: req.method,
    role,
    district
  });
  next(err);
});

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

app.use(express.json({ limit: '10mb' }));
app.use('/uploads', express.static(uploadDir));

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

// Attach build version to every response so clients can detect deploys
app.use((_req, res, next) => {
  res.setHeader('X-Build-Version', BUILD_VERSION);
  next();
});

// HTTP Cache-Control and Vary Header Middleware
app.use((req, res, next) => {
  if (req.method === 'GET') {
    const p = req.path;
    res.setHeader('Vary', 'Accept-Encoding, x-user-id, x-district');

    if (p.startsWith('/api/locales') || p.startsWith('/api/campaigns') || p.startsWith('/api/lists')) {
      res.setHeader('Cache-Control', 'public, max-age=60');
    } else if (p.startsWith('/api/stats/command') || p.startsWith('/api/diad/coverage') || p.startsWith('/api/summary')) {
      res.setHeader('Cache-Control', 'public, max-age=15');
    } else if (p.startsWith('/api/me') || p.startsWith('/api/stream/events') || p.startsWith('/api/ping') || p.startsWith('/api/ready')) {
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    }
  } else {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  }
  next();
});

// Custom MD5 ETag Middleware for GET requests
app.use((req, res, next) => {
  if (req.method !== 'GET') {
    return next();
  }

  const originalSend = res.send;
  res.send = function (body) {
    if (body && (typeof body === 'string' || Buffer.isBuffer(body))) {
      const hash = crypto.createHash('md5').update(body).digest('hex');
      const etag = `W/"${hash}"`;
      res.setHeader('ETag', etag);

      if (req.headers['if-none-match'] === etag) {
        res.status(304).end();
        return res;
      }
    }
    return originalSend.apply(this, arguments as any);
  };
  next();
});

// 💓 Health Check & Warmup
app.get('/api/ping', (_req, res) => {
  try {
    db.prepare('SELECT 1').get();
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  } catch (e) {
    res.status(500).json({ status: 'error', message: 'Database unreachable' });
  }
});

app.get('/api/version', (_req, res) => {
  res.json({ version: BUILD_VERSION });
});

app.get('/api/ready', (_req, res) => {
  res.json({ ready: serverReady });
});

// TEMP: Test conflicts query directly (no auth filter)
app.get('/api/diagnostics/conflicts-test', (_req, res) => {
  try {
    const sample = db.prepare(`
      SELECT cc.id as conflict_id, cc.status, cc.elector_ci, e.nombre, e.apellido, e.distrito,
             ua.nombre as coord_a, ub.nombre as coord_b
      FROM capture_conflicts cc
      CROSS JOIN electors e ON cc.elector_ci = e.ci
      LEFT JOIN elector_captures ca ON cc.capture_id = ca.id
      LEFT JOIN elector_captures cb ON cc.capture_id_b = cb.id
      LEFT JOIN users ua ON ca.coordinator_id = ua.id
      LEFT JOIN users ub ON cb.coordinator_id = ub.id
      WHERE cc.status != 'RESOLVED' AND e.distrito = 'PEDRO JUAN CABALLERO'
      LIMIT 5
    `).all();
    const total = db.prepare(`
      SELECT COUNT(*) as c FROM capture_conflicts cc
      CROSS JOIN electors e ON cc.elector_ci = e.ci
      WHERE cc.status != 'RESOLVED' AND e.distrito = 'PEDRO JUAN CABALLERO'
    `).get() as any;
    res.json({ total: total.c, sample });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 🔍 Database diagnostic endpoint (no auth required) — shows data counts per district
app.get('/api/diagnostics/data-health', (_req, res) => {
  try {
    const totalLocations = db.prepare('SELECT COUNT(*) as c FROM voting_locations').get() as any;
    const locationsWithGeo = db.prepare('SELECT COUNT(*) as c FROM voting_locations WHERE lat IS NOT NULL AND lng IS NOT NULL').get() as any;
    const totalCaptures = db.prepare('SELECT COUNT(*) as c FROM elector_captures').get() as any;
    const capturesWithGeo = db.prepare('SELECT COUNT(*) as c FROM elector_captures WHERE lat IS NOT NULL AND lng IS NOT NULL').get() as any;
    const totalElectors = db.prepare('SELECT COUNT(*) as c FROM electors').get() as any;
    const totalUsers = db.prepare('SELECT COUNT(*) as c FROM users').get() as any;

    const locationsByDistrict = db.prepare(`
      SELECT COALESCE(distrito, ciudad, 'SIN_DISTRITO') as district,
             COUNT(*) as total,
             SUM(CASE WHEN lat IS NOT NULL AND lng IS NOT NULL THEN 1 ELSE 0 END) as with_geo
      FROM voting_locations GROUP BY COALESCE(distrito, ciudad, 'SIN_DISTRITO') ORDER BY total DESC LIMIT 20
    `).all();

    const capturesByDistrict = db.prepare(`
      SELECT COALESCE(e.distrito, 'SIN_DISTRITO') as district,
             COUNT(*) as total,
             SUM(CASE WHEN ec.lat IS NOT NULL AND ec.lng IS NOT NULL THEN 1 ELSE 0 END) as with_geo
      FROM elector_captures ec LEFT JOIN electors e ON ec.elector_ci = e.ci
      GROUP BY COALESCE(e.distrito, 'SIN_DISTRITO') ORDER BY total DESC LIMIT 20
    `).all();

    // Detailed PJC breakdown
    const pjcBreakdown = db.prepare(`
      SELECT
        COUNT(*) as total,
        SUM(CASE WHEN ec.is_disputed = 0 THEN 1 ELSE 0 END) as not_disputed,
        SUM(CASE WHEN ec.is_disputed = 1 THEN 1 ELSE 0 END) as disputed,
        SUM(CASE WHEN ec.lat IS NOT NULL AND ec.lng IS NOT NULL THEN 1 ELSE 0 END) as with_geo,
        SUM(CASE WHEN ec.is_disputed = 0 AND ec.lat IS NOT NULL AND ec.lng IS NOT NULL THEN 1 ELSE 0 END) as valid_with_geo,
        SUM(CASE WHEN ec.traffic_light = 'GREEN' AND ec.is_disputed = 0 THEN 1 ELSE 0 END) as green,
        SUM(CASE WHEN ec.traffic_light = 'YELLOW' AND ec.is_disputed = 0 THEN 1 ELSE 0 END) as yellow,
        SUM(CASE WHEN ec.traffic_light = 'RED' AND ec.is_disputed = 0 THEN 1 ELSE 0 END) as red,
        SUM(CASE WHEN ec.traffic_light = 'PURPLE' AND ec.is_disputed = 0 THEN 1 ELSE 0 END) as purple
      FROM elector_captures ec
      LEFT JOIN electors e ON ec.elector_ci = e.ci
      WHERE e.distrito = 'PEDRO JUAN CABALLERO'
    `).get() as any;

    // Check what list_ids exist for PJC captures
    const pjcLists = db.prepare(`
      SELECT ec.list_id, l.list_number, COUNT(*) as count
      FROM elector_captures ec
      LEFT JOIN electors e ON ec.elector_ci = e.ci
      LEFT JOIN lists l ON ec.list_id = l.id
      WHERE e.distrito = 'PEDRO JUAN CABALLERO' AND ec.is_disputed = 0
      GROUP BY ec.list_id ORDER BY count DESC
    `).all();

    // Voting locations — show ALL columns for PJC
    const pjcLocations = db.prepare(`
      SELECT cod_local, nombre, ciudad, distrito, lat, lng, icon
      FROM voting_locations
      WHERE distrito = 'PEDRO JUAN CABALLERO' OR ciudad = 'PEDRO JUAN CABALLERO'
    `).all();

    // How many distinct locales have electors in PJC?
    const pjcElectorLocales = db.prepare(`
      SELECT local_votacion, COUNT(*) as electors
      FROM electors WHERE distrito = 'PEDRO JUAN CABALLERO'
      GROUP BY local_votacion ORDER BY electors DESC
    `).all();

    // Conflict table diagnostics
    const conflictCounts = db.prepare(`
      SELECT status, COUNT(*) as c FROM capture_conflicts GROUP BY status
    `).all();
    const conflictTotal = db.prepare('SELECT COUNT(*) as c FROM capture_conflicts').get() as any;
    // Debug: check how many pending conflicts survive the CROSS JOIN with electors
    const pendingWithElector = db.prepare(`
      SELECT COUNT(*) as c FROM capture_conflicts cc
      CROSS JOIN electors e ON cc.elector_ci = e.ci
      WHERE cc.status != 'RESOLVED'
    `).get() as any;
    const pendingPJC = db.prepare(`
      SELECT COUNT(*) as c FROM capture_conflicts cc
      CROSS JOIN electors e ON cc.elector_ci = e.ci
      WHERE cc.status != 'RESOLVED' AND e.distrito = 'PEDRO JUAN CABALLERO'
    `).get() as any;
    const pendingOrphan = db.prepare(`
      SELECT COUNT(*) as c FROM capture_conflicts cc
      WHERE cc.status != 'RESOLVED'
      AND cc.elector_ci NOT IN (SELECT ci FROM electors)
    `).get() as any;

    res.json({
      voting_locations: { total: totalLocations.c, with_geo: locationsWithGeo.c },
      captures: { total: totalCaptures.c, with_geo: capturesWithGeo.c },
      electors: { total: totalElectors.c },
      users: { total: totalUsers.c },
      conflicts: { total: conflictTotal.c, by_status: conflictCounts, pending_with_elector: pendingWithElector.c, pending_pjc: pendingPJC.c, pending_orphan: pendingOrphan.c },
      locations_by_district: locationsByDistrict,
      captures_by_district: capturesByDistrict,
      pjc_detail: {
        captures: pjcBreakdown,
        lists: pjcLists,
        voting_locations: pjcLocations,
        elector_locales: pjcElectorLocales,
      }
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
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
app.get('/api/offline/padron/status', (req, res) => {
  try {
    const lastUpdated = db.prepare("SELECT value FROM settings WHERE key = 'padron_last_updated'").get() as any;
    const totalElectors = db.prepare("SELECT COUNT(*) as count FROM electors").get() as any;
    res.json({
      last_updated: lastUpdated ? parseInt(lastUpdated.value) : 0,
      total: totalElectors?.count || 0
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

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

    // Apply limits: 10000 without district, default 5000 with district
    let limit = activeDistrito ? 5000 : 10000;
    if (req.query.limit) {
      const parsedLimit = parseInt(req.query.limit as string);
      if (!isNaN(parsedLimit)) {
        limit = Math.min(parsedLimit, activeDistrito ? 5000 : 10000);
      }
    }
    
    let offset = 0;
    if (req.query.offset) {
      const parsedOffset = parseInt(req.query.offset as string);
      if (!isNaN(parsedOffset)) {
        offset = parsedOffset;
      }
    }

    query += " LIMIT ? OFFSET ?";
    params.push(limit, offset);

    const electors = db.prepare(query).all(...params);
    
    // Compact mapping: [ci, nombre, apellido, local, mesa, orden]
    const compact = (electors as any[]).map(e => {
      const sanitized = sanitizeElectorData(e);
      return [sanitized.ci, sanitized.nombre, sanitized.apellido, sanitized.local_votacion, sanitized.mesa, sanitized.orden];
    });
    
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

app.post('/api/upload-photo', uploadLimiter, upload.single('photo'), (req, res) => {
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
  elector_ci: z.string().refine(validateCI, { message: 'Formato de C.I. del elector inválido' }),
  coordinator_id: z.coerce.number(), 
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
  traffic_light: z.enum(['GREEN', 'YELLOW', 'RED', 'PURPLE']),
  needs_transport: z.boolean().optional(),
  telefono: z.string().min(6, "El teléfono es obligatorio"),
  elector_nombre: z.string().optional(),
  photo_ci_frente: z.string().optional(),
  photo_ci_verso: z.string().optional(),
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

// --- SSE Push Notifications System ---
export const sseClients = new Map<string, express.Response>();

app.get('/api/stream/events', (req, res) => {
  const userId = req.query.userId as string;
  if (!userId) return res.status(400).json({ error: 'Missing userId' });

  // Set headers for Server-Sent Events
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders(); // flush the headers to establish SSE

  // Tell the client that connection is established
  res.write(`data: ${JSON.stringify({ type: 'CONNECTED', message: 'SSE Connection Established' })}\n\n`);

  // Register client
  sseClients.set(userId, res);
  console.log(`[SSE] Client connected: ${userId}. Total clients: ${sseClients.size}`);

  // Handle client disconnect
  req.on('close', () => {
    sseClients.delete(userId);
    console.log(`[SSE] Client disconnected: ${userId}. Total clients: ${sseClients.size}`);
  });
});

app.post('/api/command/push-message', requireRole('SUPERUSUARIO', 'COORDINADOR', 'SUPER_ADMIN'), (req, res) => {
  const { targetUserId, title, body, type } = req.body;
  if (!targetUserId || !title || !body) {
    return res.status(400).json({ error: 'Missing targetUserId, title or body' });
  }

  const clientRes = sseClients.get(targetUserId.toString());
  if (clientRes) {
    const payload = {
      type: 'PUSH_MESSAGE',
      data: {
        id: Date.now(),
        title,
        body,
        type: type || 'info',
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        read: false
      }
    };
    clientRes.write(`data: ${JSON.stringify(payload)}\n\n`);
    res.json({ success: true, message: 'Message sent via SSE' });
  } else {
    res.status(404).json({ error: 'User is not currently connected to SSE stream' });
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
  if (!val || val === 'null' || val === 'undefined' || val === '') return null;
  // Normalize: Uppercase, trim, and remove accents
  const normalized = val.toString().toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
  if (['GLOBAL', 'TODOS', 'ALL', 'TODAS', 'NULL'].includes(normalized)) return null;
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
           COALESCE(u.distrito, l.ciudad, c1.distrito, c2.distrito) as distrito,
           COALESCE(l.campaign_id, u.assigned_campaign_id) as campaign_id
    FROM users u
    LEFT JOIN lists l ON u.assigned_list_id = l.id
    LEFT JOIN campaigns c1 ON l.campaign_id = c1.id
    LEFT JOIN campaigns c2 ON u.assigned_campaign_id = c2.id
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
function requireRole(...roles: string[]) {
  return (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const role = (req.headers['x-user-role'] as string || '').toUpperCase().trim();
    if (!roles.map(r => r.toUpperCase()).includes(role)) {
      return res.status(403).json({ error: 'Acceso denegado. Rol insuficiente.' });
    }
    next();
  };
}
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

    // 1. Column name mapping: 'lists' uses 'ciudad', others use 'distrito'
    let distColumn = 'distrito';
    if (tableAlias === 'l') distColumn = 'ciudad';

    // 2. Admin Isolation: SuperUsers see everything, Jefe de Campaña and Subjefes see their scope
    if (role === 'SUPERUSUARIO' || role === 'SUPER_ADMIN' || role === 'JEFE_CAMPANA' || role === 'SUBJEFE' || role === 'PADRINO' || role === 'CANDIDATO' || role === 'CANDIDATE') {
      let sql = '';
      let params: any[] = [];

      // 1. Determine the effective district to filter by
      let effectiveDistrict = getDistrict(req);
      
      // CRITICAL: If they are a JEFE_CAMPANA/SUBJEFE, their profile district ALWAYS overrides or acts as fallback
      if ((role === 'JEFE_CAMPANA' || role === 'SUBJEFE' || role === 'PADRINO' || role === 'CANDIDATO' || role === 'CANDIDATE') && user?.distrito) {
        effectiveDistrict = user.distrito;
      }

      if (effectiveDistrict) {
        const d = effectiveDistrict; 
        console.log(`[SECURITY] Applying district filter: ${d} for table ${tableAlias}`);
        
        if (tableAlias === 'u') {
          sql += ` AND (
            u.distrito = ? OR 
            EXISTS (SELECT 1 FROM lists l2 WHERE l2.id = u.assigned_list_id AND l2.ciudad = ?) OR 
            EXISTS (SELECT 1 FROM campaigns c2 WHERE c2.id = u.assigned_campaign_id AND c2.distrito = ?)
          )`;
          params.push(d, d, d);
        } else if (tableAlias === 'ec') {
          sql += ` AND e.distrito = ?`;
          params.push(d);
        } else if (tableAlias === 'cc' || tableAlias === 'cc_history') {
          // Both conflict endpoints already JOIN electors as 'e' — filter directly on that alias
          sql += ` AND e.distrito = ?`;
          params.push(d);
        } else {
          // Determine which column to use based on table schema
          let col = 'distrito';
          if (tableAlias === 'l') col = 'ciudad';
          
          sql += ` AND ${tableAlias}.${col} = ?`;
          params.push(d);
          
          // Fallback for tables that have both or might use either
          if (tableAlias === 'loc') {
             sql = sql.slice(0, -1); // remove the last '?'
             sql = sql.replace(` AND ${tableAlias}.${col} = `, ` AND (${tableAlias}.ciudad = ? OR ${tableAlias}.distrito = ?)`);
             params.push(d); // add second param for the OR
          }
        }
      }

      // 2. Campaign/List Isolation for non-SuperUsers (only if no district is assigned)
      if ((role === 'JEFE_CAMPANA' || role === 'CANDIDATO' || role === 'CANDIDATE') && !effectiveDistrict) {
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

      let listId = getListId(req);
      
      // FORCED LIST ISOLATION for Subjefes and Padrinos (they are lords, but only of THEIR list)
      if ((role === 'SUBJEFE' || role === 'PADRINO') && user?.assigned_list_id) {
          listId = user.assigned_list_id;
      }

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

      const isDetailQuery = ['ec', 'u'].includes(tableAlias);
      const isPublicStats = req.path.includes('/stats/command'); 
      
      if (role === 'JEFE_CAMPANA' && isDetailQuery && !isPublicStats) {
          const listCol = (tableAlias === 'u') ? 'assigned_list_id' : 'list_id';
          sql += ` AND (
            ${tableAlias}.${listCol} IS NULL OR 
            ${tableAlias}.role IN ('SUBJEFE') OR
            NOT EXISTS (SELECT 1 FROM users ul WHERE ul.assigned_list_id = ${tableAlias}.${listCol} AND ul.role = 'SUBJEFE')
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

    // Adjust for ec, cc, and cc_history which need customized joins or columns
    let sql = '';
    let params: any[] = [];
    let targetAlias = tableAlias;
    if (tableAlias === 'ec') {
      sql = ` AND e.distrito = ?`;
      params = [user.distrito];
    } else if (tableAlias === 'cc') {
      sql = ` AND (e.distrito = ? OR ua.distrito = ? OR ub.distrito = ?)`;
      params = [user.distrito, user.distrito, user.distrito];
    } else if (tableAlias === 'cc_history') {
      sql = ` AND (e.distrito = ? OR u_win_1.distrito = ? OR u_win_2.distrito = ?)`;
      params = [user.distrito, user.distrito, user.distrito];
    } else {
      let targetCol = distColumn;
      sql = ` AND ${targetAlias}.${targetCol} = ?`;
      params = [user.distrito];
    }

    if ((tableAlias === 'e') && user.campaign_id) {
      sql += ` AND (${targetAlias}.campaign_id = ? OR ${targetAlias}.campaign_id IS NULL)`;
      params.push(user.campaign_id);
    }

    // 4. Strict Hierarchy Isolation (for users/lists)
    if ((tableAlias === 'u' || tableAlias === 'l') && !['SUPERUSUARIO', 'SUPER_ADMIN', 'JEFE_CAMPANA', 'SUBJEFE', 'PADRINO'].includes(role)) {
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

app.post('/api/login', loginLimiter, (req, res) => {
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

  // Buscar usuario en DB directamente
  user = db.prepare(`
    SELECT u.*, c.enabled_modules as campaign_modules, c.distrito, COALESCE(u.assigned_campaign_id, l.campaign_id) as final_campaign_id, c.status as campaign_status
    FROM users u
    LEFT JOIN lists l ON u.assigned_list_id = l.id
    LEFT JOIN campaigns c ON (u.assigned_campaign_id = c.id OR l.campaign_id = c.id)
    WHERE u.username = ? OR u.ci = ? OR u.username = ? OR u.ci = ?
       OR REPLACE(u.username, '.', '') = ? OR REPLACE(u.ci, '.', '') = ?
  `).get(username.trim(), username.trim(), cleanUsername, cleanUsername, cleanUsername, cleanUsername) as any;

  const normalizedSavedPassword = user?.password?.toString().replace(/\./g, '');
  const normalizedInputPassword = cleanPassword.replace(/\./g, '');

  const isSuccess = user && (user.password === cleanPassword || normalizedSavedPassword === normalizedInputPassword);

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
    if (user.campaign_status === 'PAUSED' || user.campaign_status === 'paused') {
      return res.status(403).json({ error: 'Excepción técnica en el sistema. Por favor, comuníquese con el Jefe de Campaña o Soporte Técnico para resolver el impasse.' });
    }

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
  if (!['SUPERUSUARIO', 'JEFE_CAMPANA', 'SUBJEFE', 'PADRINO'].includes(role) && user_id) {
    const user = db.prepare(`
      SELECT c.distrito 
      FROM users u 
      JOIN lists l ON u.assigned_list_id = l.id 
      JOIN campaigns c ON l.campaign_id = c.id 
      WHERE u.id = ?
    `).get(user_id) as any;
    if (user?.distrito) {
      const safeDistrito = user.distrito.replace(/'/g, "''");
      distritoFilter = `AND (e.distrito = '${safeDistrito}' OR e.ciudad = '${safeDistrito}')`;
    }
  }
  
  const isReadOnlyRole = ['CANDIDATO', 'CANDIDATE', 'SUPERUSUARIO', 'SUPER_ADMIN', 'JEFE_CAMPANA'].includes(role);
  const effectiveListId = isReadOnlyRole ? null : list_id;

  const elector = db.prepare(`
    SELECT e.*, c.traffic_light, c.is_disputed, c.coordinator_id as captured_by, 
           c.telefono as capture_telefono, c.lat as capture_lat, c.lng as capture_lng, c.needs_transport,
           u.nombre as coordinator_name, p.nombre as padrino_name
    FROM electors e
    LEFT JOIN elector_captures c ON e.ci = c.elector_ci AND (c.list_id = ? OR ? IS NULL)
    LEFT JOIN users u ON c.coordinator_id = u.id
    LEFT JOIN users p ON u.parent_id = p.id
    WHERE e.ci = ? ${distritoFilter}
  `).get(effectiveListId, effectiveListId, ci);
  
  if (elector) {
    res.json(elector);
  } else {
    res.status(404).json({ error: 'Elector no encontrado en el padrón.' });
  }
});

// Capture Endpoints
app.post('/api/captures', captureLimiter, (req, res) => {
  try {
    const rawCapture = CaptureSchema.parse(req.body);
    const capture = { ...rawCapture, elector_ci: rawCapture.elector_ci.replace(/\./g, '').replace(/,/g, '').trim() };
    
    const user = db.prepare('SELECT assigned_list_id, assigned_campaign_id, distrito FROM users WHERE id = ?').get(capture.coordinator_id) as any;
    const list_id = user?.assigned_list_id;
    const campaign_id = user?.assigned_campaign_id;
    const userDistrict = user?.distrito || 'DESCONOCIDO';

    if (!list_id) return res.status(403).json({ error: 'El usuario no tiene una lista asignada.' });

    // Dynamic registration for unregistered field electors
    const electorExists = db.prepare('SELECT ci FROM electors WHERE ci = ?').get(capture.elector_ci);
    if (!electorExists) {
      const fullName = capture.elector_nombre || 'Elector No Registrado';
      const parts = fullName.trim().split(/\s+/);
      const nombre = parts[0] || 'Elector';
      const apellido = parts.slice(1).join(' ') || 'No Registrado';
      
      db.prepare(`
        INSERT INTO electors (ci, nombre, apellido, local_votacion, mesa, orden, ciudad, distrito, campaign_id, photo_ci_frente, photo_ci_verso)
        VALUES (?, ?, ?, 'REGISTRO DE CAMPO', 0, 0, ?, ?, ?, ?, ?)
      `).run(
        capture.elector_ci,
        nombre,
        apellido,
        userDistrict,
        userDistrict,
        campaign_id,
        capture.photo_ci_frente || null,
        capture.photo_ci_verso || null
      );
      
      clearElectorsCache();
    }

    const transaction = db.transaction(() => {
      // 1. Check for conflict in the SAME LIST
      const intraListCapture = db.prepare('SELECT * FROM elector_captures WHERE elector_ci = ? AND list_id = ? LIMIT 1')
        .get(capture.elector_ci, list_id) as any;

      if (intraListCapture) {
        if (intraListCapture.coordinator_id !== capture.coordinator_id) {
          // Conflict within the same list: resolved by the Subjefe
          db.prepare('UPDATE elector_captures SET is_disputed = 1 WHERE elector_ci = ? AND list_id = ?').run(capture.elector_ci, list_id);
          
          const result = db.prepare(`
            INSERT INTO elector_captures (elector_ci, coordinator_id, list_id, campaign_id, lat, lng, traffic_light, is_disputed, telefono, needs_transport, photo_ci_frente, photo_ci_verso)
            VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?)
          `).run(capture.elector_ci, capture.coordinator_id, list_id, campaign_id, capture.lat, capture.lng, capture.traffic_light, capture.telefono, capture.needs_transport ? 1 : 0, capture.photo_ci_frente || null, capture.photo_ci_verso || null);

          db.prepare(`
            INSERT INTO capture_conflicts (capture_id, capture_id_b, elector_ci, list_id_a, list_id_b, conflict_type, status)
            VALUES (?, ?, ?, ?, ?, 'INTERNAL', 'PENDING')
          `).run(intraListCapture.id, Number(result.lastInsertRowid), capture.elector_ci, list_id, list_id);

          return { success: true, warning: 'Elector en disputa interna en tu lista. Se ha notificado al Jefe.', is_disputed: true };
        } else {
          // Update own capture
          db.prepare(`
            UPDATE elector_captures 
            SET lat = ?, lng = ?, traffic_light = ?, needs_transport = ?, photo_ci_frente = ?, photo_ci_verso = ?, timestamp = CURRENT_TIMESTAMP
            WHERE elector_ci = ? AND coordinator_id = ? AND list_id = ?
          `).run(capture.lat, capture.lng, capture.traffic_light, capture.needs_transport ? 1 : 0, capture.photo_ci_frente || null, capture.photo_ci_verso || null, capture.elector_ci, capture.coordinator_id, list_id);
          
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
          INSERT INTO elector_captures (elector_ci, coordinator_id, list_id, campaign_id, lat, lng, traffic_light, is_disputed, telefono, needs_transport, photo_ci_frente, photo_ci_verso)
          VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?)
        `).run(capture.elector_ci, capture.coordinator_id, list_id, campaign_id, capture.lat, capture.lng, capture.traffic_light, capture.telefono, capture.needs_transport ? 1 : 0, capture.photo_ci_frente || null, capture.photo_ci_verso || null);

        db.prepare(`
          INSERT INTO capture_conflicts (capture_id, capture_id_b, elector_ci, list_id_a, list_id_b, conflict_type, status)
          VALUES (?, ?, ?, ?, ?, 'INTER_LIST', 'PENDING')
        `).run(interListCapture.id, Number(result.lastInsertRowid), capture.elector_ci, interListCapture.list_id, list_id);

        console.log(`[CONFLICT] Created INTER_LIST dispute. ID_A: ${interListCapture.id}, ID_B: ${result.lastInsertRowid}`);
        return { success: true, warning: 'Disputa Inter-Listas detectada. El Jefe de Campaña deberá arbitrar y ambos líderes consentir.', is_disputed: true };
      }

      // 3. New clean capture
      db.prepare(`
        INSERT INTO elector_captures (elector_ci, coordinator_id, list_id, campaign_id, lat, lng, traffic_light, telefono, needs_transport, photo_ci_frente, photo_ci_verso)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(capture.elector_ci, capture.coordinator_id, list_id, campaign_id, capture.lat, capture.lng, capture.traffic_light, capture.telefono, capture.needs_transport ? 1 : 0, capture.photo_ci_frente || null, capture.photo_ci_verso || null);
      
      logAction(capture.coordinator_id, 'CREATE', 'CAPTURE', capture.elector_ci, `Captured elector ${capture.elector_ci} as ${capture.traffic_light}`);
      
      return { success: true, is_disputed: false };
    });

    const result = transaction();
    invalidateAllReportsCaches();
    res.json(result);
  } catch (err: any) {
    console.error('[CAPTURES POST ERROR]', err);
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

// Voting Locations
app.get('/api/voting-locations', (req, res) => {
  const sec = getSecurityFilter(req, 'loc');
  try {
    const locations = db.prepare(`SELECT * FROM voting_locations loc WHERE 1=1 ${sec.sql}`).all(...sec.params);
    const withGeo = locations.filter((l: any) => l.lat != null && l.lng != null);
    console.log(`[VOTING-LOCATIONS] user=${req.headers['x-user-id']} district=${req.headers['x-district'] || req.query.district || 'none'} total=${locations.length} withGeo=${withGeo.length} secSQL="${sec.sql}" secParams=${JSON.stringify(sec.params)}`);
    res.json(locations);
  } catch (err: any) {
    console.error('[VOTING-LOCATIONS ERROR]', err);
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
  const { district } = req.body;
  try {
    let query = `
      SELECT DISTINCT 
        UPPER(TRIM(local_votacion)) as nombre, 
        UPPER(TRIM(COALESCE(NULLIF(ciudad, ''), NULLIF(distrito, ''), 'SIN ASIGNAR'))) as ciudad
      FROM electors 
      WHERE local_votacion IS NOT NULL AND local_votacion != ''
    `;
    const params: any[] = [];
    if (district) {
      query += ` AND (UPPER(TRIM(distrito)) = UPPER(TRIM(?)) OR UPPER(TRIM(ciudad)) = UPPER(TRIM(?)))`;
      params.push(district, district);
    }
    const rawLocales = db.prepare(query).all(...params);

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
    clearElectorsCache();
    invalidateAllReportsCaches();
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
    const campaigns = db.prepare(`
      SELECT c.*,
        (SELECT COUNT(*) FROM users u WHERE u.assigned_campaign_id = c.id) as campUsers,
        (SELECT COUNT(*) FROM elector_captures ec WHERE ec.campaign_id = c.id) as campCaptures
      FROM campaigns c 
      WHERE 1=1 ${sec.sql}
    `).all(...params);
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
    
    invalidateAllReportsCaches();
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Schema migrations now handled by db.ts
// Legacy ALTER TABLE cleanup removed for performance

// Data Unification: Force everything to UPPERCASE to avoid duplicates
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
      SELECT ec.*, COALESCE(e.nombre || ' ' || e.apellido, 'ELECTOR') as elector_nombre, l.list_number
      FROM elector_captures ec
      LEFT JOIN electors e ON ec.elector_ci = e.ci
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
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 200);
    const queryParams = [...params, limit];

    const activities = db.prepare(`
      SELECT ec.*, COALESCE(e.nombre || ' ' || e.apellido, 'ELECTOR') as elector_nombre, u.username as coordinator_name, l.list_number
      FROM elector_captures ec
      LEFT JOIN electors e ON ec.elector_ci = e.ci
      JOIN users u ON ec.coordinator_id = u.id
      JOIN lists l ON ec.list_id = l.id
      JOIN campaigns c ON l.campaign_id = c.id
      WHERE 1=1 ${sec.sql}
      ORDER BY ec.timestamp DESC LIMIT ?
    `).all(...queryParams);
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

    // Run COUNT query for total captures
    const totalCountRes = db.prepare(`
      SELECT COUNT(*) as count
      FROM elector_captures ec
      LEFT JOIN electors e ON ec.elector_ci = e.ci
      JOIN users u ON ec.coordinator_id = u.id
      WHERE 1=1 ${sec.sql} ${listFilter} ${localFilter}
    `).get(...params) as any;
    const total = totalCountRes?.count || 0;

    // Pagination parameters
    const page = parseInt(req.query.page as string) || 1;
    const perPage = Math.min(parseInt(req.query.perPage as string) || 50, 5000);
    const offset = (page - 1) * perPage;

    const queryParams = [...params, perPage, offset];

    const captures = db.prepare(`
      SELECT 
        ec.*, 
        COALESCE(e.nombre, 'ELECTOR') as nombre, 
        COALESCE(e.apellido, 'NO REGISTRADO') as apellido, 
        COALESCE(e.local_votacion, 'REGISTRO DE CAMPO') as local_votacion, 
        COALESCE(e.mesa, 0) as mesa, 
        COALESCE(e.orden, 0) as orden, 
        u.nombre as coordinator_name, u.role as coordinator_role, 
        p.nombre as padrino_name,
        l.list_number, l.campaign_id, c.name as campaign_name
      FROM elector_captures ec
      LEFT JOIN electors e ON ec.elector_ci = e.ci
      JOIN users u ON ec.coordinator_id = u.id
      LEFT JOIN users p ON u.parent_id = p.id
      LEFT JOIN lists l ON ec.list_id = l.id
      LEFT JOIN campaigns c ON l.campaign_id = c.id
      WHERE 1=1 ${sec.sql} ${listFilter} ${localFilter}
      ORDER BY ec.timestamp DESC LIMIT ? OFFSET ?
    `).all(...queryParams);

    const withGeo = captures.filter((c: any) => c.lat != null && c.lng != null);
    console.log(`[CAPTURES] user=${req.headers['x-user-id']} district=${req.headers['x-district'] || req.query.district || 'none'} total=${total} returned=${captures.length} withGeo=${withGeo.length} perPage=${perPage} page=${page}`);
    res.json({
      data: captures,
      total,
      page,
      perPage,
      totalPages: Math.ceil(total / perPage)
    });
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
        SUM(CASE WHEN COALESCE(e.is_priority, 0) = 1 THEN 1 ELSE 0 END) as priority
      FROM elector_captures ec
      LEFT JOIN electors e ON ec.elector_ci = e.ci
      WHERE ec.needs_transport = 1 ${filterSql} ${district ? 'AND (UPPER(COALESCE(e.ciudad, \'\')) = UPPER(?) OR UPPER(COALESCE(e.distrito, \'\')) = UPPER(?))' : ''}
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
      LEFT JOIN electors e ON ec.elector_ci = e.ci
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

// Real-time Vehicle Location reporting from Driver Mobile App
app.post('/api/vehicles/:id/location', (req, res) => {
  const { id } = req.params;
  const { lat, lng } = req.body;
  try {
    db.prepare('UPDATE vehicles SET lat = ?, lng = ?, last_update = CURRENT_TIMESTAMP WHERE id = ?').run(lat, lng, id);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Driver Mobile Login (Operational convenience via Plate or Driver CI)
app.post('/api/vehicles/login', (req, res) => {
  const { plate, driver_ci } = req.body;
  try {
    let vehicle = null;
    if (plate) {
      vehicle = db.prepare(`
        SELECT v.*, u.nombre as coordinator_name, u.telefono as coordinator_phone, u.photo_url as coordinator_photo
        FROM vehicles v
        LEFT JOIN users u ON v.assigned_user_id = u.id
        WHERE UPPER(REPLACE(v.plate, '-', '')) = UPPER(REPLACE(?, '-', ''))
      `).get(plate) as any;
    } else if (driver_ci) {
      vehicle = db.prepare(`
        SELECT v.*, u.nombre as coordinator_name, u.telefono as coordinator_phone, u.photo_url as coordinator_photo
        FROM vehicles v
        LEFT JOIN users u ON v.assigned_user_id = u.id
        WHERE REPLACE(v.driver_ci, '.', '') = REPLACE(?, '.', '')
      `).get(driver_ci) as any;
    }

    if (!vehicle) {
      return res.status(404).json({ error: 'Vehículo o chofer no registrado en el sistema' });
    }

    res.json(vehicle);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Get all passengers (electors) assigned to a specific vehicle
app.get('/api/vehicles/:id/passengers', (req, res) => {
  const { id } = req.params;
  try {
    const passengers = db.prepare(`
      SELECT ec.id as capture_id, ec.transport_status, ec.telefono as contact_phone,
             COALESCE(e.ci, ec.elector_ci) as ci, 
             COALESCE(e.nombre, 'ELECTOR') as nombre, 
             COALESCE(e.apellido, 'NO REGISTRADO') as apellido, 
             COALESCE(e.local_votacion, 'REGISTRO DE CAMPO') as local_votacion, 
             COALESCE(e.mesa, 0) as mesa, 
             COALESCE(e.orden, 0) as orden, 
             COALESCE(e.barrio, 'REGISTRO DE CAMPO') as barrio,
             ec.lat, ec.lng, COALESCE(e.is_priority, 0) as is_priority
      FROM elector_captures ec
      LEFT JOIN electors e ON ec.elector_ci = e.ci
      WHERE ec.assigned_vehicle_id = ?
      ORDER BY COALESCE(e.is_priority, 0) DESC, ec.timestamp ASC
    `).all(id);
    res.json((passengers as any[]).map(sanitizeElectorData));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Update individual elector transport status (e.g. mark picked up or completed)
app.put('/api/logistics/passenger/:capture_id/status', (req, res) => {
  const { capture_id } = req.params;
  const { status } = req.body;
  try {
    db.prepare("UPDATE elector_captures SET transport_status = ? WHERE id = ?").run(status, capture_id);
    logAction(1, 'UPDATE_PASSENGER_TRANSPORT', 'CAPTURE', capture_id, `Updated passenger ${capture_id} transport status to ${status}`);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/logistics/pending', (req, res) => {
  const sec = getSecurityFilter(req, 'ec');
  try {
    const pending = db.prepare(`
      SELECT ec.*, 
        COALESCE(e.nombre, 'ELECTOR') as nombre, 
        COALESCE(e.apellido, 'NO REGISTRADO') as apellido, 
        COALESCE(e.local_votacion, 'REGISTRO DE CAMPO') as local_votacion,
        COALESCE(NULLIF(e.barrio, ''), 'REGISTRO DE CAMPO') as barrio,
        COALESCE(e.is_priority, 0) as is_priority,
        u.nombre as coordinator_name
      FROM elector_captures ec
      LEFT JOIN electors e ON ec.elector_ci = e.ci
      LEFT JOIN users u ON ec.coordinator_id = u.id
      WHERE ec.needs_transport = 1 
        AND ec.assigned_vehicle_id IS NULL 
        AND ec.transport_status != 'COMPLETED'
        ${sec.sql}
      ORDER BY COALESCE(e.is_priority, 0) DESC, ec.timestamp ASC
    `).all(...sec.params);
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
    invalidateAllReportsCaches();
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/coordinators/:id/captures', (req, res) => {
  const coordinatorId = req.params.id;
  const userRole = (req.headers['x-user-role'] as string || '').toUpperCase().trim();

  // Validate requester role
  if (!['SUPERUSUARIO', 'SUPER_ADMIN', 'JEFE_CAMPANA'].includes(userRole)) {
    return res.status(403).json({ error: 'Acceso denegado. Rol insuficiente.' });
  }

  try {
    db.transaction(() => {
      // First, get all captures for this coordinator
      const captures = db.prepare('SELECT elector_ci FROM elector_captures WHERE coordinator_id = ?').all(coordinatorId) as any[];
      
      // Update electors status to Pendiente (optional legacy field)
      for (const cap of captures) {
        try {
          db.prepare("UPDATE electors SET status = 'Pendiente' WHERE ci = ?").run(cap.elector_ci);
        } catch (e) {
          // ignore legacy column error
        }
      }
      
      // Delete captures
      db.prepare('DELETE FROM elector_captures WHERE coordinator_id = ?').run(coordinatorId);
      
      // Clean up capture conflicts associated with deleted captures
      db.prepare(`
        DELETE FROM capture_conflicts 
        WHERE capture_id NOT IN (SELECT id FROM elector_captures)
           OR capture_id_b NOT IN (SELECT id FROM elector_captures)
      `).run();
    })();

    clearElectorsCache();
    invalidateAllReportsCaches();
    res.json({ success: true, message: 'Todas las capturas del coordinador fueron eliminadas.' });
  } catch (err: any) {
    console.error('[WIPE COORDINATOR CAPTURES ERROR]', err);
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/coordinators/:id/history', (req, res) => {
  try {
    const history = db.prepare(`
      SELECT c.*, 
             COALESCE(e.nombre, 'ELECTOR') as nombre, 
             COALESCE(e.apellido, 'NO REGISTRADO') as apellido, 
             COALESCE(e.local_votacion, 'REGISTRO DE CAMPO') as local_votacion, 
             COALESCE(e.mesa, 0) as mesa,
             COALESCE(e.orden, 0) as orden
      FROM elector_captures c
      LEFT JOIN electors e ON c.elector_ci = e.ci
      WHERE c.coordinator_id = ?
      ORDER BY c.timestamp DESC
    `).all(req.params.id);
    res.json(history);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

const canModifyUser = (requesterId: string | number | undefined, requesterRole: string, targetUserId: string | number): boolean => {
  const reqRole = requesterRole.toUpperCase().trim();
  if (reqRole === 'SUPERUSUARIO' || reqRole === 'SUPER_ADMIN') {
    return true;
  }
  if (!requesterId) return false;

  const reqId = Number(requesterId);
  const targetId = Number(targetUserId);

  if (reqId === targetId) return true;

  try {
    const target = db.prepare('SELECT role, parent_id, assigned_campaign_id FROM users WHERE id = ?').get(targetId) as any;
    if (!target) return false;

    // First, campaign isolation check: target must be in the same campaign (unless requester is superuser, handled above)
    const requesterInfo = getCachedUserInfo(String(reqId));
    if (target.assigned_campaign_id && requesterInfo?.campaign_id && target.assigned_campaign_id !== requesterInfo.campaign_id) {
      return false;
    }

    // 1. Direct parent sovereignty: if the requester is the direct parent of target, they can edit.
    if (target.parent_id === reqId) return true;

    // 2. Sovereignty for upper management over any users within their isolated campaign/list scope.
    // The previous block ensures they only see/modify users within their campaign_id constraint.
    if (reqRole === 'SUBJEFE' || reqRole === 'JEFE_CAMPANA' || reqRole === 'CANDIDATO') {
      if (target.role !== 'SUPERUSUARIO' && target.role !== 'JEFE_CAMPANA' && target.role !== 'CANDIDATO') {
        return true;
      }
    }

    return false;
  } catch (err) {
    console.error('Error in canModifyUser check:', err);
    return false;
  }
};

const isAllowedParent = (requesterId: string | number, requesterRole: string, parentId: string | number | null, createdRole: string): boolean => {
  const reqRole = requesterRole.toUpperCase().trim();
  if (reqRole === 'SUPERUSUARIO' || reqRole === 'SUPER_ADMIN') {
    return true;
  }
  
  const reqId = Number(requesterId);
  const pId = parentId ? Number(parentId) : null;
  
  // 1. If requester is PADRINO:
  if (reqRole === 'PADRINO') {
    return pId === reqId;
  }

  // 2. If requester is SUBJEFE:
  if (reqRole === 'SUBJEFE') {
    if (createdRole === 'PADRINO') {
      return pId === reqId;
    }
    if (createdRole === 'COORDINADOR' || createdRole === 'MIEMBRO_DE_MESA') {
      if (pId === reqId) return true;
      if (pId) {
        const parent = db.prepare('SELECT role, parent_id FROM users WHERE id = ?').get(pId) as any;
        return parent && parent.role === 'PADRINO' && parent.parent_id === reqId;
      }
    }
  }

  // 3. If requester is JEFE_CAMPANA:
  if (reqRole === 'JEFE_CAMPANA' || reqRole === 'CANDIDATO') {
    if (createdRole === 'SUBJEFE' || createdRole === 'PADRINO') {
      return pId === reqId;
    }
    if (createdRole === 'COORDINADOR' || createdRole === 'MIEMBRO_DE_MESA') {
      if (pId === reqId) return true;
      if (pId) {
        const parent = db.prepare('SELECT role, parent_id FROM users WHERE id = ?').get(pId) as any;
        return parent && parent.role === 'PADRINO' && parent.parent_id === reqId;
      }
    }
  }

  return false;
};

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
  let forcedListId: number | null = null;
  if (requesterRole !== 'SUPERUSUARIO' && requesterId) {
    const requesterInfo = getCachedUserInfo(requesterId);
    if (!requesterInfo?.campaign_id) {
      return res.status(403).json({ error: 'No tienes una campaña asignada. Contacta al administrador.' });
    }
    forcedCampaignId = requesterInfo.campaign_id;
    forcedListId = requesterInfo.assigned_list_id;
    const bodyAssigned = assigned_campaign_id || campaign_id;
    if (bodyAssigned && parseInt(bodyAssigned) !== forcedCampaignId) {
      return res.status(403).json({ error: 'No puedes crear usuarios en otra campaña.' });
    }
  }

  // Auto-assign and validate parent_id based on creator
  let finalParentId = parent_id ? Number(parent_id) : null;
  if (requesterRole !== 'SUPERUSUARIO' && requesterId) {
    const reqId = Number(requesterId);
    if (!finalParentId) {
      if (requesterRole === 'PADRINO') {
        finalParentId = reqId;
      } else if (requesterRole === 'SUBJEFE' && role === 'PADRINO') {
        finalParentId = reqId;
      } else if ((requesterRole === 'JEFE_CAMPANA' || requesterRole === 'CANDIDATO') && (role === 'SUBJEFE' || role === 'PADRINO')) {
        finalParentId = reqId;
      }
    }

    if (!isAllowedParent(reqId, requesterRole, finalParentId, role)) {
      return res.status(403).json({ error: 'No tienes permisos para asignar el superior/padre indicado para este usuario.' });
    }
  }

  // Inherit list and campaign if not provided
  const inputListId = assigned_list_id || list_id;
  let finalAssignedListId = (inputListId !== undefined && inputListId !== null && inputListId !== '') ? Number(inputListId) : null;
  
  if (!finalAssignedListId) {
    if (forcedListId) {
      finalAssignedListId = forcedListId;
    } else if (requesterId) {
      const requesterInfo = getCachedUserInfo(requesterId);
      if (requesterInfo?.assigned_list_id) {
        finalAssignedListId = requesterInfo.assigned_list_id;
      }
    }
    if (!finalAssignedListId && finalParentId) {
      const parentInfo = db.prepare('SELECT assigned_list_id FROM users WHERE id = ?').get(finalParentId) as any;
      if (parentInfo?.assigned_list_id) {
        finalAssignedListId = parentInfo.assigned_list_id;
      }
    }
  }

  let finalCampaignId = (assigned_campaign_id || campaign_id) ? Number(assigned_campaign_id || campaign_id) : null;
  if (forcedCampaignId) {
    finalCampaignId = forcedCampaignId;
  }
  if (!finalCampaignId) {
    if (requesterId) {
      const requesterInfo = getCachedUserInfo(requesterId);
      if (requesterInfo?.campaign_id) {
        finalCampaignId = requesterInfo.campaign_id;
      }
    }
    if (!finalCampaignId && finalParentId) {
      const parentInfo = db.prepare('SELECT assigned_campaign_id FROM users WHERE id = ?').get(finalParentId) as any;
      if (parentInfo?.assigned_campaign_id) {
        finalCampaignId = parentInfo.assigned_campaign_id;
      }
    }
    if (!finalCampaignId && finalAssignedListId) {
      const listInfo = db.prepare('SELECT campaign_id FROM lists WHERE id = ?').get(finalAssignedListId) as any;
      if (listInfo?.campaign_id) {
        finalCampaignId = listInfo.campaign_id;
      }
    }
  }

  // If list is still not assigned, fall back to the first list of the campaign
  if (!finalAssignedListId && finalCampaignId) {
    const firstList = db.prepare('SELECT id FROM lists WHERE campaign_id = ? LIMIT 1').get(finalCampaignId) as any;
    if (firstList) {
      finalAssignedListId = firstList.id;
    }
  }

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

    let distrito = req.body.distrito;
    if (!distrito) {
      if (finalAssignedListId) {
        const origin = db.prepare('SELECT ciudad as distrito FROM lists WHERE id = ?').get(finalAssignedListId) as any;
        distrito = origin?.distrito;
      }
      if (!distrito && finalCampaignId) {
        const origin = db.prepare('SELECT distrito FROM campaigns WHERE id = ?').get(finalCampaignId) as any;
        distrito = origin?.distrito;
      }
      if (!distrito && requesterId) {
        const requesterInfo = getCachedUserInfo(requesterId);
        distrito = requesterInfo?.distrito;
      }
      if (!distrito && finalParentId) {
        const parentInfo = db.prepare('SELECT distrito FROM users WHERE id = ?').get(finalParentId) as any;
        distrito = parentInfo?.distrito;
      }
    }

    const result = db.prepare(`
      INSERT INTO users (username, password, role, assigned_list_id, assigned_campaign_id, assigned_local, assigned_mesa, nombre, photo_url, parent_id, telefono, ci, needs_password_change, distrito)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)
    `).run(
      finalUsername,
      finalPassword,
      role,
      finalAssignedListId,
      finalCampaignId,
      req.body.assigned_local || null,
      req.body.assigned_mesa || null,
      nombre,
      photo_url || null,
      finalParentId,
      telefono || null,
      cleanCI,
      distrito || null
    );
    
    logAction(1, 'CREATE', 'USER', Number(result.lastInsertRowid), `Created user ${finalUsername} with role ${role}`);
    invalidateAllReportsCaches();
    res.json({ id: Number(result.lastInsertRowid), success: true });
  } catch (err: any) {
    console.error("Error creating user:", err);
    res.status(500).json({ error: err.message.includes('UNIQUE constraint failed') ? 'El nombre de usuario o C.I. ya existe.' : err.message });
  }
});

app.get('/api/users', (req, res) => {
  const requesterId = req.headers['x-user-id'] as string;
  const role = getRole(req);

  try {
    let limitStr = '';
    let offsetStr = '';
    const limit = parseInt(req.query.limit as string);
    const offset = parseInt(req.query.offset as string);
    if (!isNaN(limit)) {
      limitStr = ` LIMIT ${limit}`;
      if (!isNaN(offset)) {
         offsetStr = ` OFFSET ${offset}`;
      }
    } else {
      // Default safety limit for massive tables
      limitStr = ` LIMIT 1500`;
    }

    // Optimization: If parent_id is requested and requester is authorized, query directly without slow OR EXISTS security filter
    if (req.query.parent_id) {
      const parentId = String(req.query.parent_id);
      let isAuthorized = false;

      if (parentId === requesterId) {
        isAuthorized = true;
      } else if (role === 'SUPERUSUARIO' || role === 'SUPER_ADMIN') {
        isAuthorized = true;
      } else if (role === 'JEFE_CAMPANA' || role === 'SUBJEFE') {
        const requesterInfo = getCachedUserInfo(requesterId);
        const targetParentInfo = getCachedUserInfo(parentId);
        if (requesterInfo && targetParentInfo) {
          const campaignMatch = !requesterInfo.campaign_id || !targetParentInfo.campaign_id || requesterInfo.campaign_id === targetParentInfo.campaign_id;
          const districtMatch = !requesterInfo.distrito || !targetParentInfo.distrito || requesterInfo.distrito.toUpperCase().trim() === targetParentInfo.distrito.toUpperCase().trim();
          if (campaignMatch && districtMatch) {
            isAuthorized = true;
          }
        }
      }

      if (isAuthorized) {
        const query = `
          SELECT 
            u.id, u.username, u.role, u.assigned_list_id, u.assigned_campaign_id,
            u.assigned_local, u.assigned_mesa, u.nombre, NULL as photo_url,
            u.needs_password_change, u.parent_id, u.telefono, u.distrito, u.ci, u.status, u.enabled_modules, 
            l.list_number, 
            l.type as list_type, 
            COALESCE(c1.id, c2.id) as effective_campaign_id,
            COALESCE(c1.name, c2.name) as campaign_name,
            p.nombre as parent_name
          FROM users u
          LEFT JOIN lists l ON u.assigned_list_id = l.id
          LEFT JOIN campaigns c1 ON l.campaign_id = c1.id
          LEFT JOIN campaigns c2 ON u.assigned_campaign_id = c2.id
          LEFT JOIN users p ON u.parent_id = p.id
          WHERE u.parent_id = ?
        `;
        const users = db.prepare(query + limitStr + offsetStr).all(parentId);
        console.log(`[ADMIN] Sirviendo ${users.length} usuarios por parent_id (bypass filtro de distrito).`);
        return res.json(users);
      }
    }

    // Fallback: Standard query with sec.sql filter
    const sec = getSecurityFilter(req, 'u');
    const params = sec.params || [];
    let query = `
      SELECT 
        u.id, u.username, u.role, u.assigned_list_id, u.assigned_campaign_id,
        u.assigned_local, u.assigned_mesa, u.nombre, NULL as photo_url,
        u.needs_password_change, u.parent_id, u.telefono, u.distrito, u.ci, u.status, u.enabled_modules, 
        l.list_number, 
        l.type as list_type, 
        COALESCE(c1.id, c2.id) as effective_campaign_id,
        COALESCE(c1.name, c2.name) as campaign_name,
        p.nombre as parent_name
      FROM users u
      LEFT JOIN lists l ON u.assigned_list_id = l.id
      LEFT JOIN campaigns c1 ON l.campaign_id = c1.id
      LEFT JOIN campaigns c2 ON u.assigned_campaign_id = c2.id
      LEFT JOIN users p ON u.parent_id = p.id
      WHERE 1=1 ${sec.sql}
    `;
    
    let users;
    if (req.query.parent_id) {
      users = db.prepare(query + ' AND u.parent_id = ?' + limitStr + offsetStr).all(...params, req.query.parent_id);
    } else {
      users = db.prepare(query + limitStr + offsetStr).all(...params);
    }
    
    console.log(`[ADMIN] Sirviendo ${users.length} usuarios.`);
    res.json(users);
  } catch (err: any) {
    console.error('[ADMIN ERROR] Fallo al listar usuarios:', err);
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/users/:id', (req, res) => {
  const requesterRole = (req.headers['x-user-role'] as string || '').toUpperCase().trim();
  const requesterId   = req.headers['x-user-id'] as string;
  const userId = req.params.id;

  try {
    const userToDelete = db.prepare('SELECT username FROM users WHERE id = ?').get(userId) as any;
    if (userToDelete?.username === 'admin') {
      return res.status(403).json({ error: 'No se puede eliminar al administrador maestro (admin).' });
    }

    const user = db.prepare('SELECT id, role, parent_id FROM users WHERE id = ?').get(userId) as any;
    if (!user) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    if (requesterRole !== 'SUPERUSUARIO' && requesterId) {
      if (!canModifyUser(requesterId, requesterRole, userId)) {
        return res.status(403).json({ error: 'No tienes permisos para eliminar este usuario.' });
      }
      
      if (user.role === 'PADRINO') {
        if (!['JEFE_CAMPANA', 'SUBJEFE', 'CANDIDATO'].includes(requesterRole)) {
          return res.status(403).json({ error: 'Solo Jefes y Subjefes de campaña pueden eliminar Padrinos.' });
        }
      }
    }

    const capturesAction = req.query.action as string;

    const transaction = db.transaction(() => {
      db.prepare('PRAGMA foreign_keys = OFF').run();
      
      // 1. Handle elector_captures based on action
      if (capturesAction === 'delete') {
        db.prepare('DELETE FROM capture_conflicts WHERE capture_id IN (SELECT id FROM elector_captures WHERE coordinator_id = ?) OR capture_id_b IN (SELECT id FROM elector_captures WHERE coordinator_id = ?)').run(userId, userId);
        db.prepare('DELETE FROM elector_captures WHERE coordinator_id = ?').run(userId);
      } else if (capturesAction === 'inherit' && user.parent_id) {
        db.prepare('UPDATE elector_captures SET coordinator_id = ? WHERE coordinator_id = ?').run(user.parent_id, userId);
      } else {
        // Default behavior (nullify)
        db.prepare('UPDATE elector_captures SET coordinator_id = NULL WHERE coordinator_id = ?').run(userId);
      }
      
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
    invalidateAllReportsCaches();
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

// Admin: reset needs_password_change flag for users
app.post('/api/admin/reset-password-flags', (req, res) => {
  const requesterRole = (req.headers['x-user-role'] as string || '').toUpperCase().trim();
  if (requesterRole !== 'SUPERUSUARIO') {
    return res.status(403).json({ error: 'Solo Super Administradores pueden ejecutar esta acción.' });
  }
  try {
    const { role } = req.body; // optional filter by role
    let sql = 'UPDATE users SET needs_password_change = 0 WHERE needs_password_change = 1';
    let params: any[] = [];
    if (role) {
      sql += ' AND role = ?';
      params.push(role.toUpperCase());
    }
    const result = db.prepare(sql).run(...params);
    res.json({ success: true, updated: result.changes });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/users/:id', (req, res) => {
  const requesterRole = (req.headers['x-user-role'] as string || '').toUpperCase().trim();
  const requesterId   = req.headers['x-user-id'] as string;

  if (requesterRole !== 'SUPERUSUARIO' && requesterId) {
    if (!canModifyUser(requesterId, requesterRole, req.params.id)) {
      return res.status(403).json({ error: 'No tienes permisos para modificar este usuario.' });
    }
  }

  const { role, nombre, photo_url, parent_id, telefono, ci } = req.body;

  if (requesterRole !== 'SUPERUSUARIO' && requesterId) {
    const ALLOWED_ROLES_TO_CREATE: Record<string, string[]> = {
      JEFE_CAMPANA: ['PADRINO','SUBJEFE','COORDINADOR','MIEMBRO_DE_MESA'],
      PADRINO:      ['SUBJEFE','COORDINADOR','MIEMBRO_DE_MESA'],
      SUBJEFE:      ['PADRINO','COORDINADOR','MIEMBRO_DE_MESA'],
    };
    const allowed = ALLOWED_ROLES_TO_CREATE[requesterRole] || [];
    if (role && !allowed.includes(role.toUpperCase())) {
      return res.status(403).json({ error: `Tu rol (${requesterRole}) no puede asignar el rol ${role}.` });
    }

    if (parent_id !== undefined) {
      const finalParentId = parent_id ? Number(parent_id) : null;
      const targetRole = role || (db.prepare('SELECT role FROM users WHERE id = ?').get(req.params.id) as any)?.role;
      if (!isAllowedParent(Number(requesterId), requesterRole, finalParentId, targetRole)) {
        return res.status(403).json({ error: 'No tienes permisos para asignar el superior/padre indicado para este usuario.' });
      }
    }
  }

  const existingUser = db.prepare('SELECT role, assigned_list_id, assigned_campaign_id, parent_id, distrito FROM users WHERE id = ?').get(req.params.id) as any;
  if (!existingUser) {
    return res.status(404).json({ error: 'Usuario no encontrado' });
  }

  const cleanCI = ci ? ci.toString().replace(/\./g, '') : null;
  
  // Parent:
  let finalParentId = parent_id !== undefined ? (parent_id ? Number(parent_id) : null) : existingUser.parent_id;

  // List assignment:
  let finalAssignedListId = existingUser.assigned_list_id;
  const incomingListId = req.body.assigned_list_id;
  if (incomingListId !== undefined && incomingListId !== null && incomingListId !== '') {
    finalAssignedListId = Number(incomingListId);
  } else if (!finalAssignedListId) {
    if (requesterId) {
      const requesterInfo = getCachedUserInfo(requesterId);
      if (requesterInfo?.assigned_list_id) {
        finalAssignedListId = requesterInfo.assigned_list_id;
      }
    }
    if (!finalAssignedListId && finalParentId) {
      const parentInfo = db.prepare('SELECT assigned_list_id FROM users WHERE id = ?').get(finalParentId) as any;
      if (parentInfo?.assigned_list_id) {
        finalAssignedListId = parentInfo.assigned_list_id;
      }
    }
  }

  // Campaign assignment:
  let finalCampaignId = existingUser.assigned_campaign_id;
  const incomingCampaignId = req.body.assigned_campaign_id || req.body.campaign_id;
  if (incomingCampaignId !== undefined && incomingCampaignId !== null && incomingCampaignId !== '') {
    finalCampaignId = Number(incomingCampaignId);
  } else if (!finalCampaignId) {
    if (requesterId) {
      const requesterInfo = getCachedUserInfo(requesterId);
      if (requesterInfo?.campaign_id) {
        finalCampaignId = requesterInfo.campaign_id;
      }
    }
    if (!finalCampaignId && finalParentId) {
      const parentInfo = db.prepare('SELECT assigned_campaign_id FROM users WHERE id = ?').get(finalParentId) as any;
      if (parentInfo?.assigned_campaign_id) {
        finalCampaignId = parentInfo.assigned_campaign_id;
      }
    }
    if (!finalCampaignId && finalAssignedListId) {
      const listInfo = db.prepare('SELECT campaign_id FROM lists WHERE id = ?').get(finalAssignedListId) as any;
      if (listInfo?.campaign_id) {
        finalCampaignId = listInfo.campaign_id;
      }
    }
  }

  // District assignment:
  let distrito = req.body.distrito || existingUser.distrito;
  if (!distrito) {
    if (finalAssignedListId) {
      const origin = db.prepare('SELECT ciudad as distrito FROM lists WHERE id = ?').get(finalAssignedListId) as any;
      distrito = origin?.distrito;
    }
    if (!distrito && finalCampaignId) {
      const origin = db.prepare('SELECT distrito FROM campaigns WHERE id = ?').get(finalCampaignId) as any;
      distrito = origin?.distrito;
    }
    if (!distrito && requesterId) {
      const requesterInfo = getCachedUserInfo(requesterId);
      distrito = requesterInfo?.distrito;
    }
    if (!distrito && finalParentId) {
      const parentInfo = db.prepare('SELECT distrito FROM users WHERE id = ?').get(finalParentId) as any;
      distrito = parentInfo?.distrito;
    }
  }

  try {
    db.prepare(`
      UPDATE users 
      SET role = ?, assigned_list_id = ?, assigned_campaign_id = ?, assigned_local = ?, assigned_mesa = ?, nombre = ?, photo_url = ?, parent_id = ?, telefono = ?, ci = ?, distrito = COALESCE(?, distrito)
      WHERE id = ?
    `).run(
      role || existingUser.role, 
      finalAssignedListId, 
      finalCampaignId, 
      req.body.assigned_local || null, 
      req.body.assigned_mesa || null, 
      nombre, 
      photo_url, 
      finalParentId, 
      telefono || null, 
      cleanCI, 
      distrito || null,
      req.params.id
    );
    clearUserCache(req.params.id); // invalidate cache after update
    invalidateAllReportsCaches();
    logAction(1, 'UPDATE', 'USER', req.params.id, `Updated user ${nombre} (${role || existingUser.role})`);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});


app.post('/api/admin/users/:id/reset-password', (req, res) => {
  const requesterRole = (req.headers['x-user-role'] as string || '').toUpperCase().trim();
  const requesterId   = req.headers['x-user-id'] as string;

  if (requesterRole !== 'SUPERUSUARIO' && requesterId) {
    if (!canModifyUser(requesterId, requesterRole, req.params.id)) {
      return res.status(403).json({ error: 'No tienes permisos para resetear la contraseña de este usuario.' });
    }
  }

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

app.get('/api/stats/summary', async (req, res) => {
  try {
    const secU = getSecurityFilter(req, 'u');
    const secC = getSecurityFilter(req, 'c');
    const secL = getSecurityFilter(req, 'l');
    const secE = getSecurityFilter(req, 'e');
    const secEC = getSecurityFilter(req, 'ec');

    const campId = req.query.campaign_id;
    const cid = campId && !isNaN(parseInt(campId as string)) ? parseInt(campId as string) : null;

    let campFilterU = '';
    let campFilterC = '';
    let campFilterL = '';
    let campFilterE = '';
    let campFilterEC = '';

    const paramsU = [...(secU.params || [])];
    const paramsC = [...(secC.params || [])];
    const paramsL = [...(secL.params || [])];
    const paramsE = [...(secE.params || [])];
    const paramsEC = [...(secEC.params || [])];

    if (cid !== null) {
      campFilterU = ' AND u.assigned_campaign_id = ?';
      paramsU.push(cid);

      campFilterC = ' AND c.id = ?';
      paramsC.push(cid);

      campFilterL = ' AND l.campaign_id = ?';
      paramsL.push(cid);

      campFilterE = ' AND e.campaign_id = ?';
      paramsE.push(cid);

      campFilterEC = ' AND ec.campaign_id = ?';
      paramsEC.push(cid);
    }

    const usersCount = db.prepare(`SELECT COUNT(*) as count FROM users u WHERE 1=1 ${secU.sql}${campFilterU}`).get(...paramsU) as any;
    const campaignsCount = db.prepare(`SELECT COUNT(*) as count FROM campaigns c WHERE 1=1 ${secC.sql}${campFilterC}`).get(...paramsC) as any;
    const listsCount = db.prepare(`SELECT COUNT(*) as count FROM lists l WHERE 1=1 ${secL.sql}${campFilterL}`).get(...paramsL) as any;
    
    const cacheKey = JSON.stringify({ sql: secE.sql + campFilterE, params: paramsE });
    const cachedE = await cacheService.get<number>(`electors:count:${cacheKey}`);
    let electorsCountVal = 0;
    if (cachedE !== null) {
      electorsCountVal = cachedE;
    } else {
      const res = db.prepare(`SELECT COUNT(*) as count FROM electors e WHERE 1=1 ${secE.sql}${campFilterE}`).get(...paramsE) as any;
      electorsCountVal = res?.count || 0;
      await cacheService.set(`electors:count:${cacheKey}`, electorsCountVal, 300); // 5 minutes TTL
    }
    
    // Dynamic optimization: Skip heavy join on electors table if no district/elector filtering is active
    let query = `
      SELECT 
        COUNT(*) as captures,
        SUM(CASE WHEN ec.needs_transport = 1 THEN 1 ELSE 0 END) as transportNeeded,
        SUM(CASE WHEN ec.needs_transport = 1 AND ec.assigned_vehicle_id IS NOT NULL THEN 1 ELSE 0 END) as transportAssigned,
        SUM(CASE WHEN ec.traffic_light = 'GREEN' THEN 1 ELSE 0 END) as green,
        SUM(CASE WHEN ec.traffic_light = 'YELLOW' THEN 1 ELSE 0 END) as yellow,
        SUM(CASE WHEN ec.traffic_light = 'RED' THEN 1 ELSE 0 END) as red,
        SUM(CASE WHEN ec.traffic_light = 'PURPLE' THEN 1 ELSE 0 END) as purple
      FROM elector_captures ec
    `;

    if (secEC.sql.includes('e.ciudad') || secEC.sql.includes('e.distrito') || secEC.sql.includes('e.ci')) {
      query += ` LEFT JOIN electors e ON ec.elector_ci = e.ci WHERE 1=1 ${secEC.sql}`;
    } else {
      query += ` WHERE 1=1 ${secEC.sql.replace(/\be\./g, 'ec.')}`;
    }
    
    query += campFilterEC;

    const capturesStats = db.prepare(query).get(...paramsEC) as any;

    res.json({
      users: usersCount.count,
      campaigns: campaignsCount.count,
      lists: listsCount.count,
      electors: electorsCountVal,
      captures: capturesStats?.captures || 0,
      transportNeeded: capturesStats?.transportNeeded || 0,
      transportAssigned: capturesStats?.transportAssigned || 0,
      green: capturesStats?.green || 0,
      yellow: capturesStats?.yellow || 0,
      red: capturesStats?.red || 0,
      purple: capturesStats?.purple || 0
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
  const page = parseInt(req.query.page as string);
  if (isNaN(page) || page < 1) {
    return res.status(400).json({ error: 'La paginación es obligatoria. Especifique el parámetro "page".' });
  }

  const perPage = Math.min(parseInt(req.query.perPage as string) || 1000, 5000);
  const offset = (page - 1) * perPage;

  try {
    const logs = db.prepare(`
      SELECT a.timestamp, u.username, a.action, a.details
      FROM audit_logs a
      LEFT JOIN users u ON a.user_id = u.id
      ORDER BY a.timestamp DESC
      LIMIT ? OFFSET ?
    `).all(perPage, offset) as any[];
    
    let csv = '\uFEFFDate,User,Action,Details\n'; // Added BOM for Excel UTF-8 support
    logs.forEach(log => {
      csv += `"${log.timestamp}","${log.username || 'System'}","${log.action}","${log.details?.replace(/"/g, '""')}"\n`;
    });
    
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename=auditoria_pagina_${page}.csv`);
    res.status(200).send(csv);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/reports/export/xlsx', requireRole('SUPERUSUARIO','JEFE_CAMPANA','PADRINO','SUBJEFE'), (req, res) => {
  const columnsParam = req.query.columns as string;
  const districtParam = req.query.district as string;
  const trafficLightParam = req.query.traffic_light as string;
  const idsParam = req.query.ids as string;
  const listNumParam = req.query.list_number as string;

  const sec = getSecurityFilter(req, 'u');
  let whereClauses = ['1=1'];
  let params: any[] = [];

  // Security filters
  if (sec.sql) {
    whereClauses.push(sec.sql.replace(' AND ', ''));
    params.push(...sec.params);
  }

  // Query parameter filters
  if (districtParam && districtParam !== 'ALL' && districtParam !== 'GLOBAL') {
    whereClauses.push('(UPPER(e.distrito) = UPPER(?) OR UPPER(u.distrito) = UPPER(?))');
    params.push(districtParam, districtParam);
  }

  if (trafficLightParam && trafficLightParam !== 'ALL') {
    whereClauses.push('ec.traffic_light = ?');
    params.push(trafficLightParam);
  }

  if (listNumParam && listNumParam !== 'ALL') {
    whereClauses.push('l.list_number = ?');
    params.push(listNumParam);
  }

  if (idsParam) {
    const ids = idsParam.split(',').map(id => parseInt(id)).filter(id => !isNaN(id));
    if (ids.length > 0) {
      whereClauses.push(`ec.id IN (${ids.map(() => '?').join(',')})`);
      params.push(...ids);
    }
  }

  try {
    const query = `
      SELECT 
        ec.id,
        COALESCE(e.nombre, 'ELECTOR') as nombre,
        COALESCE(e.apellido, 'NO REGISTRADO') as apellido,
        ec.elector_ci as ci,
        ec.telefono,
        ec.traffic_light as semaforo,
        (CASE WHEN ec.needs_transport = 1 THEN 'SI' ELSE 'NO' END) as transporte,
        COALESCE(u.nombre, '—') as coordinador,
        COALESCE(p.nombre, '—') as referente,
        COALESCE(e.local_votacion, 'REGISTRO DE CAMPO') as local,
        COALESCE(e.mesa, 0) as mesa,
        COALESCE(e.orden, 0) as orden,
        COALESCE(e.ciudad, '—') as ciudad,
        COALESCE(e.distrito, '—') as distrito
      FROM elector_captures ec
      LEFT JOIN electors e ON ec.elector_ci = e.ci
      LEFT JOIN users u ON ec.coordinator_id = u.id
      LEFT JOIN users p ON u.parent_id = p.id
      LEFT JOIN lists l ON ec.list_id = l.id
      WHERE ${whereClauses.join(' AND ')}
      ORDER BY ec.timestamp DESC
    `;

    const rows = db.prepare(query).all(...params) as any[];

    // Column filtering & header mapping
    const defaultColumns = [
      { key: 'nombre', header: 'Nombre' },
      { key: 'apellido', header: 'Apellido' },
      { key: 'ci', header: 'C.I.' },
      { key: 'telefono', header: 'Teléfono' },
      { key: 'semaforo', header: 'Semáforo' },
      { key: 'transporte', header: '¿Transporte?' },
      { key: 'coordinador', header: 'Coordinador' },
      { key: 'referente', header: 'Referente/Padrino' },
      { key: 'local', header: 'Local de Votación' },
      { key: 'mesa', header: 'Mesa' },
      { key: 'orden', header: 'Orden' },
      { key: 'ciudad', header: 'Ciudad' },
      { key: 'distrito', header: 'Distrito' }
    ];

    let columnsToExport = defaultColumns;
    if (columnsParam) {
      const selectedKeys = columnsParam.split(',');
      columnsToExport = defaultColumns.filter(c => selectedKeys.includes(c.key));
    }

    // Format data for sheet
    const sheetData = rows.map(row => {
      const formatted: any = {};
      columnsToExport.forEach(col => {
        formatted[col.header] = row[col.key];
      });
      return formatted;
    });

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(sheetData);
    XLSX.utils.book_append_sheet(wb, ws, 'Capturas');

    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=reporte_capturas.xlsx');
    res.end(buffer);
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
      SELECT v.*, u.nombre as coordinator_name, u.photo_url as coordinator_photo, u.telefono as coordinator_phone, u.distrito as coordinator_distrito, l.list_number,
             (SELECT COUNT(*) FROM elector_captures WHERE assigned_vehicle_id = v.id AND transport_status != 'COMPLETED') as current_passengers,
             (SELECT GROUP_CONCAT(COALESCE(e.nombre, 'ELECTOR') || ' ' || COALESCE(e.apellido, 'NO REGISTRADO'), ', ')
              FROM elector_captures ec
              LEFT JOIN electors e ON ec.elector_ci = e.ci
              WHERE ec.assigned_vehicle_id = v.id AND ec.transport_status = 'IN_TRANSIT') as passengers_in_transit,
             (SELECT GROUP_CONCAT(COALESCE(e.nombre, 'ELECTOR') || ' ' || COALESCE(e.apellido, 'NO REGISTRADO'), ', ')
              FROM elector_captures ec
              LEFT JOIN electors e ON ec.elector_ci = e.ci
              WHERE ec.assigned_vehicle_id = v.id AND ec.transport_status = 'PENDING') as passengers_pending
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
    db.prepare("UPDATE elector_captures SET assigned_vehicle_id = ?, transport_status = 'PENDING' WHERE id = ?").run(vehicle_id, capture_id);
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
        cc.elector_ci as elector_ci,
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
      CROSS JOIN electors e ON cc.elector_ci = e.ci
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

    const sec = getSecurityFilter(req, 'cc');
    const debugInfo = {
      role: req.headers['x-user-role'],
      user_id: req.headers['x-user-id'],
      district_q: req.query.district,
      district_h: req.headers['x-district'],
      list_id_q: req.query.listId,
      list_id_h: req.headers['x-list-id'],
      sec_sql: sec.sql,
      sec_params: sec.params,
    };
    console.log(`[CONFLICTS DEBUG]`, JSON.stringify(debugInfo));
    sql += ` ${sec.sql}`;
    params.push(...sec.params);

    const user_id = req.headers['x-user-id'] as string;
    const user = getCachedUserInfo(user_id);
    const role = (user?.role || req.headers['x-user-role'] as string || '').toUpperCase().trim();

    // ONLY filter by list_id for Subjefes/Contenders. Jefes de Campaña and SuperAdmins see ALL active conflicts in their district/campaign
    if (role === 'SUBJEFE' && list_id && !isNaN(list_id) && list_id !== 0) {
      sql += " AND (cc.list_id_a = ? OR cc.list_id_b = ?)";
      params.push(list_id, list_id);
    }

    console.log(`[CONFLICTS SQL] ${sql}`);
    console.log(`[CONFLICTS PARAMS]`, params);

    const conflicts = db.prepare(sql).all(...params) as any[];
    console.log(`[DB] Fetched ${conflicts.length} conflicts.`);

    // TEMP: Include debug info in response header so we can diagnose
    res.setHeader('X-Debug-Conflicts', JSON.stringify({ ...debugInfo, result_count: conflicts.length }));
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
        cc.elector_ci as elector_ci,
        COALESCE(e.nombre, 'ELECTOR') as elector_nombre,
        COALESCE(e.apellido, 'NO REGISTRADO') as elector_apellido,
        COALESCE(e.local_votacion, 'REGISTRO DE CAMPO') as local_votacion,
        COALESCE(e.mesa, 0) as mesa,
        
        COALESCE(u_win_1.nombre, u_win_2.nombre) as winner_name,
        COALESCE(u_win_1.role, u_win_2.role) as winner_role,
        p_win.nombre as padrino_name
      FROM capture_conflicts cc
      CROSS JOIN electors e ON cc.elector_ci = e.ci
      LEFT JOIN elector_captures ec_win_1 ON cc.winner_capture_id = ec_win_1.id
      LEFT JOIN elector_captures ec_win_2 ON cc.jefe_decision_id = ec_win_2.id
      LEFT JOIN users u_win_1 ON ec_win_1.coordinator_id = u_win_1.id
      LEFT JOIN users u_win_2 ON ec_win_2.coordinator_id = u_win_2.id
      LEFT JOIN users p_win ON COALESCE(u_win_1.parent_id, u_win_2.parent_id) = p_win.id
      WHERE cc.status = 'RESOLVED'
    `;
    const params: any[] = [];

    const sec = getSecurityFilter(req, 'cc_history');
    sql += ` ${sec.sql}`;
    params.push(...sec.params);

    if (district && district !== 'null' && district !== 'undefined') {
      sql += " AND (UPPER(TRIM(COALESCE(e.distrito, u_win_1.distrito, u_win_2.distrito))) LIKE UPPER(TRIM(?)) OR UPPER(TRIM(COALESCE(e.ciudad, u_win_1.distrito, u_win_2.distrito))) LIKE UPPER(TRIM(?)))";
      params.push(`%${district}%`, `%${district}%`);
    }

    const user_id = req.headers['x-user-id'] as string;
    const user = getCachedUserInfo(user_id);
    const role = (user?.role || req.headers['x-user-role'] as string || '').toUpperCase().trim();

    // ONLY filter by list_id for Subjefes/Contenders. Jefes de Campaña and SuperAdmins see ALL resolved conflicts
    if (role === 'SUBJEFE' && list_id && !isNaN(list_id) && list_id !== 0) {
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
      db.prepare("UPDATE capture_conflicts SET jefe_decision_id = ?, status = 'WAITING_CONSENT' WHERE id = ?")
        .run(winner_capture_id, conflict_id);

      // AUTO-CONSENT Logic:
      // 1. If it's an internal conflict (same list), the decision is final (no consent needed).
      // 2. If it's inter-list, we auto-consent ONLY for lists that have NO SUBJEFE.
      if (conflict.list_id_a === conflict.list_id_b) {
          db.prepare('UPDATE capture_conflicts SET consent_a = 1, consent_b = 1 WHERE id = ?').run(conflict_id);
      } else {
          const user = getCachedUserInfo(user_id.toString());
          const lists = [conflict.list_id_a, conflict.list_id_b];
          lists.forEach((lid, idx) => {
              const hasSubjefe = lid ? db.prepare('SELECT 1 FROM users WHERE assigned_list_id = ? AND role = "SUBJEFE" LIMIT 1').get(lid) : null;
              if (!hasSubjefe || (user && user.assigned_list_id === lid)) {
                  const col = (idx === 0) ? 'consent_a' : 'consent_b';
                  db.prepare(`UPDATE capture_conflicts SET ${col} = 1 WHERE id = ?`).run(conflict_id);
              }
          });
      }

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
        db.prepare("UPDATE capture_conflicts SET status = 'RESOLVED', resolved_by_jefe_id = ?, winner_capture_id = ?, resolved_at = CURRENT_TIMESTAMP WHERE id = ?")
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
      FROM users u
      CROSS JOIN audit_logs al ON al.user_id = u.id
      WHERE 1=1 ${sec.sql}
      ORDER BY al.timestamp DESC LIMIT 50
    `).all(...sec.params);
    res.json(activities);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

function sanitizeElectorData(elector: any): any {
  if (!elector) return elector;
  const copy = { ...elector };

  // Names
  copy.nombre = copy.nombre ? copy.nombre.trim().toUpperCase() : 'SIN NOMBRE';
  copy.apellido = copy.apellido && copy.apellido.trim() !== '' ? copy.apellido.trim().toUpperCase() : 'DATO NO REGISTRADO';

  // CI
  copy.ci = copy.ci ? copy.ci.toString().trim() : 'DATO NO REGISTRADO';

  // local_votacion
  if (!copy.local_votacion || copy.local_votacion.trim() === '' || copy.local_votacion === '0' || copy.local_votacion.toLowerCase() === 'sin local' || copy.local_votacion.toLowerCase() === 'desconocido') {
    copy.local_votacion = 'DATO NO REGISTRADO';
  } else {
    copy.local_votacion = copy.local_votacion.trim().toUpperCase();
  }

  // mesa
  const rawMesa = parseInt(copy.mesa) || 0;
  copy.mesa = rawMesa === 0 ? 'DATO NO REGISTRADO' : rawMesa;

  // orden
  const rawOrden = parseInt(copy.orden) || 0;
  copy.orden = rawOrden === 0 ? 'DATO NO REGISTRADO' : rawOrden;

  // ciudad
  if (!copy.ciudad || copy.ciudad.trim() === '' || copy.ciudad === '0') {
    copy.ciudad = 'DATO NO REGISTRADO';
  } else {
    copy.ciudad = copy.ciudad.trim().toUpperCase();
  }

  // distrito
  if (!copy.distrito || copy.distrito.trim() === '' || copy.distrito === '0') {
    copy.distrito = 'DATO NO REGISTRADO';
  } else {
    copy.distrito = copy.distrito.trim().toUpperCase();
  }

  // barrio
  if (!copy.barrio || copy.barrio.trim() === '' || copy.barrio === '0' || copy.barrio.toLowerCase() === 'sin barrio' || copy.barrio.toLowerCase() === 'no registrado' || copy.barrio.toLowerCase() === 'no asignado') {
    copy.barrio = 'DATO NO REGISTRADO';
  } else {
    copy.barrio = copy.barrio.trim().toUpperCase();
  }

  // direccion
  if (!copy.direccion || copy.direccion.trim() === '' || copy.direccion === '0' || copy.direccion.toLowerCase() === 'sin direccion' || copy.direccion.toLowerCase() === 'no registrada' || copy.direccion.toLowerCase() === 'no asignada') {
    copy.direccion = 'DATO NO REGISTRADO';
  } else {
    copy.direccion = copy.direccion.trim().toUpperCase();
  }

  return copy;
}

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
      const safeDistrito = user.distrito.replace(/'/g, "''");
      cityFilter = `AND (e.distrito = '${safeDistrito}' OR e.ciudad = '${safeDistrito}')`;
    }
  }

    const queryStr = q ? q.toString().trim() : '';
    const isNumber = /^\d+$/.test(queryStr);
    
    let electors;
    if (isNumber) {
      // Direct, indexed search by Primary Key CI - extremely fast (0ms)
      electors = db.prepare(`
        SELECT e.*, ec.traffic_light, ec.id as capture_id, ec.telefono, ec.needs_transport, ec.lat, ec.lng, ec.coordinator_id, u.nombre as coordinator_name, u.role as coordinator_role
        FROM electors e
        LEFT JOIN elector_captures ec ON e.ci = ec.elector_ci AND ec.is_disputed = 0
        LEFT JOIN users u ON ec.coordinator_id = u.id
        WHERE e.ci = ? ${cityFilter}
        LIMIT 100
      `).all(queryStr);
    } else {
      // Split search term by spaces to search by both first and last name if provided, which is much faster and more precise!
      const parts = queryStr.split(/\s+/).filter(Boolean);
      if (parts.length >= 2) {
        // Search by first term in name, second in surname, or vice versa
        const p1 = `%${parts[0]}%`;
        const p2 = `%${parts[1]}%`;
        electors = db.prepare(`
          SELECT e.*, ec.traffic_light, ec.id as capture_id, ec.telefono, ec.needs_transport, ec.lat, ec.lng, ec.coordinator_id, u.nombre as coordinator_name, u.role as coordinator_role
          FROM electors e
          LEFT JOIN elector_captures ec ON e.ci = ec.elector_ci AND ec.is_disputed = 0
          LEFT JOIN users u ON ec.coordinator_id = u.id
          WHERE ((e.nombre LIKE ? AND e.apellido LIKE ?) OR (e.nombre LIKE ? AND e.apellido LIKE ?)) ${cityFilter}
          LIMIT 100
        `).all(p1, p2, p2, p1);
      } else {
        const term = `%${queryStr}%`;
        electors = db.prepare(`
          SELECT e.*, ec.traffic_light, ec.id as capture_id, ec.telefono, ec.needs_transport, ec.lat, ec.lng, ec.coordinator_id, u.nombre as coordinator_name, u.role as coordinator_role
          FROM electors e
          LEFT JOIN elector_captures ec ON e.ci = ec.elector_ci AND ec.is_disputed = 0
          LEFT JOIN users u ON ec.coordinator_id = u.id
          WHERE (e.nombre LIKE ? OR e.apellido LIKE ? OR e.ci LIKE ?) ${cityFilter}
          LIMIT 100
        `).all(term, term, term);
      }
    }
    res.json((electors as any[]).map(sanitizeElectorData));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/admin/verify-phone/:phone', (req, res) => {
  try {
    const rawPhone = req.params.phone;
    const cleanPhone = rawPhone.includes('@') ? rawPhone.split('@')[0] : rawPhone;
    const hash = normalizePhone(cleanPhone);

    if (!hash) return res.status(400).json({ error: 'Teléfono inválido' });

    const elector = db.prepare(`
      SELECT e.*, ec.traffic_light, ec.needs_transport, ec.lat, ec.lng,
             u.nombre as coordinator_name, u.role as coordinator_role, u.telefono as coordinator_phone,
             p.nombre as parent_name, p.role as parent_role, p.telefono as parent_phone,
             gp.nombre as grandparent_name, gp.role as grandparent_role, gp.telefono as grandparent_phone,
             l.list_number, l.candidate_nombre as candidate_name
      FROM electors e
      JOIN elector_captures ec ON e.ci = ec.elector_ci
      LEFT JOIN users u ON ec.coordinator_id = u.id
      LEFT JOIN users p ON u.parent_id = p.id
      LEFT JOIN users gp ON p.parent_id = gp.id
      LEFT JOIN lists l ON ec.list_id = l.id
      WHERE ec.phone_hash = ?
      LIMIT 1
    `).get(hash) as any;

    if (elector) {
      return res.json({ type: 'ELECTOR', data: sanitizeElectorData(elector) });
    }

    const user = db.prepare(`
      SELECT u.id, u.username, u.role, u.nombre, u.ci, u.telefono, u.distrito,
             p.nombre as parent_name, p.role as parent_role, p.telefono as parent_phone,
             gp.nombre as grandparent_name, gp.role as grandparent_role, gp.telefono as grandparent_phone
      FROM users u
      LEFT JOIN users p ON u.parent_id = p.id
      LEFT JOIN users gp ON p.parent_id = gp.id
      WHERE u.phone_hash = ?
      LIMIT 1
    `).get(hash) as any;

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
    
    // 1. Dynamically locate the header row (skips title or blank rows at the top)
    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as any[][];
    let headerRowIndex = 0;
    
    for (let r = 0; r < Math.min(rows.length, 20); r++) {
      const row = rows[r];
      if (!row) continue;
      const isHeader = row.some(cell => {
        if (cell === null || cell === undefined) return false;
        const s = cell.toString().toUpperCase().trim().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[º°]/g, "");
        return s === 'CEDULA' || s === 'CI' || s === 'DOCUMENTO' || s === 'APELLIDO' || s === 'NOMBRE' || s === 'MESA';
      });
      if (isHeader) {
        headerRowIndex = r;
        break;
      }
    }
    
    // 2. Read the sheet content starting at the detected header row
    const data: any[] = XLSX.utils.sheet_to_json(sheet, { range: headerRowIndex });

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
          // Normalize and strip standard unicode markers like º and °
          const cleanKey = key.toUpperCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[º°]/g, "").trim().replace(/\s+/g, "_").replace(/\./g, "");
          normalizedRow[cleanKey] = row[key];
        }

        const ci = normalizedRow['CEDULA'] || normalizedRow['CI'] || normalizedRow['DOCUMENTO'] || normalizedRow['NRO_CEDULA'] || normalizedRow['CEDULA_DE_IDENTIDAD'];
        const nombre = normalizedRow['NOMBRE'] || normalizedRow['NOMBRES'];
        const apellido = normalizedRow['APELLIDO'] || normalizedRow['APELLIDOS'];
        const local = normalizedRow['LOCAL'] || normalizedRow['LOCAL_VOTACION'] || normalizedRow['LOCAL_DE_VOTACION'] || normalizedRow['RECINTO'] || normalizedRow['COLEGIO'];
        
        // Exhaustive fallbacks for MESA with integer coercion
        const rawMesa = normalizedRow['MESA'] || 
                        normalizedRow['NRO_MESA'] || 
                        normalizedRow['NUMERO_MESA'] || 
                        normalizedRow['MESA_NRO'] || 
                        normalizedRow['MESANRO'] || 
                        normalizedRow['MESA_NUM'] || 
                        normalizedRow['MESAS'] || 
                        normalizedRow['NRO_DE_MESA'] || 
                        normalizedRow['NUMERO_DE_MESA'] || 
                        normalizedRow['MESA_DE_VOTACION'] || 
                        normalizedRow['MESAS_NRO'] || 
                        normalizedRow['N_MESA'] || 
                        normalizedRow['N_DE_MESA'] || 
                        0;
        const mesa = parseInt(rawMesa.toString().trim()) || 0;
        
        // Exhaustive fallbacks for ORDEN (supporting all standard TSJE layouts) with integer coercion
        const rawOrden = normalizedRow['ORD_MESA'] || 
                         normalizedRow['ORDEN'] || 
                         normalizedRow['ORDEN_MESA'] || 
                         normalizedRow['NRO_ORDEN'] || 
                         normalizedRow['ORD'] || 
                         normalizedRow['NROORDEN'] || 
                         normalizedRow['ORDMESA'] || 
                         normalizedRow['NUMERO_ORDEN'] || 
                         normalizedRow['NUM_ORDEN'] || 
                         normalizedRow['NRO_ORD'] || 
                         normalizedRow['N_ORD'] || 
                         normalizedRow['N_ORDEN'] || 
                         normalizedRow['ORD_LOC'] || 
                         normalizedRow['ORD_NAC'] || 
                         normalizedRow['ORDEN_LOCAL'] || 
                         normalizedRow['ORDEN_NACIONAL'] || 
                         normalizedRow['NRO'] || 
                         normalizedRow['N'] || 
                         normalizedRow['LINEA'] || 
                         normalizedRow['POSICION'] || 
                         normalizedRow['POS'] || 
                         normalizedRow['NRO_DE_ORDEN'] || 
                         normalizedRow['ORDEN_DE_MESA'] || 
                         normalizedRow['ORD_DE_MESA'] || 
                         normalizedRow['NROORD'] || 
                         normalizedRow['ORD_MESA_NRO'] || 
                         normalizedRow['ORDEN_MESA_NRO'] || 
                         0;
        const orden = parseInt(rawOrden.toString().trim()) || 0;

        if (ci && (nombre || apellido)) {
          insertStmt.run(ci.toString().trim(), nombre || '', apellido || '', local || 'DESCONOCIDO', mesa, orden, finalDistrito, finalDistrito, effectiveCampaignId);
        }
      }
    });

    transaction(data);
    
    // Update padron last updated settings for PWA offline detection
    db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('padron_last_updated', ?)").run(Date.now().toString());
    
    clearElectorsCache();
    fs.unlinkSync(req.file.path);

    const actorId = requesterId ? parseInt(requesterId) : 1;
    logAction(actorId, 'IMPORT', 'PADRON', null, `Importados ${data.length} electores para ${finalDistrito} (campaign_id: ${effectiveCampaignId ?? 'global'})`);
    
    // Add parsed sample for debugging and confirmation in the API response
    const sample = data.slice(0, 5).map(row => {
      const normalizedRow: any = {};
      for (const key in row) {
        const cleanKey = key.toUpperCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[º°]/g, "").trim().replace(/\s+/g, "_").replace(/\./g, "");
        normalizedRow[cleanKey] = row[key];
      }
      const rawMesa = normalizedRow['MESA'] || 
                      normalizedRow['NRO_MESA'] || 
                      normalizedRow['NUMERO_MESA'] || 
                      normalizedRow['MESA_NRO'] || 
                      normalizedRow['MESANRO'] || 
                      normalizedRow['MESA_NUM'] || 
                      normalizedRow['MESAS'] || 
                      normalizedRow['NRO_DE_MESA'] || 
                      normalizedRow['NUMERO_DE_MESA'] || 
                      normalizedRow['MESA_DE_VOTACION'] || 
                      normalizedRow['MESAS_NRO'] || 
                      normalizedRow['N_MESA'] || 
                      normalizedRow['N_DE_MESA'] || 
                      0;
      const rawOrden = normalizedRow['ORD_MESA'] || 
                       normalizedRow['ORDEN'] || 
                       normalizedRow['ORDEN_MESA'] || 
                       normalizedRow['NRO_ORDEN'] || 
                       normalizedRow['ORD'] || 
                       normalizedRow['NROORDEN'] || 
                       normalizedRow['ORDMESA'] || 
                       normalizedRow['NUMERO_ORDEN'] || 
                       normalizedRow['NUM_ORDEN'] || 
                       normalizedRow['NRO_ORD'] || 
                       normalizedRow['N_ORD'] || 
                       normalizedRow['N_ORDEN'] || 
                       normalizedRow['ORD_LOC'] || 
                       normalizedRow['ORD_NAC'] || 
                       normalizedRow['ORDEN_LOCAL'] || 
                       normalizedRow['ORDEN_NACIONAL'] || 
                       normalizedRow['NRO'] || 
                       normalizedRow['N'] || 
                       normalizedRow['LINEA'] || 
                       normalizedRow['POSICION'] || 
                       normalizedRow['POS'] || 
                       normalizedRow['NRO_DE_ORDEN'] || 
                       normalizedRow['ORDEN_DE_MESA'] || 
                       normalizedRow['ORD_DE_MESA'] || 
                       normalizedRow['NROORD'] || 
                       normalizedRow['ORD_MESA_NRO'] || 
                       normalizedRow['ORDEN_MESA_NRO'] || 
                       0;
      return {
        ci: normalizedRow['CEDULA'] || normalizedRow['CI'] || normalizedRow['DOCUMENTO'],
        nombre: normalizedRow['NOMBRE'] || normalizedRow['NOMBRES'],
        apellido: normalizedRow['APELLIDO'] || normalizedRow['APELLIDOS'],
        mesa: parseInt(rawMesa.toString().trim()) || 0,
        orden: parseInt(rawOrden.toString().trim()) || 0
      };
    });

    res.json({ 
      success: true, 
      count: data.length, 
      campaign_id: effectiveCampaignId,
      sample
    });
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

app.get('/api/stats/command', async (req, res) => {
  const list_id = getListId(req);
  const local_id = (req.query.localId as string) || '';
  const role = getRole(req);
  const isPadrino = role === 'PADRINO';
  const requesterId = req.headers['x-user-id'];
  const sec = getSecurityFilter(req, 'e');
  const secL = getSecurityFilter(req, 'l');
  const secLoc = getSecurityFilter(req, 'loc');

  const district = getDistrict(req);
  const cacheKey = `${requesterId || 'global'}_${list_id || ''}_${local_id || ''}_${district || 'all'}`;
  const cached = await commandStatsCache.get(cacheKey);
  if (cached) {
    return res.json(cached);
  }
    
  // Dynamic goal: SUM(goal) from lists filtered by district/security, or specific list if requested
  let globalGoal = 1000;
  if (list_id && !isNaN(list_id)) {
    const listGoalRow = await dbGetAsync<any>(`SELECT goal FROM lists WHERE id = ?`, [list_id]);
    globalGoal = listGoalRow?.goal || 1000;
  } else {
    const listsGoal = await dbGetAsync<any>(`SELECT SUM(goal) as total FROM lists l WHERE 1=1 ${secL.sql}`, secL.params);
    const dbGoalSetting = await dbGetAsync<any>("SELECT value FROM settings WHERE key = 'goal'", []);
    globalGoal = Math.max(1, parseInt(listsGoal?.total || '0') || parseInt(dbGoalSetting?.value || '1000'));
  }
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
      LEFT JOIN electors e ON ec.elector_ci = e.ci
      LEFT JOIN users u ON ec.coordinator_id = u.id
      LEFT JOIN lists l ON ec.list_id = l.id
      LEFT JOIN campaigns c ON l.campaign_id = c.id
    `;
    const captureWhere = `
      WHERE ec.is_disputed = 0 ${sec.sql} ${listFilterSql} ${localFilterSql} ${hierarchyFilterSql}
    `;

    const stats = await dbQueryAsync<any>(`
      SELECT traffic_light, COUNT(*) as count ${captureJoins} ${captureWhere} GROUP BY traffic_light
    `, captureParams);

    const totalCaptures = await dbGetAsync<any>(`
      SELECT COUNT(*) as count ${captureJoins} ${captureWhere}
    `, captureParams);

    // --- OPTIMIZED STATIC/LIVE HYBRID ELECTORS CALCULATION ---
    const secElectors = getSecurityFilter(req, 'e');
    const electorParams = [...(secElectors.params || []), ...localFilterParams];
    const now = Date.now();

    // 1. Cached Total Electors
    const cacheKeyTotal = JSON.stringify({ sql: secElectors.sql, params: secElectors.params, localFilterSql, localFilterParams });
    let totalEl = 0;
    const cachedTotal = await cacheService.get<number>(`electors:total:${cacheKeyTotal}`);
    if (cachedTotal !== null) {
      totalEl = cachedTotal;
    } else {
      const elRes = await dbGetAsync<any>(`
        SELECT COUNT(*) as count FROM electors e
        WHERE 1=1 ${localFilterSql} ${secElectors.sql}
      `, electorParams);
      totalEl = elRes?.count || 0;
      await cacheService.set(`electors:total:${cacheKeyTotal}`, totalEl, 300);
    }

    // 2. Cached Elector Counts per Location
    const cacheKeyByLocal = JSON.stringify({ sql: secElectors.sql, params: secElectors.params });
    let electorCountsMap = new Map<string, number>();
    const cachedByLocal = await cacheService.get<Record<string, number>>(`electors:local:${cacheKeyByLocal}`);
    if (cachedByLocal !== null) {
      electorCountsMap = new Map(Object.entries(cachedByLocal));
    } else {
      const rows = await dbQueryAsync<{ local_votacion: string; total: number }>(`
        SELECT local_votacion, COUNT(*) as total
        FROM electors e WHERE 1=1 ${secElectors.sql}
        GROUP BY local_votacion
      `, secElectors.params);

      const newMap = new Map<string, number>();
      rows.forEach(r => {
        if (r.local_votacion) newMap.set(r.local_votacion.toUpperCase().trim(), r.total);
      });
      electorCountsMap = newMap;
      await cacheService.set(`electors:local:${cacheKeyByLocal}`, Object.fromEntries(newMap), 300);
    }

    // 3. Live Capture Counts per Location (Highly indexed, lightning fast)
    const capturesQuery = `
      SELECT COALESCE(e.local_votacion, 'REGISTRO DE CAMPO') as local_votacion,
        COUNT(ec.id) as total,
        SUM(CASE WHEN ec.traffic_light = 'GREEN' THEN 1 ELSE 0 END) as green
      FROM elector_captures ec
      LEFT JOIN electors e ON ec.elector_ci = e.ci
      LEFT JOIN users u ON ec.coordinator_id = u.id
      LEFT JOIN lists l ON ec.list_id = l.id
      LEFT JOIN campaigns c ON l.campaign_id = c.id
      WHERE ec.is_disputed = 0 ${sec.sql} ${listFilterSql} ${hierarchyFilterSql}
      GROUP BY COALESCE(e.local_votacion, 'REGISTRO DE CAMPO')
    `;
    const capturesParams = [
      ...(sec.params || []),
      ...listFilterParams,
      ...hierarchyFilterParams
    ];
    const liveCapturesList = await dbQueryAsync<any>(capturesQuery, capturesParams);
    
    const capturesMap = new Map<string, { total: number; green: number }>();
    liveCapturesList.forEach(c => {
      if (c.local_votacion) {
        capturesMap.set(c.local_votacion.toUpperCase().trim(), { total: c.total, green: c.green || 0 });
      }
    });

    // 4. Fetch voting locations
    const locations = await dbQueryAsync<any>(`SELECT cod_local, nombre FROM voting_locations loc WHERE 1=1 ${secLoc.sql}`, secLoc.params || []);

    // 5. Merge stats in memory (O(N) lookup)
    const locationStats = locations.map(loc => {
      const nameKey = (loc.nombre || '').toUpperCase().trim();
      const total_electors = electorCountsMap.get(nameKey) || 0;
      const capInfo = capturesMap.get(nameKey) || { total: 0, green: 0 };
      return {
        cod_local: loc.cod_local,
        nombre: loc.nombre,
        total_electors,
        total_captures: capInfo.total,
        green_captures: capInfo.green
      };
    });

    const transportNeeded = await dbGetAsync<any>(`
      SELECT COUNT(*) as count ${captureJoins} ${captureWhere} AND ec.needs_transport = 1
    `, captureParams);

    const totalCap = totalCaptures?.count || 0;
    const responseData = {
      green:   stats.find(s => s.traffic_light === 'GREEN')?.count  || 0,
      yellow:  stats.find(s => s.traffic_light === 'YELLOW')?.count || 0,
      red:     stats.find(s => s.traffic_light === 'RED')?.count    || 0,
      purple:  stats.find(s => s.traffic_light === 'PURPLE')?.count || 0,
      transport_needed: transportNeeded?.count || 0,
      total_captures: totalCap,
      total_electors: totalEl,
      campaign_goal: globalGoal,
      percentage: totalEl > 0 ? ((totalCap / totalEl) * 100).toFixed(1) : '0',
      locations: locationStats.map(loc => ({
        ...loc,
        percentage: loc.total_electors > 0
          ? ((loc.total_captures / loc.total_electors) * 100).toFixed(1)
          : '0',
      })),
    };

    await commandStatsCache.set(cacheKey, responseData);
    res.json(responseData);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  } finally {
    console.timeEnd(`STATS_COMMAND_${requesterId}`);
  }
});


app.get('/api/padrino/team-stats', (req, res) => {
  const padrino_id = req.query.padrino_id as string;
  const requesterId = req.headers['x-user-id'] as string;
  const role = getRole(req);

  try {
    // Determine if we should bypass the slow security filter
    let isAuthorized = false;
    if (padrino_id) {
      if (padrino_id === requesterId) {
        isAuthorized = true;
      } else if (role === 'SUPERUSUARIO' || role === 'SUPER_ADMIN') {
        isAuthorized = true;
      } else if (role === 'JEFE_CAMPANA' || role === 'SUBJEFE') {
        const requesterInfo = getCachedUserInfo(requesterId);
        const targetPadrinoInfo = getCachedUserInfo(padrino_id);
        if (requesterInfo && targetPadrinoInfo) {
          const campaignMatch = !requesterInfo.campaign_id || !targetPadrinoInfo.campaign_id || requesterInfo.campaign_id === targetPadrinoInfo.campaign_id;
          const districtMatch = !requesterInfo.distrito || !targetPadrinoInfo.distrito || requesterInfo.distrito.toUpperCase().trim() === targetPadrinoInfo.distrito.toUpperCase().trim();
          if (campaignMatch && districtMatch) {
            isAuthorized = true;
          }
        }
      }
    }

    if (padrino_id && isAuthorized) {
      // Direct, indexed search by parent_id using subqueries - extremely fast (0ms)
      const stats = db.prepare(`
        SELECT 
          u.id, u.nombre, u.username, u.photo_url, u.telefono, u.distrito,
          (SELECT COUNT(*) FROM elector_captures ec WHERE ec.coordinator_id = u.id) as total_electors,
          (SELECT COUNT(*) FROM elector_captures ec WHERE ec.coordinator_id = u.id AND ec.traffic_light = 'GREEN') as green,
          (SELECT COUNT(*) FROM elector_captures ec WHERE ec.coordinator_id = u.id AND ec.traffic_light = 'YELLOW') as yellow,
          (SELECT COUNT(*) FROM elector_captures ec WHERE ec.coordinator_id = u.id AND ec.traffic_light = 'RED') as red,
          (SELECT COUNT(*) FROM elector_captures ec WHERE ec.coordinator_id = u.id AND ec.traffic_light = 'PURPLE') as purple,
          (SELECT COUNT(*) FROM elector_captures ec WHERE ec.coordinator_id = u.id AND ec.needs_transport = 1) as transport_needed
        FROM users u
        WHERE u.role IN ('COORDINADOR', 'MIEMBRO_DE_MESA') AND u.parent_id = ?
      `).all(padrino_id);
      
      return res.json(stats);
    }

    // Fallback to original slower path with security filter if queried without padrino_id or not explicitly authorized
    const sec = getSecurityFilter(req, 'u');
    let whereClause = "u.role IN ('COORDINADOR', 'MIEMBRO_DE_MESA')";
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
             (SELECT COUNT(*) FROM users u2 WHERE u2.parent_id = u.id AND u2.role IN ('COORDINADOR', 'MIEMBRO_DE_MESA')) AS coordinator_count,
             ((SELECT COUNT(*) FROM elector_captures ec WHERE ec.coordinator_id = u.id) + 
              (SELECT COUNT(*) FROM elector_captures ec WHERE ec.coordinator_id IN (SELECT id FROM users WHERE parent_id = u.id))) AS total_electors,
             ((SELECT COUNT(*) FROM elector_captures ec WHERE ec.coordinator_id = u.id AND ec.needs_transport = 1) + 
              (SELECT COUNT(*) FROM elector_captures ec WHERE ec.coordinator_id IN (SELECT id FROM users WHERE parent_id = u.id) AND ec.needs_transport = 1)) AS transport_total,
             ((SELECT COUNT(*) FROM elector_captures ec WHERE ec.coordinator_id = u.id AND ec.traffic_light = 'GREEN') + 
              (SELECT COUNT(*) FROM elector_captures ec WHERE ec.coordinator_id IN (SELECT id FROM users WHERE parent_id = u.id) AND ec.traffic_light = 'GREEN')) AS green_total,
             ((SELECT COUNT(*) FROM elector_captures ec WHERE ec.coordinator_id = u.id AND ec.traffic_light = 'YELLOW') + 
              (SELECT COUNT(*) FROM elector_captures ec WHERE ec.coordinator_id IN (SELECT id FROM users WHERE parent_id = u.id) AND ec.traffic_light = 'YELLOW')) AS yellow_total,
             ((SELECT COUNT(*) FROM elector_captures ec WHERE ec.coordinator_id = u.id AND ec.traffic_light = 'RED') + 
              (SELECT COUNT(*) FROM elector_captures ec WHERE ec.coordinator_id IN (SELECT id FROM users WHERE parent_id = u.id) AND ec.traffic_light = 'RED')) AS red_total,
             ((SELECT COUNT(*) FROM elector_captures ec WHERE ec.coordinator_id = u.id AND ec.traffic_light = 'PURPLE') + 
              (SELECT COUNT(*) FROM elector_captures ec WHERE ec.coordinator_id IN (SELECT id FROM users WHERE parent_id = u.id) AND ec.traffic_light = 'PURPLE')) AS purple_total
       FROM users u
       LEFT JOIN lists l ON u.assigned_list_id = l.id
       WHERE u.role IN ('PADRINO', 'SUBJEFE') ${sec.sql}
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
      WITH coordinator_ids AS (
        SELECT id FROM users WHERE parent_id = ? AND role IN ('COORDINADOR', 'MIEMBRO_DE_MESA')
      ),
      stats AS (
        SELECT 
          coordinator_id,
          COUNT(*) as total_electors,
          SUM(CASE WHEN traffic_light='GREEN' THEN 1 ELSE 0 END) as green,
          SUM(CASE WHEN traffic_light='YELLOW' THEN 1 ELSE 0 END) as yellow,
          SUM(CASE WHEN traffic_light='RED' THEN 1 ELSE 0 END) as red,
          SUM(CASE WHEN traffic_light='PURPLE' THEN 1 ELSE 0 END) as purple,
          SUM(CASE WHEN needs_transport=1 THEN 1 ELSE 0 END) as transport_total
        FROM elector_captures
        WHERE coordinator_id IN (SELECT id FROM coordinator_ids)
        GROUP BY coordinator_id
      )
      SELECT u.id, u.nombre, u.photo_url, u.telefono,
             COALESCE(s.total_electors, 0) as total_electors,
             COALESCE(s.green, 0) as green,
             COALESCE(s.yellow, 0) as yellow,
             COALESCE(s.red, 0) as red,
             COALESCE(s.purple, 0) as purple,
             COALESCE(s.transport_total, 0) as transport_total
      FROM users u
      LEFT JOIN stats s ON u.id = s.coordinator_id
      WHERE u.parent_id = ? AND u.role IN ('COORDINADOR', 'MIEMBRO_DE_MESA')
      ORDER BY u.nombre
    `).all(id, id);

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
      WITH captures AS MATERIALIZED (
        SELECT * FROM elector_captures WHERE coordinator_id = ?
      )
      SELECT ec.id,
             COALESCE(e.nombre, 'ELECTOR') as nombre, 
             COALESCE(e.apellido, 'NO REGISTRADO') as apellido, 
             ec.elector_ci, 
             COALESCE(e.local_votacion, 'REGISTRO DE CAMPO') as local_votacion, 
             COALESCE(e.mesa, 0) as mesa, 
             COALESCE(e.orden, 0) as orden,
             ec.traffic_light, ec.needs_transport, ec.telefono
      FROM captures ec
      LEFT JOIN electors e ON ec.elector_ci = e.ci
    `).all(id);
    res.json(electors);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/structure/padrinos/:id/full-report', async (req, res) => {
  const { id } = req.params;
  let maxElectors = parseInt(req.query.maxElectors as string);
  if (isNaN(maxElectors) || maxElectors <= 0) {
      maxElectors = 2000;
  }
  const cacheKey = `${id}_${maxElectors}`;
  const cached = await fullReportCache.get(cacheKey);
  if (cached) {
    return res.json(cached);
  }

  try {
    const padrino = await dbGetAsync<any>(`
      SELECT u.nombre, l.list_number, l.option_number, u.distrito
      FROM users u
      LEFT JOIN lists l ON u.assigned_list_id = l.id
      WHERE u.id = ?
    `, [id]);

    if (!padrino) return res.status(404).json({ error: 'Padrino no encontrado' });

    const coordinators = await dbQueryAsync<any>(`
      WITH coordinator_ids AS (
        SELECT id FROM users WHERE parent_id = ? AND role IN ('COORDINADOR', 'MIEMBRO_DE_MESA')
      ),
      coord_stats AS (
        SELECT coordinator_id,
               COUNT(id) as total_electors,
               SUM(CASE WHEN traffic_light = 'GREEN' THEN 1 ELSE 0 END) as green,
               SUM(CASE WHEN traffic_light = 'YELLOW' THEN 1 ELSE 0 END) as yellow,
               SUM(CASE WHEN traffic_light = 'RED' THEN 1 ELSE 0 END) as red,
               SUM(CASE WHEN traffic_light = 'PURPLE' THEN 1 ELSE 0 END) as purple,
               SUM(CASE WHEN needs_transport = 1 THEN 1 ELSE 0 END) as transport_needed
        FROM elector_captures
        WHERE coordinator_id IN (SELECT id FROM coordinator_ids)
        GROUP BY coordinator_id
      )
      SELECT u.id, u.nombre, u.telefono,
             COALESCE(cs.total_electors, 0) as total_electors,
             COALESCE(cs.green, 0) as green,
             COALESCE(cs.yellow, 0) as yellow,
             COALESCE(cs.red, 0) as red,
             COALESCE(cs.purple, 0) as purple,
             COALESCE(cs.transport_needed, 0) as transport_needed
      FROM users u
      LEFT JOIN coord_stats cs ON cs.coordinator_id = u.id
      WHERE u.parent_id = ? AND u.role IN ('COORDINADOR', 'MIEMBRO_DE_MESA')
    `, [id, id]);

    const fullHierarchy = await Promise.all(coordinators.map(async (c: any) => {
      const electors = await dbQueryAsync<any>(`
        WITH captures AS MATERIALIZED (
          SELECT * FROM elector_captures WHERE coordinator_id = ?
        )
        SELECT COALESCE(e.nombre, 'ELECTOR') as nombre,
               COALESCE(e.apellido, 'NO REGISTRADO') as apellido,
               ec.elector_ci,
               COALESCE(e.local_votacion, 'REGISTRO DE CAMPO') as local_votacion,
               COALESCE(e.mesa, 0) as mesa,
               COALESCE(e.orden, 0) as orden,
               ec.traffic_light, ec.needs_transport, ec.telefono
        FROM captures ec
        LEFT JOIN electors e ON ec.elector_ci = e.ci
      `, [c.id]);
      return { ...c, electors };
    }));

    const responseData = {
      padrino,
      coordinators: fullHierarchy,
      timestamp: new Date().toISOString()
    };
    await fullReportCache.set(cacheKey, responseData);
    res.json(responseData);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/coordinator/:id/captures', (req, res) => {
  const { id } = req.params;
  try {
    const captures = db.prepare(`
      WITH captures AS MATERIALIZED (
        SELECT * FROM elector_captures WHERE coordinator_id = ?
      )
      SELECT ec.*, 
             COALESCE(e.nombre, 'ELECTOR') as nombre, 
             COALESCE(e.apellido, 'NO REGISTRADO') as apellido, 
             COALESCE(e.local_votacion, 'REGISTRO DE CAMPO') as local_votacion, 
             COALESCE(e.mesa, 0) as mesa, 
             COALESCE(e.orden, 0) as orden
      FROM captures ec
      LEFT JOIN electors e ON ec.elector_ci = e.ci
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
      SELECT 'CAPTURE' as type, ec.timestamp, u.nombre as user_name, COALESCE(e.nombre || ' ' || e.apellido, 'ELECTOR') as entity_name, 'Nueva Captura' as detail
      FROM users u
      CROSS JOIN elector_captures ec ON ec.coordinator_id = u.id
      LEFT JOIN electors e ON ec.elector_ci = e.ci
      WHERE 1=1 ${sec.sql}
      
      UNION ALL
      
      SELECT 'REQUEST' as type, r.timestamp, u.nombre as user_name, r.type as entity_name, r.description as detail
      FROM users u
      CROSS JOIN field_requests r ON r.coordinator_id = u.id
      WHERE 1=1 ${sec.sql}
      
      UNION ALL
      
      SELECT 'CONFLICT' as type, cc.timestamp, 'Sistema' as user_name, COALESCE(e.nombre || ' ' || e.apellido, 'ELECTOR') as entity_name, 'Doble Captura' as detail
      FROM users u
      CROSS JOIN elector_captures ec ON ec.coordinator_id = u.id
      CROSS JOIN capture_conflicts cc ON cc.capture_id = ec.id
      LEFT JOIN electors e ON cc.elector_ci = e.ci
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
    
    // PADRINO & SUBJEFE: can have their own direct coordinators
    let coordinators: any[] = [];
    if (role === 'PADRINO' || role === 'SUBJEFE') {
      coordinators = db.prepare(`
        WITH coordinator_ids AS (
          SELECT id FROM users WHERE parent_id = ? AND role IN ('COORDINADOR', 'MIEMBRO_DE_MESA')
        ),
        stats AS (
          SELECT 
            coordinator_id,
            COUNT(*) as total_captures,
            SUM(CASE WHEN traffic_light='GREEN' THEN 1 ELSE 0 END) as green,
            SUM(CASE WHEN traffic_light='YELLOW' THEN 1 ELSE 0 END) as yellow,
            SUM(CASE WHEN traffic_light='RED' THEN 1 ELSE 0 END) as red,
            SUM(CASE WHEN needs_transport=1 THEN 1 ELSE 0 END) as transport_total
          FROM elector_captures
          WHERE coordinator_id IN (SELECT id FROM coordinator_ids)
          GROUP BY coordinator_id
        )
        SELECT u.id, u.nombre, u.username, u.ci, u.telefono, u.photo_url, u.status,
               u.distrito, u.parent_id, l.list_number,
               COALESCE(s.total_captures, 0) as total_captures,
               COALESCE(s.green, 0) as green,
               COALESCE(s.yellow, 0) as yellow,
               COALESCE(s.red, 0) as red,
               COALESCE(s.transport_total, 0) as transport_total
        FROM users u
        LEFT JOIN lists l ON u.assigned_list_id = l.id
        LEFT JOIN stats s ON u.id = s.coordinator_id
        WHERE u.parent_id = ? AND u.role IN ('COORDINADOR','MIEMBRO_DE_MESA')
        ORDER BY u.nombre
      `).all(requesterId, requesterId);
    }

    if (role === 'PADRINO') {
      return res.json({ role: 'PADRINO', padrinos: [], coordinators });
    }

    // JEFE_CAMPANA / SUBJEFE / SUPERUSUARIO: list view with index-friendly subqueries
    const filter = getSecurityFilter(req, 'u');
    const padrinos = db.prepare(`
      SELECT u.id, u.nombre, u.username, u.ci, u.telefono, u.photo_url, u.status,
             u.assigned_list_id, l.list_number, l.candidate_alias,
             (SELECT COUNT(*) FROM users u2 WHERE u2.parent_id = u.id AND u2.role IN ('COORDINADOR', 'MIEMBRO_DE_MESA')) AS coordinator_count,
             ((SELECT COUNT(*) FROM elector_captures ec WHERE ec.coordinator_id = u.id) + 
              (SELECT COUNT(*) FROM elector_captures ec WHERE ec.coordinator_id IN (SELECT id FROM users WHERE parent_id = u.id))) AS total_captures,
             ((SELECT COUNT(*) FROM elector_captures ec WHERE ec.coordinator_id = u.id AND ec.needs_transport = 1) + 
              (SELECT COUNT(*) FROM elector_captures ec WHERE ec.coordinator_id IN (SELECT id FROM users WHERE parent_id = u.id) AND ec.needs_transport = 1)) AS needs_transport
       FROM users u
       LEFT JOIN lists l ON u.assigned_list_id = l.id
       WHERE u.role IN ('PADRINO', 'SUBJEFE') ${filter.sql}
       ORDER BY u.nombre
    `).all(...filter.params);

    res.json({ role, padrinos, coordinators });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/my-team/reports — structured data for A4 premium reports
app.get('/api/my-team/reports', requireRole('SUPERUSUARIO','JEFE_CAMPANA','PADRINO','SUBJEFE'), async (req, res) => {
  const requesterId = req.headers['x-user-id'] as string;
  const role = getRole(req);

  const selectedDistrict = req.query.district as string;
  const selectedList = req.query.list_number as string;
  const selectedPadrino = req.query.padrino_id as string;
  const selectedCoordinator = req.query.coordinator_id as string;
  const reportType = (req.query.report_type as string) || 'all';

  const cacheKey = `${requesterId}_${selectedDistrict || ''}_${selectedList || ''}_${selectedPadrino || ''}_${selectedCoordinator || ''}_${reportType}`;
  const cached = await myTeamReportsCache.get(cacheKey);
  if (cached) {
    return res.json(cached);
  }

  try {
    const t0 = Date.now();
    const requester = getCachedUserInfo(requesterId);
    const filter = getSecurityFilter(req, 'u');
    const districtName = requester?.distrito || getDistrict(req) || 'GLOBAL';
    console.log(`[REPORTS] type=${reportType} role=${role} user=${requesterId} district=${districtName} filter.sql="${filter.sql}"`);

    // ── ALWAYS: lightweight filter options (fast, no aggregates) ──
    let filterPadrinos: any[] = [];
    if (role === 'SUPERUSUARIO' || role === 'JEFE_CAMPANA' || role === 'SUBJEFE') {
      filterPadrinos = await dbQueryAsync<any>(`
        SELECT u.id, u.nombre, u.distrito, l.list_number
        FROM users u LEFT JOIN lists l ON u.assigned_list_id = l.id
        WHERE u.role IN ('PADRINO','SUBJEFE') ${filter.sql}
        ORDER BY u.nombre
      `, filter.params);
    }

    let filterCoordinators: any[] = [];
    if (role === 'PADRINO') {
      filterCoordinators = await dbQueryAsync<any>(`
        SELECT u.id, u.nombre, u.distrito, u.parent_id, l.list_number
        FROM users u LEFT JOIN lists l ON u.assigned_list_id = l.id
        WHERE u.parent_id = ? AND u.role IN ('COORDINADOR','MIEMBRO_DE_MESA')
        ORDER BY u.nombre
      `, [requesterId]);
    } else {
      filterCoordinators = await dbQueryAsync<any>(`
        SELECT u.id, u.nombre, u.distrito, u.parent_id, l.list_number
        FROM users u LEFT JOIN lists l ON u.assigned_list_id = l.id
        WHERE u.role IN ('COORDINADOR','MIEMBRO_DE_MESA') ${filter.sql}
        ORDER BY u.nombre
      `, filter.params);
    }

    // ── 1. Padrinos report (full metrics) — CTE-based, single aggregation pass ──
    let padrinos: any[] = [];
    if (reportType === 'padrinos' && (role === 'SUPERUSUARIO' || role === 'JEFE_CAMPANA' || role === 'SUBJEFE')) {
      // Build optional WHERE filters
      const padrinoFilters: string[] = [];
      const padrinoParams: any[] = [...filter.params];

      if (selectedDistrict && selectedDistrict !== 'ALL') {
        padrinoFilters.push(`u.distrito = ?`);
        padrinoParams.push(selectedDistrict);
      }
      if (selectedList && selectedList !== 'ALL') {
        padrinoFilters.push(`l.list_number = ?`);
        padrinoParams.push(selectedList);
      }
      if (selectedPadrino && selectedPadrino !== 'ALL') {
        padrinoFilters.push(`u.id = ?`);
        padrinoParams.push(parseInt(selectedPadrino));
      }

      const extraWhere = padrinoFilters.length ? 'AND ' + padrinoFilters.join(' AND ') : '';

      // Single CTE aggregation — avoids 10 correlated sub-selects per row
      const padrinoSql = `
        WITH coord_map AS (
          -- Map each coordinator/member to its padrino (parent)
          SELECT id AS coord_id, parent_id AS padrino_id
          FROM users
          WHERE role IN ('COORDINADOR', 'MIEMBRO_DE_MESA')
        ),
        capture_stats AS (
          -- Aggregate all capture metrics in a single GROUP BY pass
          SELECT
            COALESCE(cm.padrino_id, ec.coordinator_id) AS padrino_id,
            COUNT(*)                                                              AS total_captures,
            SUM(CASE WHEN ec.traffic_light = 'GREEN'  THEN 1 ELSE 0 END)         AS green,
            SUM(CASE WHEN ec.traffic_light = 'YELLOW' THEN 1 ELSE 0 END)         AS yellow,
            SUM(CASE WHEN ec.traffic_light = 'RED'    THEN 1 ELSE 0 END)         AS red,
            SUM(CASE WHEN ec.traffic_light = 'PURPLE' THEN 1 ELSE 0 END)         AS purple,
            SUM(CASE WHEN ec.needs_transport = 1      THEN 1 ELSE 0 END)         AS needs_transport
          FROM elector_captures ec
          LEFT JOIN coord_map cm ON cm.coord_id = ec.coordinator_id
          GROUP BY COALESCE(cm.padrino_id, ec.coordinator_id)
        ),
        coord_count AS (
          SELECT parent_id AS padrino_id, COUNT(*) AS coordinator_count
          FROM users
          WHERE role IN ('COORDINADOR', 'MIEMBRO_DE_MESA')
          GROUP BY parent_id
        )
        SELECT
          u.id, u.nombre, u.username, u.ci, u.telefono, u.photo_url, u.status, u.distrito,
          u.assigned_list_id, l.list_number, l.candidate_alias,
          COALESCE(cc.coordinator_count, 0)  AS coordinator_count,
          COALESCE(cs.total_captures, 0)     AS total_captures,
          COALESCE(cs.needs_transport, 0)    AS needs_transport,
          COALESCE(cs.green, 0)              AS green,
          COALESCE(cs.yellow, 0)             AS yellow,
          COALESCE(cs.red, 0)                AS red,
          COALESCE(cs.purple, 0)             AS purple
        FROM users u
        LEFT JOIN lists l          ON u.assigned_list_id = l.id
        LEFT JOIN capture_stats cs ON cs.padrino_id = u.id
        LEFT JOIN coord_count cc   ON cc.padrino_id = u.id
        WHERE u.role IN ('PADRINO', 'SUBJEFE') ${filter.sql} ${extraWhere}
        ORDER BY u.nombre
      `;

      padrinos = await dbQueryAsync<any>(padrinoSql, padrinoParams);
    }

    // ── 2. Coordinators report (full metrics) ──
    let coordinators: any[] = [];
    if (reportType === 'coordinators') {
      let coordSql = `
        WITH coord_stats AS (
          SELECT coordinator_id,
                 COUNT(id) AS total_captures,
                 SUM(CASE WHEN traffic_light = 'GREEN' THEN 1 ELSE 0 END) AS green,
                 SUM(CASE WHEN traffic_light = 'YELLOW' THEN 1 ELSE 0 END) AS yellow,
                 SUM(CASE WHEN traffic_light = 'RED' THEN 1 ELSE 0 END) AS red,
                 SUM(CASE WHEN traffic_light = 'PURPLE' THEN 1 ELSE 0 END) AS purple,
                 SUM(CASE WHEN needs_transport = 1 THEN 1 ELSE 0 END) AS needs_transport
          FROM elector_captures
          GROUP BY coordinator_id
        )
        SELECT u.id, u.nombre, u.username, u.ci, u.telefono, u.photo_url, u.status, u.distrito,
               u.parent_id, p.nombre as parent_name, p.ci as parent_ci,
               u.assigned_list_id, l.list_number,
               COALESCE(cs.total_captures, 0) AS total_captures,
               COALESCE(cs.green, 0) AS green,
               COALESCE(cs.yellow, 0) AS yellow,
               COALESCE(cs.red, 0) AS red,
               COALESCE(cs.purple, 0) AS purple,
               COALESCE(cs.needs_transport, 0) AS needs_transport
        FROM users u
        LEFT JOIN users p ON u.parent_id = p.id
        LEFT JOIN lists l ON u.assigned_list_id = l.id
        LEFT JOIN coord_stats cs ON cs.coordinator_id = u.id
        WHERE u.role IN ('COORDINADOR', 'MIEMBRO_DE_MESA')
      `;
      let coordParams: any[] = [];
      if (role === 'PADRINO') {
        coordSql += ` AND u.parent_id = ?`;
        coordParams.push(requesterId);
      } else {
        coordSql += ` ${filter.sql}`;
        coordParams.push(...filter.params);
      }

      if (selectedDistrict && selectedDistrict !== 'ALL') {
        coordSql += ` AND u.distrito = ?`;
        coordParams.push(selectedDistrict);
      }
      if (selectedList && selectedList !== 'ALL') {
        coordSql += ` AND l.list_number = ?`;
        coordParams.push(selectedList);
      }
      if (selectedPadrino && selectedPadrino !== 'ALL') {
        coordSql += ` AND u.parent_id = ?`;
        coordParams.push(parseInt(selectedPadrino));
      }
      if (selectedCoordinator && selectedCoordinator !== 'ALL') {
        coordSql += ` AND u.id = ?`;
        coordParams.push(parseInt(selectedCoordinator));
      }

      coordSql += ` ORDER BY u.nombre`;
      coordinators = await dbQueryAsync<any>(coordSql, coordParams);
    }

    // ── 3. Electors report ──
    let electors: any[] = [];
    if (reportType === 'electors') {
      let electorSql = "";
      let electorParams: any[] = [];

      if (selectedDistrict && selectedDistrict !== 'ALL') {
        const baseSelect = `
          SELECT ec.id as capture_id, ec.elector_ci, ec.telefono as elector_telefono,
                 ec.traffic_light, ec.needs_transport, ec.timestamp,
                 COALESCE(e.nombre, 'ELECTOR') as nombre,
                 COALESCE(e.apellido, 'NO REGISTRADO') as apellido,
                 COALESCE(e.local_votacion, 'REGISTRO DE CAMPO') as local_votacion,
                 COALESCE(e.mesa, 0) as mesa,
                 COALESCE(e.orden, 0) as orden,
                 COALESCE(e.distrito, 'REGISTRO DE CAMPO') as elector_district,
                 u.nombre as coordinator_name, u.role as coordinator_role, u.photo_url as coordinator_photo,
                 u.distrito as coordinator_district, u.assigned_list_id as coordinator_list_id,
                 u.parent_id as padrino_id, ec.coordinator_id,
                 p.nombre as padrino_name,
                 l.list_number, c.name as campaign_name
        `;

        const filterE = (role === 'PADRINO') ? null : getSecurityFilter(req, 'u');

        const needsUsersJoin = role === 'PADRINO' || 
                               (selectedPadrino && selectedPadrino !== 'ALL') || 
                               (filterE && filterE.sql && filterE.sql.trim() !== "");

        const needsListsJoin = selectedList && selectedList !== 'ALL';

        let q1_ids = '';

        let q2_ids = `
          SELECT ec.id, ec.timestamp
          FROM users u INDEXED BY idx_users_distrito
          INNER JOIN elector_captures ec ON ec.coordinator_id = u.id
          ${needsListsJoin ? 'LEFT JOIN lists l ON ec.list_id = l.id' : ''}
          WHERE u.distrito = ?
        `;

        let extraFilters = "";
        let extraParams: any[] = [];

        if (role === 'PADRINO') {
          extraFilters += ` AND (u.parent_id = ? OR ec.coordinator_id = ?)`;
          extraParams.push(requesterId, requesterId);
        } else if (filterE) {
          extraFilters += ` ${filterE.sql}`;
          extraParams.push(...filterE.params);
        }

        if (selectedList && selectedList !== 'ALL') {
          extraFilters += ` AND l.list_number = ?`;
          extraParams.push(selectedList);
        }
        if (selectedPadrino && selectedPadrino !== 'ALL') {
          extraFilters += ` AND u.parent_id = ?`;
          extraParams.push(parseInt(selectedPadrino));
        }
        if (selectedCoordinator && selectedCoordinator !== 'ALL') {
          extraFilters += ` AND ec.coordinator_id = ?`;
          extraParams.push(parseInt(selectedCoordinator));
        }

        q1_ids = `
          WITH captures AS MATERIALIZED (
            SELECT ec.id, ec.timestamp, ec.elector_ci, ec.coordinator_id, ec.list_id
            FROM elector_captures ec
            ${needsUsersJoin ? 'LEFT JOIN users u ON ec.coordinator_id = u.id' : ''}
            ${needsListsJoin ? 'LEFT JOIN lists l ON ec.list_id = l.id' : ''}
            WHERE 1=1 ${extraFilters}
          )
          SELECT ec.id, ec.timestamp
          FROM captures ec
          INNER JOIN electors e ON ec.elector_ci = e.ci
          WHERE e.distrito = ?
        `;
        q2_ids += extraFilters;

        electorSql = `
          ${baseSelect}
          FROM (
            SELECT id FROM (
              ${q1_ids}
              UNION
              ${q2_ids}
            ) ORDER BY timestamp DESC LIMIT 3000
          ) as subset
          INNER JOIN elector_captures ec ON subset.id = ec.id
          LEFT JOIN electors e ON ec.elector_ci = e.ci
          LEFT JOIN users u ON ec.coordinator_id = u.id
          LEFT JOIN users p ON u.parent_id = p.id
          LEFT JOIN lists l ON ec.list_id = l.id
          LEFT JOIN campaigns c ON l.campaign_id = c.id
          ORDER BY ec.timestamp DESC
        `;
        electorParams = [...extraParams, selectedDistrict, selectedDistrict, ...extraParams];
      } else {
        electorSql = `
          SELECT ec.id as capture_id, ec.elector_ci, ec.telefono as elector_telefono,
                 ec.traffic_light, ec.needs_transport, ec.timestamp,
                 COALESCE(e.nombre, 'ELECTOR') as nombre,
                 COALESCE(e.apellido, 'NO REGISTRADO') as apellido,
                 COALESCE(e.local_votacion, 'REGISTRO DE CAMPO') as local_votacion,
                 COALESCE(e.mesa, 0) as mesa,
                 COALESCE(e.orden, 0) as orden,
                 COALESCE(e.distrito, 'REGISTRO DE CAMPO') as elector_district,
                 u.nombre as coordinator_name, u.role as coordinator_role, u.photo_url as coordinator_photo,
                 u.distrito as coordinator_district, u.assigned_list_id as coordinator_list_id,
                 u.parent_id as padrino_id, ec.coordinator_id,
                 p.nombre as padrino_name,
                 l.list_number, c.name as campaign_name
          FROM elector_captures ec
          LEFT JOIN electors e ON ec.elector_ci = e.ci
          LEFT JOIN users u ON ec.coordinator_id = u.id
          LEFT JOIN users p ON u.parent_id = p.id
          LEFT JOIN lists l ON ec.list_id = l.id
          LEFT JOIN campaigns c ON l.campaign_id = c.id
          WHERE 1=1
        `;

        if (role === 'PADRINO') {
          electorSql += ` AND (u.parent_id = ? OR ec.coordinator_id = ?)`;
          electorParams.push(requesterId, requesterId);
        } else {
          const filterE = getSecurityFilter(req, 'u');
          electorSql += ` ${filterE.sql}`;
          electorParams.push(...filterE.params);
        }

        if (selectedList && selectedList !== 'ALL') {
          electorSql += ` AND l.list_number = ?`;
          electorParams.push(selectedList);
        }
        if (selectedPadrino && selectedPadrino !== 'ALL') {
          electorSql += ` AND u.parent_id = ?`;
          electorParams.push(parseInt(selectedPadrino));
        }
        if (selectedCoordinator && selectedCoordinator !== 'ALL') {
          electorSql += ` AND ec.coordinator_id = ?`;
          electorParams.push(parseInt(selectedCoordinator));
        }

        electorSql += ` ORDER BY ec.timestamp DESC LIMIT 3000`;
      }

      electors = await dbQueryAsync<any>(electorSql, electorParams);
    }

    // ── 4. Locales report ──
    let locales: any[] = [];
    if (reportType === 'locales') {
      let localesSql = "";
      let localesParams: any[] = [];

      if (selectedDistrict && selectedDistrict !== 'ALL') {
        localesSql = `
          WITH captures AS MATERIALIZED (
            SELECT ec.id, ec.elector_ci, ec.traffic_light, ec.needs_transport, ec.coordinator_id, ec.list_id
            FROM elector_captures ec
          )
          SELECT COALESCE(e.local_votacion, 'REGISTRO DE CAMPO') as local_votacion,
                 COALESCE(e.distrito, 'REGISTRO DE CAMPO') as distrito,
                 COUNT(ec.id) as total_captures,
                 SUM(CASE WHEN ec.traffic_light = 'GREEN' THEN 1 ELSE 0 END) as green,
                 SUM(CASE WHEN ec.traffic_light = 'YELLOW' THEN 1 ELSE 0 END) as yellow,
                 SUM(CASE WHEN ec.traffic_light = 'RED' THEN 1 ELSE 0 END) as red,
                 SUM(CASE WHEN ec.traffic_light = 'PURPLE' THEN 1 ELSE 0 END) as purple,
                 SUM(CASE WHEN ec.needs_transport = 1 THEN 1 ELSE 0 END) as needs_transport
          FROM captures ec
          INNER JOIN electors e ON ec.elector_ci = e.ci
          LEFT JOIN users u ON ec.coordinator_id = u.id
          LEFT JOIN lists l ON ec.list_id = l.id
          WHERE e.distrito = ?
        `;
        localesParams.push(selectedDistrict);
      } else {
        localesSql = `
          SELECT COALESCE(e.local_votacion, 'REGISTRO DE CAMPO') as local_votacion,
                 COALESCE(e.distrito, 'REGISTRO DE CAMPO') as distrito,
                 COUNT(ec.id) as total_captures,
                 SUM(CASE WHEN ec.traffic_light = 'GREEN' THEN 1 ELSE 0 END) as green,
                 SUM(CASE WHEN ec.traffic_light = 'YELLOW' THEN 1 ELSE 0 END) as yellow,
                 SUM(CASE WHEN ec.traffic_light = 'RED' THEN 1 ELSE 0 END) as red,
                 SUM(CASE WHEN ec.traffic_light = 'PURPLE' THEN 1 ELSE 0 END) as purple,
                 SUM(CASE WHEN ec.needs_transport = 1 THEN 1 ELSE 0 END) as needs_transport
          FROM elector_captures ec
          LEFT JOIN electors e ON ec.elector_ci = e.ci
          LEFT JOIN users u ON ec.coordinator_id = u.id
          LEFT JOIN lists l ON ec.list_id = l.id
          WHERE 1=1
        `;
      }

      if (role === 'PADRINO') {
        localesSql += ` AND (u.parent_id = ? OR ec.coordinator_id = ?)`;
        localesParams.push(requesterId, requesterId);
      } else {
        const filterU = getSecurityFilter(req, 'u');
        localesSql += ` ${filterU.sql}`;
        localesParams.push(...filterU.params);
      }

      if (selectedList && selectedList !== 'ALL') {
        localesSql += ` AND l.list_number = ?`;
        localesParams.push(selectedList);
      }
      if (selectedPadrino && selectedPadrino !== 'ALL') {
        localesSql += ` AND u.parent_id = ?`;
        localesParams.push(parseInt(selectedPadrino));
      }
      if (selectedCoordinator && selectedCoordinator !== 'ALL') {
        localesSql += ` AND ec.coordinator_id = ?`;
        localesParams.push(parseInt(selectedCoordinator));
      }

      localesSql += ` GROUP BY COALESCE(e.local_votacion, 'REGISTRO DE CAMPO'), COALESCE(e.distrito, 'REGISTRO DE CAMPO') ORDER BY total_captures DESC`;
      locales = await dbQueryAsync<any>(localesSql, localesParams);
    }

    const elapsed = Date.now() - t0;
    console.log(`[REPORTS] completed in ${elapsed}ms — padrinos=${padrinos.length} coords=${coordinators.length} electors=${electors.length} locales=${locales.length}`);

    const responseData = {
      district: districtName,
      filterPadrinos,
      filterCoordinators,
      padrinos,
      coordinators,
      electors,
      locales
    };
    
    await myTeamReportsCache.set(cacheKey, responseData);
    res.json(responseData);
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
      WITH coordinator_ids AS (
        SELECT id FROM users WHERE parent_id = ? AND role IN ('COORDINADOR', 'MIEMBRO_DE_MESA')
      ),
      stats AS (
        SELECT 
          coordinator_id,
          COUNT(*) as total_captures,
          SUM(CASE WHEN traffic_light='GREEN' THEN 1 ELSE 0 END) as green,
          SUM(CASE WHEN traffic_light='YELLOW' THEN 1 ELSE 0 END) as yellow,
          SUM(CASE WHEN traffic_light='RED' THEN 1 ELSE 0 END) as red,
          SUM(CASE WHEN needs_transport=1 THEN 1 ELSE 0 END) as transport_total
        FROM elector_captures
        WHERE coordinator_id IN (SELECT id FROM coordinator_ids)
        GROUP BY coordinator_id
      )
      SELECT u.id, u.nombre, u.username, u.ci, u.telefono, u.photo_url, u.status,
             COALESCE(s.total_captures, 0) as total_captures,
             COALESCE(s.green, 0) as green,
             COALESCE(s.yellow, 0) as yellow,
             COALESCE(s.red, 0) as red,
             COALESCE(s.transport_total, 0) as transport_total
      FROM users u
      LEFT JOIN stats s ON u.id = s.coordinator_id
      WHERE u.parent_id = ? AND u.role IN ('COORDINADOR','MIEMBRO_DE_MESA')
      ORDER BY u.nombre
    `).all(padrinoId, padrinoId);
    res.json(coordinators);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/campaigns/mine — campaigns the logged-in JEFE_CAMPANA owns
app.get('/api/campaigns/mine', requireRole('SUPERUSUARIO','JEFE_CAMPANA','SUBJEFE','PADRINO'), (req, res) => {
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
const whatsappUpload = multer({
  storage,
  limits: { fileSize: 100 * 1024 * 1024 } // 100MB
});

app.post('/api/whatsapp/upload', whatsappUpload.single('file'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No se subió ningún archivo' });
  }
  const baseUrl = process.env.APP_URL || `${req.protocol}://${req.get('host')}`;
  res.json({
    success: true,
    url: `${baseUrl}/uploads/${req.file.filename}`,
    path: `/uploads/${req.file.filename}`,
    filename: req.file.filename,
    mimetype: req.file.mimetype
  });
});

app.get('/api/whatsapp/terminals', async (req, res) => {
  const user_id = req.headers['x-user-id'] as string;
  const user = getCachedUserInfo(user_id);
  const campaignId = (user?.role === 'SUPERUSUARIO') ? null : user?.campaign_id;
  res.json(await whatsappService.getTerminals(campaignId));
});

app.post('/api/whatsapp/terminals', async (req, res) => {
  const { id, name } = req.body;
  const user_id = req.headers['x-user-id'] as string;
  const user = getCachedUserInfo(user_id);
  const campaignId = user?.campaign_id || null;
  await whatsappService.addTerminal(id, name, campaignId);
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
  const user_id = req.headers['x-user-id'] as string;
  const user = getCachedUserInfo(user_id);
  const role = getRole(req);
  try {
    let sql = 'SELECT * FROM whatsapp_templates WHERE 1=1';
    const params: any[] = [];
    if (role !== 'SUPERUSUARIO' && user?.campaign_id) {
      sql += ' AND (campaign_id = ? OR campaign_id IS NULL)';
      params.push(user.campaign_id);
    }
    sql += ' ORDER BY created_at DESC';
    const templates = db.prepare(sql).all(...params);
    res.json(templates);
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

app.post('/api/whatsapp/templates', (req, res) => {
  const { name, content, media_url, media_type, lat, lng, contact_name, contact_phone } = req.body;
  const user_id = req.headers['x-user-id'] as string;
  const user = getCachedUserInfo(user_id);
  const campaignId = user?.campaign_id || null;
  try {
    const result = db.prepare(`
      INSERT INTO whatsapp_templates (name, content, media_url, media_type, lat, lng, contact_name, contact_phone, campaign_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(name, content, media_url, media_type, lat, lng, contact_name, contact_phone, campaignId);
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
  const user_id = req.headers['x-user-id'] as string;
  const user = getCachedUserInfo(user_id);
  const role = getRole(req);
  try {
    let sql = `
      SELECT l.*, t.name as template_name 
      FROM whatsapp_broadcast_logs l
      LEFT JOIN whatsapp_templates t ON l.template_id = t.id
      WHERE 1=1
    `;
    const params: any[] = [];
    if (role !== 'SUPERUSUARIO' && user?.campaign_id) {
      sql += ' AND l.campaign_id = ?';
      params.push(user.campaign_id);
    }
    sql += ' ORDER BY l.timestamp DESC LIMIT 50';
    const logs = db.prepare(sql).all(...params);
    res.json(logs);
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

app.post('/api/whatsapp/broadcast', async (req, res) => {
  const { 
    template_id, 
    targets, // array of { telefono, nombre, elector_ci, local_votacion, mesa, orden }
    message, // custom message content
    media_url, 
    media_type, 
    minDelay = 2, 
    maxDelay = 5, 
    useSpintax = true,
    terminalId: reqTerminalId 
  } = req.body;
  
  const user_id = req.headers['x-user-id'] as string;
  const user = getCachedUserInfo(user_id);
  const campaignId = user?.campaign_id || null;

  const rotateTerminals = reqTerminalId === 'rotate' || req.body.rotateTerminals === true;
  const terminalId = rotateTerminals ? 'rotate' : (reqTerminalId || 'default');

  const role = getRole(req);
  if (role !== 'SUPERUSUARIO' && role !== 'JEFE_CAMPANA') return res.status(403).json({ error: 'Prohibido' });

  try {
    if (!targets || !Array.isArray(targets) || targets.length === 0) {
      return res.status(400).json({ error: 'No se encontraron destinatarios con teléfono' });
    }

    const activeTerminals = (await whatsappService.getTerminals(campaignId))
      .filter(t => t.status === 'CONNECTED');

    if (rotateTerminals && activeTerminals.length === 0) {
      return res.status(400).json({ error: 'No hay terminales activas de WhatsApp conectadas para rotar.' });
    }

    // 1. Log entry in DB
    const logResult = db.prepare(`
      INSERT INTO whatsapp_broadcast_logs (template_id, custom_message, media_url, media_type, terminal_id, target_count, status, min_delay, max_delay, campaign_id)
      VALUES (?, ?, ?, ?, ?, ?, 'RUNNING', ?, ?, ?)
    `).run(
      template_id || null,
      message || null,
      media_url || null,
      media_type || null,
      terminalId,
      targets.length,
      minDelay,
      maxDelay,
      campaignId
    );
    const logId = logResult.lastInsertRowid;

    // 2. Start background process with rate-limiting
    const runBroadcast = async () => {
      const { canSendMore, getSmartDelay, incrementDailyCount, isGoodSendingHour } = require('./whatsappRateLimiter');
      const { isOptedOut } = require('./whatsappAutoresponder');

      let successCount = 0;
      let failCount = 0;
      let sentInSession = 0;

      for (let i = 0; i < targets.length; i++) {
        // Check current status in DB
        const log = db.prepare('SELECT status FROM whatsapp_broadcast_logs WHERE id = ?').get(logId) as any;
        if (!log) break;
        if (log.status === 'CANCELLED') break;

        if (log.status === 'PAUSED') {
          await new Promise(r => setTimeout(r, 2000));
          i--;
          continue;
        }

        // Determine active terminal to use
        let currentTerminalId = terminalId;
        if (rotateTerminals && activeTerminals.length > 0) {
          const terminalIndex = sentInSession % activeTerminals.length;
          currentTerminalId = activeTerminals[terminalIndex].id;
        }

        // RATE LIMIT CHECK — respect warmup tiers
        const rateCheck = canSendMore(currentTerminalId);
        if (!rateCheck.allowed) {
          console.log(`[BROADCAST ${logId}] Rate limit hit for ${currentTerminalId}: ${rateCheck.reason}`);
          // If rotating, try next terminal; otherwise stop
          if (rotateTerminals && activeTerminals.length > 1) {
            // Remove this terminal from rotation for today
            const idx = activeTerminals.findIndex((t: any) => t.id === currentTerminalId);
            if (idx !== -1) activeTerminals.splice(idx, 1);
            if (activeTerminals.length === 0) {
              console.log(`[BROADCAST ${logId}] All terminals hit daily limit. Stopping.`);
              break;
            }
            i--; // Retry with next terminal
            continue;
          }
          break;
        }

        // Time-of-day check: pause during off-hours
        if (!isGoodSendingHour()) {
          console.log(`[BROADCAST ${logId}] Off-hours (before 7am or after 9pm). Pausing 30min.`);
          await new Promise(r => setTimeout(r, 1800000));
          i--;
          continue;
        }

        const target = targets[i];
        if (!target.telefono) {
          failCount++;
          db.prepare(`INSERT INTO whatsapp_broadcast_recipients (log_id, telefono, nombre, status, error_msg) VALUES (?, ?, ?, 'FAILED', 'Sin número de teléfono')`)
            .run(logId, target.telefono || '', target.nombre || '');
          continue;
        }

        // Check opt-out list
        if (isOptedOut(target.telefono)) {
          failCount++;
          db.prepare(`INSERT INTO whatsapp_broadcast_recipients (log_id, telefono, nombre, status, error_msg) VALUES (?, ?, ?, 'FAILED', 'Usuario solicitó exclusión (Opt-out)')`)
            .run(logId, target.telefono, target.nombre || '');
          db.prepare('UPDATE whatsapp_broadcast_logs SET success_count = ?, fail_count = ? WHERE id = ?')
            .run(successCount, failCount, logId);
          continue;
        }

        // NOTE: We NO LONGER call checkNumberExists() before sending.
        // Reason: onWhatsApp() in batch is a massive bot signal that Meta detects.
        // If the number doesn't exist, sendMessage will fail and we handle it gracefully.

        try {
          let personalizedContent = message || '';
          if (template_id) {
            const template = db.prepare('SELECT content FROM whatsapp_templates WHERE id = ?').get(template_id) as any;
            if (template?.content) personalizedContent = template.content;
          }

          personalizedContent = personalizedContent
            .replace(/{{nombre}}/g, target.nombre || 'Amigo/a')
            .replace(/{{ci}}/g, target.elector_ci || target.ci || '')
            .replace(/{{local}}/g, target.local_votacion || 'No especificado')
            .replace(/{{mesa}}/g, target.mesa?.toString() || '-')
            .replace(/{{orden}}/g, target.orden?.toString() || '-');

          if (useSpintax && personalizedContent) {
            personalizedContent = addSubtleVariation(personalizedContent);
          }

          if (media_type === 'VOICE' && media_url) {
            await whatsappService.sendVoice(currentTerminalId, target.telefono, media_url);
          } else if (media_url) {
            await whatsappService.sendMedia(currentTerminalId, target.telefono, media_url, personalizedContent);
          } else {
            await whatsappService.sendMessage(currentTerminalId, target.telefono, personalizedContent);
          }
          successCount++;
          sentInSession++;
          incrementDailyCount(currentTerminalId);
          db.prepare(`INSERT INTO whatsapp_broadcast_recipients (log_id, telefono, nombre, status) VALUES (?, ?, ?, 'SENT')`)
            .run(logId, target.telefono, target.nombre || '');
        } catch (err: any) {
          failCount++;
          db.prepare(`INSERT INTO whatsapp_broadcast_recipients (log_id, telefono, nombre, status, error_msg) VALUES (?, ?, ?, 'FAILED', ?)`)
            .run(logId, target.telefono, target.nombre || '', err?.message || 'Error desconocido');

          // If we get a 403/ban signal, STOP immediately
          const errMsg = (err?.message || '').toLowerCase();
          if (errMsg.includes('banned') || errMsg.includes('blocked') || errMsg.includes('restrict') || errMsg.includes('403')) {
            console.error(`[BROADCAST ${logId}] BAN SIGNAL DETECTED. Stopping immediately.`);
            db.prepare('UPDATE whatsapp_broadcast_logs SET success_count = ?, fail_count = ?, status = ? WHERE id = ?')
              .run(successCount, failCount, 'STOPPED_BAN_RISK', logId);
            return;
          }
        }

        db.prepare('UPDATE whatsapp_broadcast_logs SET success_count = ?, fail_count = ? WHERE id = ?')
          .run(successCount, failCount, logId);

        // Skip delay after last message
        if (i === targets.length - 1) break;

        // Smart delay based on warmup tier (NOT the user-provided minDelay/maxDelay)
        const delayMs = getSmartDelay(currentTerminalId, sentInSession);
        await new Promise(r => setTimeout(r, delayMs));
      }

      // Finish
      const finalLog = db.prepare('SELECT status FROM whatsapp_broadcast_logs WHERE id = ?').get(logId) as any;
      const finalStatus = (finalLog && (finalLog.status === 'CANCELLED' || finalLog.status === 'PAUSED')) ? finalLog.status : 'COMPLETED';
      db.prepare('UPDATE whatsapp_broadcast_logs SET success_count = ?, fail_count = ?, status = ? WHERE id = ?')
        .run(successCount, failCount, finalStatus, logId);
    };

    runBroadcast();

    res.json({ success: true, log_id: logId, target_count: targets.length });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/whatsapp/warmup-status', (req, res) => {
  const { getTerminalWarmupStatus } = require('./whatsappRateLimiter');
  try {
    const terminalIds = whatsappService.getTerminalIds();
    const statuses = terminalIds.map((id: string) => getTerminalWarmupStatus(id));
    res.json(statuses);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/whatsapp/broadcast/active', (req, res) => {
  const user_id = req.headers['x-user-id'] as string;
  const user = getCachedUserInfo(user_id);
  const role = getRole(req);
  if (role !== 'SUPERUSUARIO' && role !== 'JEFE_CAMPANA') return res.status(403).json({ error: 'Prohibido' });
  try {
    let sql = `
      SELECT id, target_count, success_count, fail_count, status
      FROM whatsapp_broadcast_logs
      WHERE status IN ('RUNNING', 'PAUSED')
    `;
    const params: any[] = [];
    if (role !== 'SUPERUSUARIO' && user?.campaign_id) {
      sql += ' AND campaign_id = ?';
      params.push(user.campaign_id);
    }
    sql += ' ORDER BY id DESC LIMIT 1';
    const active = db.prepare(sql).get(...params);
    res.json(active || null);
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

app.get('/api/whatsapp/broadcast/logs/:id', (req, res) => {
  const role = getRole(req);
  if (role !== 'SUPERUSUARIO' && role !== 'JEFE_CAMPANA') return res.status(403).json({ error: 'Prohibido' });
  const logId = parseInt(req.params.id);
  const user_id = req.headers['x-user-id'] as string;
  const user = getCachedUserInfo(user_id);
  try {
    const log = db.prepare(`
      SELECT l.*, t.name as template_name
      FROM whatsapp_broadcast_logs l
      LEFT JOIN whatsapp_templates t ON l.template_id = t.id
      WHERE l.id = ?
    `).get(logId) as any;
    if (!log) return res.status(404).json({ error: 'Log no encontrado' });
    if (role !== 'SUPERUSUARIO' && user?.campaign_id && log.campaign_id !== user.campaign_id) {
      return res.status(403).json({ error: 'Prohibido' });
    }
    res.json(log);
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

app.post('/api/whatsapp/broadcast/:id/pause', (req, res) => {
  const role = getRole(req);
  if (role !== 'SUPERUSUARIO' && role !== 'JEFE_CAMPANA') return res.status(403).json({ error: 'Prohibido' });
  const logId = parseInt(req.params.id);
  const user_id = req.headers['x-user-id'] as string;
  const user = getCachedUserInfo(user_id);
  try {
    if (role !== 'SUPERUSUARIO' && user?.campaign_id) {
      const log = db.prepare('SELECT campaign_id FROM whatsapp_broadcast_logs WHERE id = ?').get(logId) as any;
      if (log && log.campaign_id !== user.campaign_id) return res.status(403).json({ error: 'Prohibido' });
    }
    db.prepare("UPDATE whatsapp_broadcast_logs SET status = 'PAUSED' WHERE id = ?").run(logId);
    res.json({ success: true, status: 'PAUSED' });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

app.post('/api/whatsapp/broadcast/:id/resume', (req, res) => {
  const role = getRole(req);
  if (role !== 'SUPERUSUARIO' && role !== 'JEFE_CAMPANA') return res.status(403).json({ error: 'Prohibido' });
  const logId = parseInt(req.params.id);
  const user_id = req.headers['x-user-id'] as string;
  const user = getCachedUserInfo(user_id);
  try {
    if (role !== 'SUPERUSUARIO' && user?.campaign_id) {
      const log = db.prepare('SELECT campaign_id FROM whatsapp_broadcast_logs WHERE id = ?').get(logId) as any;
      if (log && log.campaign_id !== user.campaign_id) return res.status(403).json({ error: 'Prohibido' });
    }
    db.prepare("UPDATE whatsapp_broadcast_logs SET status = 'RUNNING' WHERE id = ?").run(logId);
    res.json({ success: true, status: 'RUNNING' });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

app.post('/api/whatsapp/broadcast/:id/cancel', (req, res) => {
  const role = getRole(req);
  if (role !== 'SUPERUSUARIO' && role !== 'JEFE_CAMPANA') return res.status(403).json({ error: 'Prohibido' });
  const logId = parseInt(req.params.id);
  const user_id = req.headers['x-user-id'] as string;
  const user = getCachedUserInfo(user_id);
  try {
    if (role !== 'SUPERUSUARIO' && user?.campaign_id) {
      const log = db.prepare('SELECT campaign_id FROM whatsapp_broadcast_logs WHERE id = ?').get(logId) as any;
      if (log && log.campaign_id !== user.campaign_id) return res.status(403).json({ error: 'Prohibido' });
    }
    db.prepare("UPDATE whatsapp_broadcast_logs SET status = 'CANCELLED' WHERE id = ?").run(logId);
    res.json({ success: true, status: 'CANCELLED' });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// POST /api/whatsapp/broadcast/:id/retry-failed — re-send to all FAILED recipients of a log
app.post('/api/whatsapp/broadcast/:id/retry-failed', async (req, res) => {
  const role = getRole(req);
  if (role !== 'SUPERUSUARIO' && role !== 'JEFE_CAMPANA') return res.status(403).json({ error: 'Prohibido' });
  const logId = parseInt(req.params.id);
  const user_id = req.headers['x-user-id'] as string;
  const user = getCachedUserInfo(user_id);

  try {
    const orig = db.prepare('SELECT * FROM whatsapp_broadcast_logs WHERE id = ?').get(logId) as any;
    if (!orig) return res.status(404).json({ error: 'Log no encontrado' });
    if (role !== 'SUPERUSUARIO' && user?.campaign_id && orig.campaign_id && orig.campaign_id !== user.campaign_id) {
      return res.status(403).json({ error: 'Prohibido' });
    }

    const failedRows = db.prepare(
      `SELECT telefono, nombre FROM whatsapp_broadcast_recipients WHERE log_id = ? AND status = 'FAILED' AND telefono != ''`
    ).all(logId) as { telefono: string; nombre: string }[];

    if (failedRows.length === 0) return res.status(400).json({ error: 'No hay destinatarios fallidos para reintentar' });

    const terminalId = orig.terminal_id || 'default';
    const minDelay = orig.min_delay ?? 2;
    const maxDelay = orig.max_delay ?? 5;

    const rotateTerminals = terminalId === 'rotate';
    const activeTerminals = rotateTerminals 
      ? (await whatsappService.getTerminals(orig.campaign_id)).filter(t => t.status === 'CONNECTED')
      : [];

    if (rotateTerminals && activeTerminals.length === 0) {
      return res.status(400).json({ error: 'No hay terminales activas de WhatsApp conectadas para rotar en el reintento.' });
    }

    const newLog = db.prepare(
      `INSERT INTO whatsapp_broadcast_logs (template_id, custom_message, media_url, media_type, terminal_id, target_count, status, min_delay, max_delay, campaign_id)
       VALUES (?, ?, ?, ?, ?, ?, 'RUNNING', ?, ?, ?)`
    ).run(orig.template_id || null, orig.custom_message || null, orig.media_url || null, orig.media_type || null,
          terminalId, failedRows.length, minDelay, maxDelay, orig.campaign_id || null);
    const newLogId = newLog.lastInsertRowid;

    const runRetry = async () => {
      let successCount = 0; let failCount = 0; let sentInSession = 0;
      for (let i = 0; i < failedRows.length; i++) {
        const log = db.prepare('SELECT status FROM whatsapp_broadcast_logs WHERE id = ?').get(newLogId) as any;
        if (!log || log.status === 'CANCELLED') break;
        while (log.status === 'PAUSED') { await new Promise(r => setTimeout(r, 1000)); }

        const target = failedRows[i];

        // Determine active terminal to use
        let currentTerminalId = terminalId;
        if (rotateTerminals && activeTerminals.length > 0) {
          const terminalIndex = sentInSession % activeTerminals.length;
          currentTerminalId = activeTerminals[terminalIndex].id;
        }

        // Check if number is in opt-out list
        const { isOptedOut } = require('./whatsappAutoresponder');
        if (isOptedOut(target.telefono)) {
          failCount++;
          db.prepare(`INSERT INTO whatsapp_broadcast_recipients (log_id, telefono, nombre, status, error_msg) VALUES (?, ?, ?, 'FAILED', 'Usuario solicitó exclusión (Opt-out)')`)
            .run(newLogId, target.telefono, target.nombre || '');
          db.prepare('UPDATE whatsapp_broadcast_logs SET success_count = ?, fail_count = ? WHERE id = ?').run(successCount, failCount, newLogId);
          continue;
        }

        // Validate number existence on WhatsApp using the selected terminal
        try {
          const exists = await whatsappService.checkNumberExists(currentTerminalId, target.telefono);
          if (!exists) {
            failCount++;
            db.prepare(`INSERT INTO whatsapp_broadcast_recipients (log_id, telefono, nombre, status, error_msg) VALUES (?, ?, ?, 'FAILED', 'El número no tiene WhatsApp registrado')`)
              .run(newLogId, target.telefono, target.nombre || '');
            db.prepare('UPDATE whatsapp_broadcast_logs SET success_count = ?, fail_count = ? WHERE id = ?').run(successCount, failCount, newLogId);
            continue;
          }
        } catch (err: any) {
          console.warn(`[RETRY] No se pudo verificar la existencia de WhatsApp para ${target.telefono}:`, err.message);
        }

        try {
          let content = orig.custom_message || '';
          if (orig.template_id) {
            const t = db.prepare('SELECT content FROM whatsapp_templates WHERE id = ?').get(orig.template_id) as any;
            if (t?.content) content = t.content;
          }
          content = addSubtleVariation(content.replace(/{{nombre}}/g, target.nombre || 'Amigo/a'));

          if (orig.media_type === 'VOICE' && orig.media_url) {
            await whatsappService.sendVoice(currentTerminalId, target.telefono, orig.media_url);
          } else if (orig.media_url) {
            await whatsappService.sendMedia(currentTerminalId, target.telefono, orig.media_url, content);
          } else {
            await whatsappService.sendMessage(currentTerminalId, target.telefono, content);
          }
          successCount++;
          sentInSession++;
          db.prepare(`INSERT INTO whatsapp_broadcast_recipients (log_id, telefono, nombre, status) VALUES (?, ?, ?, 'SENT')`)
            .run(newLogId, target.telefono, target.nombre || '');
        } catch (err: any) {
          failCount++;
          db.prepare(`INSERT INTO whatsapp_broadcast_recipients (log_id, telefono, nombre, status, error_msg) VALUES (?, ?, ?, 'FAILED', ?)`)
            .run(newLogId, target.telefono, target.nombre || '', err?.message || 'Error');
        }
        db.prepare('UPDATE whatsapp_broadcast_logs SET success_count = ?, fail_count = ? WHERE id = ?').run(successCount, failCount, newLogId);
        if (i < failedRows.length - 1) {
          await new Promise(r => setTimeout(r, (minDelay + Math.random() * (maxDelay - minDelay)) * 1000));
          if (sentInSession > 0 && sentInSession % 15 === 0) {
            await new Promise(r => setTimeout(r, (20 + Math.random() * 20) * 1000));
          }
        }
      }
      const finalLog = db.prepare('SELECT status FROM whatsapp_broadcast_logs WHERE id = ?').get(newLogId) as any;
      const finalStatus = (finalLog?.status === 'CANCELLED' || finalLog?.status === 'PAUSED') ? finalLog.status : 'COMPLETED';
      db.prepare('UPDATE whatsapp_broadcast_logs SET success_count = ?, fail_count = ?, status = ? WHERE id = ?').run(successCount, failCount, finalStatus, newLogId);
    };

    runRetry();
    res.json({ success: true, log_id: newLogId, target_count: failedRows.length });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// GET /api/whatsapp/broadcast/:id/recipients — per-recipient results for community outbox
app.get('/api/whatsapp/broadcast/:id/recipients', (req, res) => {
  const role = getRole(req);
  if (role !== 'SUPERUSUARIO' && role !== 'JEFE_CAMPANA' && role !== 'SUBJEFE') return res.status(403).json({ error: 'Prohibido' });
  const logId = parseInt(req.params.id);
  const user_id = req.headers['x-user-id'] as string;
  const user = getCachedUserInfo(user_id);
  const page = parseInt((req.query.page as string) || '1');
  const limit = Math.min(parseInt((req.query.limit as string) || '200'), 500);
  const offset = (page - 1) * limit;
  const filterStatus = req.query.status as string | undefined; // 'SENT' | 'FAILED' | undefined

  try {
    // Verify access to this log
    const log = db.prepare('SELECT campaign_id FROM whatsapp_broadcast_logs WHERE id = ?').get(logId) as any;
    if (!log) return res.status(404).json({ error: 'Log no encontrado' });
    if (role !== 'SUPERUSUARIO' && user?.campaign_id && log.campaign_id && log.campaign_id !== user.campaign_id) {
      return res.status(403).json({ error: 'Prohibido' });
    }

    let where = 'WHERE log_id = ?';
    const params: any[] = [logId];
    if (filterStatus) {
      where += ' AND status = ?';
      params.push(filterStatus);
    }

    const total = (db.prepare(`SELECT COUNT(*) as cnt FROM whatsapp_broadcast_recipients ${where}`).get(...params) as any).cnt;
    const recipients = db.prepare(
      `SELECT id, telefono, nombre, status, error_msg, sent_at
       FROM whatsapp_broadcast_recipients
       ${where}
       ORDER BY id ASC
       LIMIT ? OFFSET ?`
    ).all(...params, limit, offset);

    res.json({
      recipients,
      total,
      page,
      pages: Math.ceil(total / limit),
      limit
    });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// Parse spintax formats like {Hola|Buenos días|Buenas}
function parseSpintax(text: string): string {
  return text.replace(/{([^{}]+)}/g, (match, choices) => {
    const list = choices.split('|');
    return list[Math.floor(Math.random() * list.length)];
  });
}

// Resolve spintax and add natural variation (NO zero-width chars \u2014 Meta detects those)
function addSubtleVariation(text: string): string {
  if (!text) return text;
  return parseSpintax(text);
}

app.post('/api/whatsapp/direct-message', async (req, res) => {
  const { number, message, media_url, media_type, lat, lng, terminalId: reqTerminalId, use_spintax } = req.body;
  const terminalId = reqTerminalId || 'default';
  try {
    let finalMessage = message;
    if (use_spintax && finalMessage) {
      finalMessage = addSubtleVariation(finalMessage);
    }

    if (media_type === 'VOICE') {
      await whatsappService.sendVoice(terminalId, number, media_url);
    } else if (media_type === 'LOCATION') {
      await whatsappService.sendLocation(terminalId, number, lat, lng, finalMessage);
    } else if (media_url) {
      await whatsappService.sendMedia(terminalId, number, media_url, finalMessage);
    } else {
      await whatsappService.sendMessage(terminalId, number, finalMessage);
    }
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/whatsapp/messages', (req, res) => {
  const user_id = req.headers['x-user-id'] as string;
  const user = getCachedUserInfo(user_id);
  const role = getRole(req);
  try {
    let sql = 'SELECT * FROM whatsapp_messages WHERE 1=1';
    const params: any[] = [];
    if (role !== 'SUPERUSUARIO' && user?.campaign_id) {
      sql += ' AND campaign_id = ?';
      params.push(user.campaign_id);
    }
    sql += ' ORDER BY timestamp DESC LIMIT 1000';
    const messages = db.prepare(sql).all(...params) as any[];
    res.json(messages.reverse());
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

app.get('/api/whatsapp/chats', (req, res) => {
  const user_id = req.headers['x-user-id'] as string;
  const user = getCachedUserInfo(user_id);
  const role = getRole(req);
  try {
    let sql = `
      SELECT
        m1.contact_number,
        COALESCE((SELECT m2.contact_name FROM whatsapp_messages m2 WHERE m2.contact_number = m1.contact_number AND m2.campaign_id = m1.campaign_id AND m2.contact_name IS NOT NULL LIMIT 1), m1.contact_number) as contact_name,
        m1.body as last_message,
        m1.timestamp,
        m1.is_incoming,
        (SELECT COUNT(*) FROM whatsapp_messages WHERE contact_number = m1.contact_number AND campaign_id = m1.campaign_id AND is_incoming = 1) as unread_count,
        m1.phone_number
      FROM whatsapp_messages m1
      WHERE m1.id IN (SELECT MAX(id) FROM whatsapp_messages WHERE 1=1 ${role !== 'SUPERUSUARIO' && user?.campaign_id ? 'AND campaign_id = ?' : ''} GROUP BY contact_number)
      ORDER BY m1.timestamp DESC
    `;
    const params: any[] = [];
    if (role !== 'SUPERUSUARIO' && user?.campaign_id) {
      params.push(user.campaign_id);
    }
    const chats = db.prepare(sql).all(...params) as any[];

    const resolveRegisteredName = (phone: string | null) => {
      if (!phone) return null;
      const hash = normalizePhone(phone);
      if (!hash) return null;

      try {
        const elector = db.prepare(`
          SELECT e.nombre, e.apellido
          FROM electors e
          JOIN elector_captures ec ON e.ci = ec.elector_ci
          WHERE ec.phone_hash = ?
          LIMIT 1
        `).get(hash) as any;
        if (elector) return `${elector.nombre} ${elector.apellido || ''}`.trim();
      } catch (e) {}

      try {
        const u = db.prepare(`
          SELECT nombre FROM users
          WHERE phone_hash = ?
          LIMIT 1
        `).get(hash) as any;
        if (u) return u.nombre;
      } catch (e) {}

      return null;
    };

    const resolvedChats = chats.map(chat => {
      const targetPhone = chat.phone_number || chat.contact_number.split('@')[0];
      const registeredName = resolveRegisteredName(targetPhone);
      return {
        ...chat,
        contact_name: registeredName || chat.contact_name,
        phone_number: targetPhone
      };
    });

    res.json(resolvedChats);
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// WhatsApp Recipient Selection Endpoints
app.get('/api/whatsapp/recipients/coordinators', (req, res) => {
  const role = getRole(req);
  if (role !== 'SUPERUSUARIO' && role !== 'JEFE_CAMPANA') return res.status(403).json({ error: 'Prohibido' });
  try {
    const sec = getSecurityFilter(req, 'u');
    const coordinators = db.prepare(`
      SELECT
        u.id, u.nombre, u.telefono, u.ci, u.distrito, u.parent_id,
        u.assigned_list_id, l.list_number, l.candidate_alias, l.candidate_nombre, l.ciudad,
        COUNT(ec.id) as capture_count
      FROM users u
      LEFT JOIN lists l ON u.assigned_list_id = l.id
      LEFT JOIN elector_captures ec ON ec.coordinator_id = u.id
      WHERE u.role = 'COORDINADOR' AND u.status = 'ACTIVE' ${sec.sql}
      GROUP BY u.id
      ORDER BY u.nombre
    `).all(...sec.params);
    res.json(coordinators);
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

app.get('/api/whatsapp/recipients/electors', (req, res) => {
  const role = getRole(req);
  if (role !== 'SUPERUSUARIO' && role !== 'JEFE_CAMPANA') return res.status(403).json({ error: 'Prohibido' });
  
  const padrinoId = req.query.padrino_id ? parseInt(req.query.padrino_id as string) : null;
  const coordinatorId = req.query.coordinator_id ? parseInt(req.query.coordinator_id as string) : null;
  
  try {
    const sec = getSecurityFilter(req, 'u');
    let query = `
      SELECT ec.id as capture_id, ec.elector_ci, ec.telefono, ec.traffic_light,
        COALESCE(e.nombre, 'ELECTOR') as nombre, COALESCE(e.apellido, 'NO REGISTRADO') as apellido, 
        COALESCE(e.local_votacion, 'REGISTRO DE CAMPO') as local_votacion, COALESCE(e.mesa, 0) as mesa, COALESCE(e.orden, 0) as orden,
        u.nombre as coordinator_nombre,
        p.nombre as padrino_nombre
      FROM elector_captures ec
      LEFT JOIN electors e ON ec.elector_ci = e.ci
      JOIN users u ON ec.coordinator_id = u.id
      LEFT JOIN users p ON u.parent_id = p.id
      WHERE ec.telefono IS NOT NULL AND ec.telefono != '' ${sec.sql}
    `;
    const params: any[] = [...sec.params];
    
    if (coordinatorId) {
      query += ' AND ec.coordinator_id = ?';
      params.push(coordinatorId);
    } else if (padrinoId) {
      query += ' AND (u.parent_id = ? OR ec.coordinator_id = ?)';
      params.push(padrinoId, padrinoId);
    }
    
    query += ' ORDER BY COALESCE(e.nombre, \'ELECTOR\')';
    
    const electors = db.prepare(query).all(...params);
    res.json((electors as any[]).map(sanitizeElectorData));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/whatsapp/recipients/padrinos', (req, res) => {
  const role = getRole(req);
  if (role !== 'SUPERUSUARIO' && role !== 'JEFE_CAMPANA') return res.status(403).json({ error: 'Prohibido' });
  try {
    const sec = getSecurityFilter(req, 'u');
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
      WHERE u.role = 'PADRINO' AND u.status = 'ACTIVE' ${sec.sql}
      GROUP BY u.id
      ORDER BY u.nombre
    `).all(...sec.params);
    res.json(padrinos);
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

app.get('/api/whatsapp/recipients/padrinos/:id/team', (req, res) => {
  const role = getRole(req);
  if (role !== 'SUPERUSUARIO' && role !== 'JEFE_CAMPANA') return res.status(403).json({ error: 'Prohibido' });
  const padrinoId = parseInt(req.params.id);
  try {
    const sec = getSecurityFilter(req, 'u');
    const coordinators = db.prepare(`
      SELECT u.id, u.nombre, u.telefono, u.ci, u.distrito,
        COUNT(ec.id) as capture_count
      FROM users u
      LEFT JOIN elector_captures ec ON ec.coordinator_id = u.id
      WHERE u.parent_id = ? AND u.role = 'COORDINADOR' ${sec.sql}
      GROUP BY u.id
      ORDER BY u.nombre
    `).all(padrinoId, ...sec.params);

    const electorsRaw = db.prepare(`
      SELECT ec.id as capture_id, ec.elector_ci, ec.telefono, ec.traffic_light,
        COALESCE(e.nombre, 'ELECTOR') as nombre, COALESCE(e.apellido, 'NO REGISTRADO') as apellido, 
        COALESCE(e.local_votacion, 'REGISTRO DE CAMPO') as local_votacion, COALESCE(e.mesa, 0) as mesa, COALESCE(e.orden, 0) as orden,
        u.id as coordinator_id, u.nombre as coordinator_nombre
      FROM elector_captures ec
      LEFT JOIN electors e ON ec.elector_ci = e.ci
      JOIN users u ON ec.coordinator_id = u.id
      WHERE u.parent_id = ? AND ec.telefono IS NOT NULL AND ec.telefono != '' ${sec.sql}
      ORDER BY u.nombre, COALESCE(e.nombre, 'ELECTOR')
    `).all(padrinoId, ...sec.params);

    res.json({ coordinators, electors: electorsRaw });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

app.get('/api/whatsapp/recipients/coordinator/:id/electors', (req, res) => {
  const role = getRole(req);
  if (role !== 'SUPERUSUARIO' && role !== 'JEFE_CAMPANA') return res.status(403).json({ error: 'Prohibido' });
  const coordId = parseInt(req.params.id);
  try {
    const sec = getSecurityFilter(req, 'u');
    const electors = db.prepare(`
      SELECT ec.id as capture_id, ec.elector_ci, ec.telefono, ec.traffic_light,
        COALESCE(e.nombre, 'ELECTOR') as nombre, COALESCE(e.apellido, 'NO REGISTRADO') as apellido, 
        COALESCE(e.local_votacion, 'REGISTRO DE CAMPO') as local_votacion, COALESCE(e.mesa, 0) as mesa, COALESCE(e.orden, 0) as orden
      FROM elector_captures ec
      LEFT JOIN electors e ON ec.elector_ci = e.ci
      JOIN users u ON ec.coordinator_id = u.id
      WHERE ec.coordinator_id = ? AND ec.telefono IS NOT NULL AND ec.telefono != '' ${sec.sql}
      ORDER BY COALESCE(e.nombre, 'ELECTOR')
    `).all(coordId, ...sec.params);
    res.json((electors as any[]).map(sanitizeElectorData));
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

app.get('/api/whatsapp/recipients/search', (req, res) => {
  const role = getRole(req);
  if (role !== 'SUPERUSUARIO' && role !== 'JEFE_CAMPANA') return res.status(403).json({ error: 'Prohibido' });
  const rawQ = (req.query.q as string) || '';
  const q = `%${rawQ}%`;
  const isPhoneSearch = /^\d+$/.test(rawQ.replace(/\D/g, ''));
  try {
    const sec = getSecurityFilter(req, 'u');
    const users = db.prepare(`
      SELECT u.id, u.nombre, u.telefono, u.ci, u.role, u.distrito FROM users u
      WHERE u.telefono IS NOT NULL AND u.telefono != '' AND u.status = 'ACTIVE'
        AND (u.nombre LIKE ? OR u.ci LIKE ? ${isPhoneSearch ? 'OR u.phone_hash = ?' : 'OR u.telefono LIKE ?'}) ${sec.sql}
      LIMIT 10
    `).all(q, q, isPhoneSearch ? normalizePhone(rawQ) : q, ...sec.params);

    const electors = db.prepare(`
      SELECT ec.elector_ci, ec.telefono, ec.traffic_light,
        COALESCE(e.nombre, 'ELECTOR') as nombre, COALESCE(e.apellido, 'NO REGISTRADO') as apellido,
        COALESCE(e.local_votacion, 'REGISTRO DE CAMPO') as local_votacion, COALESCE(e.mesa, 0) as mesa, COALESCE(e.orden, 0) as orden
      FROM elector_captures ec
      LEFT JOIN electors e ON ec.elector_ci = e.ci
      WHERE ec.telefono IS NOT NULL AND ec.telefono != ''
        AND (COALESCE(e.nombre, '') LIKE ? OR COALESCE(e.apellido, '') LIKE ? OR ec.elector_ci LIKE ? ${isPhoneSearch ? 'OR ec.phone_hash = ?' : 'OR ec.telefono LIKE ?'})
      LIMIT 10
    `).all(q, q, q, isPhoneSearch ? normalizePhone(rawQ) : q);

    res.json({ users, electors: (electors as any[]).map(sanitizeElectorData) });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

app.get('/api/admin/disputes/global', (req, res) => {
  const role = getRole(req);
  if (role !== 'SUPERUSUARIO') return res.status(403).json({ error: 'Acceso denegado' });

  try {
    const sec = getSecurityFilter(req, 'e');
    const disputes = db.prepare(`
      SELECT 
        COALESCE(e.ci, ec.elector_ci) as ci, 
        COALESCE(e.nombre, 'ELECTOR') as nombre, 
        COALESCE(e.apellido, 'NO REGISTRADO') as apellido, 
        COALESCE(e.local_votacion, 'REGISTRO DE CAMPO') as local_votacion,
        GROUP_CONCAT('Lista ' || l.list_number || ' (' || u.nombre || ')|' || ec.lat || '|' || ec.lng) as details,
        COUNT(DISTINCT ec.list_id) as list_count
      FROM elector_captures ec
      LEFT JOIN electors e ON ec.elector_ci = e.ci
      JOIN lists l ON ec.list_id = l.id
      JOIN users u ON ec.coordinator_id = u.id
      WHERE 1=1 ${sec.sql}
      GROUP BY COALESCE(e.ci, ec.elector_ci)
      HAVING list_count > 1
    `).all(...sec.params);
    res.json(disputes);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});


// --- DIA D (Election Day) HUB ENDPOINTS ---

app.get('/api/diad/coverage', async (req, res) => {
  const list_id = getListId(req);
  const role = getRole(req);
  const user_id = req.headers['x-user-id'];

  const cacheKey = `${user_id || 'global'}_${list_id || ''}`;
  const cached = await diadCoverageCache.get(cacheKey);
  if (cached) {
    return res.json(cached);
  }
  
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
    const mesasTotal = await dbGetAsync<any>(`SELECT COUNT(DISTINCT local_votacion || '-' || mesa) as total_mesas FROM electors ${distritoFilter}`, []);
    const total_mesas = mesasTotal?.total_mesas || 0;

    // 2. Operational Coverage: Mesas with at least 1 member assigned (VEEDOR or MIEMBRO_MESA)
    const assignedRow = await dbGetAsync<any>(`
      SELECT COUNT(DISTINCT u.assigned_local || '-' || u.assigned_mesa) as assigned_mesas
      FROM users u
      JOIN voting_locations vl ON u.assigned_local = vl.nombre
      WHERE (u.role = 'VEEDOR' OR u.role = 'MIEMBRO_MESA')
      AND u.assigned_local IS NOT NULL
      AND u.assigned_mesa IS NOT NULL
      ${vlFilter}
      ${list_id && !isNaN(list_id) ? `AND u.assigned_list_id = ${list_id}` : ''}
    `, []);
    const assigned_mesas = assignedRow?.assigned_mesas || 0;

    // 3. Results Coverage: Mesas with actas submitted
    const reportedRow = await dbGetAsync<any>(`
      SELECT COUNT(DISTINCT r.local_votacion || '-' || r.mesa) as reported_mesas
      FROM results r
      JOIN voting_locations vl ON r.local_votacion = vl.nombre
      WHERE 1=1 ${vlFilter}
      ${list_id && !isNaN(list_id) ? `AND r.tenant_id = ${list_id}` : ''}
    `, []);
    const reported_mesas = reportedRow?.reported_mesas || 0;

    // 4. Votos Procesados
    const votos = await dbGetAsync<any>(`
      SELECT
        (SELECT COALESCE(SUM(ar.votos), 0) FROM acta_results ar JOIN results r2 ON ar.acta_id = r2.id JOIN voting_locations vl ON r2.local_votacion = vl.nombre WHERE 1=1 ${vlFilter} ${list_id && !isNaN(list_id) ? `AND r2.tenant_id = ${list_id}` : ''}) +
        (SELECT COALESCE(SUM(r3.votos_blancos + r3.votos_nulos), 0) FROM results r3 JOIN voting_locations vl ON r3.local_votacion = vl.nombre WHERE 1=1 ${vlFilter} ${list_id && !isNaN(list_id) ? `AND r3.tenant_id = ${list_id}` : ''}) as total
    `, []);

    // 5. Mesas details for the map (Most critical for performance)
    const mesas = await dbQueryAsync<any>(`
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
    `, []);

    // 6. Active Coordinators
    const coordRow = await dbGetAsync<any>(`
      SELECT COUNT(*) as total_coordinadores FROM users u
      WHERE role = 'COORDINADOR'
      ${districtName ? `AND (UPPER(u.distrito) = UPPER('${districtName}'))` : ''}
      ${list_id && !isNaN(list_id) ? `AND u.assigned_list_id = ${list_id}` : ''}
    `, []);
    const total_coordinadores = coordRow?.total_coordinadores || 0;

    // 7. Active Vehicles (Móviles)
    const vehicRow = await dbGetAsync<any>(`
      SELECT COUNT(*) as total_vehiculos FROM vehicles v
      WHERE 1=1
      ${list_id && !isNaN(list_id) ? `AND (v.assigned_list_id = ${list_id})` : ''}
    `, []);
    const total_vehiculos = vehicRow?.total_vehiculos || 0;

    const responseData = {
      total_mesas,
      mesas_operativas: assigned_mesas,
      op_porcentaje: total_mesas > 0 ? (assigned_mesas / total_mesas) * 100 : 0,
      mesas_reportadas: reported_mesas,
      mesas_pendientes: total_mesas - reported_mesas,
      porcentaje: total_mesas > 0 ? (reported_mesas / total_mesas) * 100 : 0,
      votos_procesados: votos?.total || 0,
      total_coordinadores,
      total_vehiculos,
      mesas
    };

    await diadCoverageCache.set(cacheKey, responseData);
    res.json(responseData);
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
      SELECT u.id, u.nombre, u.assigned_local, u.assigned_mesa, u.role, u.ci, u.telefono
      FROM users u
      WHERE u.role IN ('VEEDOR', 'MIEMBRO_MESA', 'APODERADO')
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
        
        if (electorsInDistrito.length > 0) {
          const ciList = electorsInDistrito.map(e => e.ci);
          const placeholders = ciList.map(() => '?').join(',');
          db.prepare(`DELETE FROM elector_captures WHERE elector_ci IN (${placeholders})`).run(...ciList);
          db.prepare(`DELETE FROM capture_conflicts WHERE elector_ci IN (${placeholders})`).run(...ciList);
        }

        const locationsInDistrito = db.prepare('SELECT nombre FROM voting_locations WHERE distrito = ?').all(distrito) as any[];
        if (locationsInDistrito.length > 0) {
          const locList = locationsInDistrito.map(l => l.nombre);
          const placeholdersLoc = locList.map(() => '?').join(',');
          db.prepare(`DELETE FROM participation_logs WHERE local_votacion IN (${placeholdersLoc})`).run(...locList);
          db.prepare(`DELETE FROM results WHERE local_votacion IN (${placeholdersLoc})`).run(...locList);
          db.prepare(`DELETE FROM acta_results WHERE acta_id NOT IN (SELECT id FROM results)`).run();
        }

        logAction(1, 'SYSTEM_WIPE', 'DISTRICT', null, `Performed a wipe for district: ${distrito}`);
      }
    })();

    clearElectorsCache();
    invalidateAllReportsCaches();
    res.json({ success: true, message: distrito && distrito !== 'ALL' ? `Datos del distrito ${distrito} purgados` : 'Sistema purgado globalmente' });
  } catch (err: any) {
    console.error('[WIPE ERROR]', err);
    res.status(500).json({ error: err.message });
  }
});

if (process.env.NODE_ENV !== 'test') {
  app.listen(Number(PORT), '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`);

    serverReady = true;
    console.log('[SYSTEM] Server fully ready.');

    setImmediate(() => {
      console.log('[SYSTEM] Running async bootstrap checks...');
      runBootstrapChecks();
    });

    setTimeout(() => {
      console.log('[SYSTEM] Intentando auto-conectar WhatsApp...');
      whatsappService.connect('default').catch(err => console.error('Error in auto-connect:', err));
    }, 5000);
  });
}
