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
import whatsappRoutes from './routes/whatsapp';
import diadRoutes, { veedorRoutes } from './routes/diad';
import usersRoutes from './routes/users';
import teamRoutes from './routes/team';
import capturesRoutes, { conflictsRoutes, coordinatorsRoutes } from './routes/captures';
import statsRoutes from './routes/stats';
import logisticsRoutes, { vehiclesRoutes } from './routes/logistics';
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

    const conflictCounts = db.prepare(`
      SELECT status, COUNT(*) as c FROM capture_conflicts GROUP BY status
    `).all();
    const conflictTotal = db.prepare('SELECT COUNT(*) as c FROM capture_conflicts').get() as any;

    res.json({
      voting_locations: { total: totalLocations.c, with_geo: locationsWithGeo.c },
      captures: { total: totalCaptures.c, with_geo: capturesWithGeo.c },
      electors: { total: totalElectors.c },
      users: { total: totalUsers.c },
      conflicts: { total: conflictTotal.c, by_status: conflictCounts },
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
export const logAction = (user_id: number | null, action: string, entity: string, entity_id: string | number | null, details: string) => {
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

export const CaptureSchema = z.object({
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

// Consolidated in the admin/management section for consistency


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





// Real-time Vehicle Location reporting from Driver Mobile App

// Driver Mobile Login (Operational convenience via Plate or Driver CI)











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


// Audit Endpoints


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







// Strategic Command Center Endpoints





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






// ─────────────────────────────────────────────────────────────────────────────
// Extracted route modules

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

// ── Extracted route modules ───────────────────────────────────────────────────
app.use('/api/users', usersRoutes());
app.use('/api', teamRoutes(upload));
app.use('/api', statsRoutes());
app.use('/api/logistics', logisticsRoutes());
app.use('/api/vehicles', vehiclesRoutes());
app.use('/api/captures', capturesRoutes());
app.use('/api/coordinators', coordinatorsRoutes());
app.use('/api/admin/conflicts', conflictsRoutes());
app.use('/api/whatsapp', whatsappRoutes(storage));
app.use('/api/diad', diadRoutes(upload));
app.use('/api/veedor', veedorRoutes());

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
