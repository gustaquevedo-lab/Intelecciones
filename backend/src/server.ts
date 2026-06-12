process.env.TZ = 'America/Asuncion';
import express from 'express';
import crypto from 'crypto';
import cors from 'cors';
import { PostHog } from 'posthog-node';
import helmet from 'helmet';
import { rateLimit } from 'express-rate-limit';
import pinoHttp from 'pino-http';
import {
  getListId, getDistrict, getRole, getCachedUserInfo, clearUserCache,
  requireRole, getSecurityFilter, getTenant, applyTenantFilter, sanitizeElectorData
} from './routes/helpers';

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
import { Jimp, loadFont } from 'jimp';
import qrcode from 'qrcode';
import * as XLSX from 'xlsx';
import whatsappRoutes from './routes/whatsapp';
import diadRoutes, { veedorRoutes } from './routes/diad';
import tsjeRoutes from './routes/tsje';
import usersRoutes from './routes/users';
import teamRoutes from './routes/team';
import capturesRoutes, { conflictsRoutes, coordinatorsRoutes } from './routes/captures';
import statsRoutes from './routes/stats';
import logisticsRoutes, { vehiclesRoutes } from './routes/logistics';
import adminRoutes from './routes/admin';
import attendanceRoutes from './routes/attendance';
import voterCheckRoutes from './routes/votercheck';
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
  max: 600,
  message: { error: 'Límite de peticiones excedido.' },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => req.path.includes('/stream/'),
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

export const adminLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  message: { error: 'Demasiadas operaciones administrativas (30/min).' },
  standardHeaders: true,
  legacyHeaders: false,
});

export const broadcastLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  message: { error: 'Demasiadas transmisiones (5/min).' },
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
    del: async (key: string): Promise<void> => {
      await cacheService.delete(`${prefix}:${key}`);
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
  'http://localhost',
  'capacitor://localhost',
];

app.use(cors({
  origin: (origin, callback) => {
    // Allow absolutely everything to rule out CORS issues
    return callback(null, true);
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
app.use('/uploads', (req, res, next) => {
  res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
  next();
}, express.static(uploadDir));

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

    // No artificial cap when filtering by district — download full district padron
    let limit = activeDistrito ? 200000 : 10000;
    if (req.query.limit) {
      const parsedLimit = parseInt(req.query.limit as string);
      if (!isNaN(parsedLimit) && parsedLimit > 0) {
        limit = parsedLimit;
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

  // Headers SSE + bypass del buffering del proxy (Railway/nginx)
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  // Importante: desactivar timeout del socket — Railway corta HTTP/2 si no hay tráfico
  if (typeof (res as any).socket?.setTimeout === 'function') {
    (res as any).socket.setTimeout(0);
  }
  res.flushHeaders();

  res.write(`retry: 5000\n\n`);
  res.write(`data: ${JSON.stringify({ type: 'CONNECTED', message: 'SSE Connection Established' })}\n\n`);

  // Heartbeat cada 25s — mantiene viva la conexión contra HTTP/2 idle timeout
  const heartbeat = setInterval(() => {
    try { res.write(`: heartbeat ${Date.now()}\n\n`); }
    catch { clearInterval(heartbeat); }
  }, 25000);

  // Reemplaza cualquier conexión previa del mismo userId para evitar zombies
  const existing = sseClients.get(userId);
  if (existing && existing !== res) {
    try { existing.end(); } catch {}
  }
  sseClients.set(userId, res);
  console.log(`[SSE] Client connected: ${userId}. Total clients: ${sseClients.size}`);

  const cleanup = () => {
    clearInterval(heartbeat);
    if (sseClients.get(userId) === res) sseClients.delete(userId);
    console.log(`[SSE] Client disconnected: ${userId}. Total clients: ${sseClients.size}`);
  };
  req.on('close', cleanup);
  req.on('aborted', cleanup);
  res.on('error', cleanup);
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

app.get('/api/debug/db-info', requireRole('SUPERUSUARIO'), (req, res) => {
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

// Helpers imported from ./routes/helpers: getListId, getDistrict, getRole,
// getCachedUserInfo, clearUserCache, requireRole, getSecurityFilter,
// getTenant, applyTenantFilter, sanitizeElectorData

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
    SELECT u.*, c.enabled_modules as campaign_modules, COALESCE(u.distrito, c.distrito) as distrito, COALESCE(u.assigned_campaign_id, l.campaign_id) as final_campaign_id, c.status as campaign_status
    FROM users u
    LEFT JOIN lists l ON u.assigned_list_id = l.id
    LEFT JOIN campaigns c ON (u.assigned_campaign_id = c.id OR l.campaign_id = c.id)
    WHERE u.username = ? OR u.ci = ? OR u.username = ? OR u.ci = ?
       OR REPLACE(u.username, '.', '') = ? OR REPLACE(u.ci, '.', '') = ?
  `).get(username.trim(), username.trim(), cleanUsername, cleanUsername, cleanUsername, cleanUsername) as any;

  const normalizedSavedPassword = user?.password?.toString().replace(/\./g, '');
  const normalizedInputPassword = cleanPassword.replace(/\./g, '');

  const isSuccess = user && (user.password === cleanPassword || normalizedSavedPassword === normalizedInputPassword);

  if (!isSuccess && user) {
    console.log(`[AUTH] Login FAILED for "${username}" — pw lengths: db=${user.password?.length ?? -1}, input=${cleanPassword.length}, match=${user.password === cleanPassword}, normalizedMatch=${normalizedSavedPassword === normalizedInputPassword}`);
  }

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

        // SUBJEFE and JEFE_CAMPANA always get DAY_D access
        if (user.role === 'SUBJEFE' || user.role === 'JEFE_CAMPANA') {
          const baseMods = ['COMMAND_CENTER', 'REGISTRY', 'DAY_D'];
          const campMods = user.campaign_modules ? user.campaign_modules.split(',') : baseMods;
          const userMods = user.enabled_modules ? user.enabled_modules.split(',') : campMods;
          return [...new Set([...baseMods, ...userMods])].filter((m: string) => campMods.includes(m) || ['DAY_D'].includes(m));
        }

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

app.post('/api/dia-d/vote', async (req, res) => {
  const tenant_id = getTenant(req);
  const { elector_ci } = req.body;
  if (!elector_ci) return res.status(400).json({ error: 'elector_ci es requerido' });

  try {
    // 1. Register or update the vote in tenant_electors
    db.prepare(`
      INSERT OR REPLACE INTO tenant_electors (tenant_id, elector_ci, status, last_visit)
      VALUES (?, ?, 'Voto Realizado', CURRENT_TIMESTAMP)
    `).run(tenant_id, elector_ci);

    // 2. Fetch elector details
    const elector = db.prepare(`
      SELECT e.ci, e.nombre, e.apellido, e.local_votacion, e.mesa, e.orden, e.distrito, ec.telefono, ec.list_id
      FROM electors e
      LEFT JOIN elector_captures ec ON e.ci = ec.elector_ci AND ec.is_disputed = 0
      WHERE e.ci = ?
    `).get(elector_ci) as any;

    if (!elector) {
      return res.json({ success: true, warning: 'Voto registrado, pero elector no encontrado en el padrón.' });
    }

    const fullName = `${elector.nombre} ${elector.apellido || ''}`.trim();
    
    // Resolve base url
    const host = req.get('host') || '';
    let protocol = (req.headers['x-forwarded-proto'] as string) || req.protocol;
    if (process.env.NODE_ENV === 'production' || host.includes('railway.app') || host.includes('vercel.app')) {
      protocol = 'https';
    }
    const baseUrl = process.env.APP_URL ? process.env.APP_URL.replace(/\/$/, '') : `${protocol}://${host}`;
    
    // 3. Generate Styled QR Code Card (QR + Name)
    const verificationUrl = `${baseUrl}/validator?ci=${elector_ci}`;
    const qrBuffer = await qrcode.toBuffer(verificationUrl, {
      margin: 1,
      width: 300,
      errorCorrectionLevel: 'H'
    });

    const qrCard = new Jimp({ width: 400, height: 480, color: 0xffffffff });
    const qrImage = await Jimp.read(qrBuffer);

    // Try to load logo and overlay in center of QR
    try {
      const logoPath = process.env.NODE_ENV === 'production' 
        ? path.join(__dirname, '../public/favicon.png')
        : path.join(__dirname, '../../frontend/public/favicon.png');

      if (fs.existsSync(logoPath)) {
        const logo = await Jimp.read(logoPath);
        logo.resize({ w: 50, h: 50 });
        qrImage.composite(logo, 125, 125);
      } else {
        const fallbackLogoPath = path.join(process.cwd(), 'frontend/public/favicon.png');
        if (fs.existsSync(fallbackLogoPath)) {
          const logo = await Jimp.read(fallbackLogoPath);
          logo.resize({ w: 50, h: 50 });
          qrImage.composite(logo, 125, 125);
        }
      }
    } catch (logoErr) {
      console.warn('[QR LOGO ERROR] Could not overlay logo on QR:', logoErr);
    }

    qrCard.composite(qrImage, 50, 30);

    // Print elector name centered at the bottom
    try {
      const fontPath = process.env.NODE_ENV === 'production'
        ? path.join(__dirname, '../node_modules/@jimp/plugin-print/fonts/open-sans/open-sans-32-black/open-sans-32-black.fnt')
        : path.join(__dirname, '../node_modules/@jimp/plugin-print/fonts/open-sans/open-sans-32-black/open-sans-32-black.fnt');
      
      const font = await loadFont(fontPath);
      qrCard.print({
        font: font,
        x: 0,
        y: 380,
        text: {
          text: fullName.toUpperCase(),
          alignmentX: 'center' as any,
          alignmentY: 'middle' as any
        },
        maxWidth: 400
      });
    } catch (fontErr) {
      console.error('[QR FONT ERROR] Could not print elector name on QR:', fontErr);
    }

    const fileName = `qr-${elector_ci}.png`;
    const fullOutputPath = path.join(uploadDir, fileName);
    await qrCard.write(fullOutputPath as `${string}.${string}`);

    const qrMediaUrl = `${baseUrl}/uploads/${fileName}`;

    // 4. Send via WhatsApp if telephone is registered
    if (elector.telefono) {
      try {
        const terminals = await whatsappService.getTerminals(elector.list_id);
        const connectedTerminal = terminals.find(t => t.status === 'CONNECTED');
        const terminalId = connectedTerminal ? connectedTerminal.id : 'default';

        const caption = `¡Hola ${fullName}! Confirmamos la recepción de tu voto. Aquí tienes tu credencial QR para verificar tu asistencia. Presentá este código QR ante los validadores habilitados.`;
        await whatsappService.sendMedia(terminalId, elector.telefono, qrMediaUrl, caption);
        console.log(`[VOTE FLOW] QR sent to WhatsApp number: ${elector.telefono}`);
      } catch (wsErr: any) {
        console.error('[VOTE FLOW] WhatsApp dispatch failed:', wsErr.message);
      }
    }

    // 5. Broadcast real-time SSE confirmation to all connected web clients
    const ssePayload = {
      type: 'VOTE_CONFIRMED',
      data: {
        ci: elector.ci,
        nombre: elector.nombre,
        apellido: elector.apellido,
        local_votacion: elector.local_votacion,
        mesa: elector.mesa,
        orden: elector.orden,
        distrito: elector.distrito,
        timestamp: new Date().toISOString()
      }
    };

    sseClients.forEach((client: any) => {
      try {
        client.write(`data: ${JSON.stringify(ssePayload)}\n\n`);
      } catch (sseErr) {
        // Ignored
      }
    });

    res.json({ success: true, qr_url: qrMediaUrl });
  } catch (err: any) {
    console.error('[VOTE ERROR]', err);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/dia-d/validate', (req, res) => {
  const { elector_ci, validator_id } = req.body;
  if (!elector_ci) return res.status(400).json({ error: 'elector_ci es requerido' });
  const valId = validator_id || req.headers['x-user-id'];
  if (!valId) return res.status(400).json({ error: 'validator_id es requerido' });

  try {
    const elector = db.prepare(`
      SELECT e.ci, e.nombre, e.apellido, e.local_votacion, e.mesa, e.orden, e.distrito
      FROM electors e
      WHERE e.ci = ?
    `).get(elector_ci) as any;

    if (!elector) {
      return res.status(404).json({ error: 'Elector no encontrado en el padrón' });
    }

    db.prepare(`
      INSERT INTO vote_validations (elector_ci, validator_id)
      VALUES (?, ?)
    `).run(elector_ci, valId);

    const validator = db.prepare('SELECT nombre FROM users WHERE id = ?').get(valId) as any;

    res.json({
      success: true,
      elector: {
        ci: elector.ci,
        nombre: elector.nombre,
        apellido: elector.apellido,
        local_votacion: elector.local_votacion,
        mesa: elector.mesa,
        orden: elector.orden,
        distrito: elector.distrito
      },
      validation: {
        validator_name: validator?.nombre || 'Validador',
        timestamp: new Date().toISOString()
      }
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/dia-d/validate/:ci', (req, res) => {
  const { ci } = req.params;
  try {
    const elector = db.prepare(`
      SELECT e.ci, e.nombre, e.apellido, e.local_votacion, e.mesa, e.orden, e.distrito
      FROM electors e
      WHERE e.ci = ?
    `).get(ci) as any;

    if (!elector) {
      return res.status(404).json({ error: 'Elector no encontrado en el padrón' });
    }

    const validations = db.prepare(`
      SELECT vv.timestamp, u.nombre as validator_name
      FROM vote_validations vv
      JOIN users u ON vv.validator_id = u.id
      WHERE vv.elector_ci = ?
      ORDER BY vv.timestamp DESC
    `).all(ci) as any[];

    res.json({
      elector,
      validations
    });
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
  let distritoParams: any[] = [];
  if (!['SUPERUSUARIO', 'JEFE_CAMPANA', 'SUBJEFE', 'PADRINO'].includes(role) && user_id) {
    const user = db.prepare(`
      SELECT c.distrito 
      FROM users u 
      JOIN lists l ON u.assigned_list_id = l.id 
      JOIN campaigns c ON l.campaign_id = c.id 
      WHERE u.id = ?
    `).get(user_id) as any;
    if (user?.distrito) {
      distritoFilter = 'AND (e.distrito = ? OR e.ciudad = ?)';
      distritoParams = [user.distrito, user.distrito];
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
  `).get(effectiveListId, effectiveListId, ci, ...distritoParams);
  
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

app.get('/api/admin/verify-candidate/:ci', requireRole('SUPERUSUARIO','JEFE_CAMPANA','SUBJEFE','PADRINO'), (req, res) => {
  const ci = req.params.ci as string;
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
app.get('/api/admin/verify-user/:ci', requireRole('SUPERUSUARIO','JEFE_CAMPANA','SUBJEFE','PADRINO','COORDINADOR'), (req, res) => {
  const ci = req.params.ci as string;
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














app.get('/api/debug', requireRole('SUPERUSUARIO'), (req, res) => {
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










// ─────────────────────────────────────────────────────────────────────────────
// Extracted route modules



// --- DIA D (Election Day) HUB ENDPOINTS ---


// ── Extracted route modules ───────────────────────────────────────────────────
app.use('/api/users', usersRoutes());
app.use('/api', teamRoutes(upload));
app.use('/api', statsRoutes());
app.use('/api', adminRoutes(upload));
app.use('/api/logistics', logisticsRoutes());
app.use('/api/vehicles', vehiclesRoutes());
app.use('/api/captures', capturesRoutes());
app.use('/api/coordinators', coordinatorsRoutes());
app.use('/api/admin/conflicts', conflictsRoutes());
app.use('/api/whatsapp', whatsappRoutes(storage));
app.use('/api/diad', diadRoutes(upload));
app.use('/api/veedor', veedorRoutes());
app.use('/api/tsje', tsjeRoutes());
app.use('/api/attendance', attendanceRoutes());
app.use('/api/voter-check', voterCheckRoutes());

app.get('/api/file-check', (req, res) => {
  try {
    const filePath = path.join(__dirname, 'routes/diad.js');
    if (!fs.existsSync(filePath)) {
      return res.json({ error: `File not found: ${filePath}` });
    }
    const content = fs.readFileSync(filePath, 'utf8');
    const hasProcessActa = content.includes('process-acta');
    const size = fs.statSync(filePath).size;
    res.json({
      filePath,
      size,
      hasProcessActa,
      contentSnippet: content.slice(0, 300),
      lastLines: content.slice(-300)
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  const status = err.status || err.statusCode || 500;
  res.status(status).json({
    error: err.message || 'Error interno del servidor',
    ...(process.env.NODE_ENV === 'development' ? { stack: err.stack } : {})
  });
});

process.on('unhandledRejection', (reason: any) => {
  console.error('[FATAL] Unhandled Rejection:', reason instanceof Error ? reason.message : reason);
  if (reason?.stack) console.error(reason.stack);
});

process.on('uncaughtException', (err: Error) => {
  console.error('[FATAL] Uncaught Exception:', err.message);
  console.error(err.stack);
  setTimeout(() => process.exit(1), 1000);
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
