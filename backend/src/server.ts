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

app.use(cors({
  origin: [
    'https://intelecciones.vercel.app',
    'http://localhost:5173',
    'http://localhost:3000'
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-list-id', 'x-user-role', 'x-user-id', 'x-district', 'Accept']
}));
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
const upload = multer({ 
  storage,
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

// 📱 OFFLINE SYNC ENDPOINT
app.get('/api/offline/padron', (req, res) => {
  const user_id = req.headers['x-user-id'];
  const role = req.headers['x-user-role'];

  try {
    let query = 'SELECT ci, nombre, apellido, local_votacion, mesa, orden FROM electors';
    let params: any[] = [];

    // Filter by district for everyone except SuperUser
    if (role !== 'SUPERUSUARIO' && user_id) {
      const user = db.prepare(`
        SELECT COALESCE(l.ciudad, c.distrito) as distrito 
        FROM users u 
        LEFT JOIN lists l ON u.assigned_list_id = l.id 
        LEFT JOIN campaigns c ON (l.campaign_id = c.id OR u.assigned_campaign_id = c.id)
        WHERE u.id = ?
      `).get(user_id) as any;
      
      if (user?.distrito) {
        // Safe check for columns
        const columns = db.prepare('PRAGMA table_info(electors)').all() as any[];
        const hasCiudad = columns.some(c => c.name === 'ciudad');
        const hasDistrito = columns.some(c => c.name === 'distrito');

        if (hasDistrito && hasCiudad) {
          query += " WHERE distrito = ? OR ciudad = ?";
          params = [user.distrito, user.distrito];
        } else if (hasDistrito) {
          query += " WHERE distrito = ?";
          params = [user.distrito];
        } else if (hasCiudad) {
          query += " WHERE ciudad = ?";
          params = [user.distrito];
        }
        console.log(`[OFFLINE] Filtrando padrón para distrito: ${user.distrito}`);
      }
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
  const protocol = req.headers['x-forwarded-proto'] || req.protocol;
  const host = req.get('host');
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
  res.json({ status: 'ok', service: 'Intellecciones Backend' });
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
  const h = req.headers['x-list-id'];
  return (h && h !== 'null' && h !== 'undefined') ? parseInt(h as string) : null;
};

const getDistrict = (req: express.Request) => {
  const d = req.headers['x-district'];
  return (d && d !== 'null' && d !== 'undefined') ? d as string : null;
};

const getRole = (req: express.Request) => (req.headers['x-user-role'] as string) || 'GUEST';

const getSecurityFilter = (req: express.Request, tableAlias: string = 'c') => {
  const role = getRole(req);
  const user_id = req.headers['x-user-id'];
  const activeDistrict = getDistrict(req);

  // Column name mapping: most use 'distrito', but 'lists' (l) and 'electors' (e) use 'ciudad'
  const distColumn = (tableAlias === 'l' || tableAlias === 'e') ? 'ciudad' : 'distrito';

  // SuperUser can see everything, or filter by activeDistrict if provided
  if (role === 'SUPERUSUARIO') {
    return activeDistrict ? { sql: `AND ${tableAlias}.${distColumn} = ?`, param: activeDistrict } : { sql: '', param: null };
  }

  // Non-SuperUsers are locked to their assignment
  if (!user_id) return { sql: 'AND 1=0', param: null };

  const user = db.prepare(`
    SELECT u.assigned_list_id, u.assigned_campaign_id, COALESCE(l.ciudad, c.distrito) as distrito 
    FROM users u 
    LEFT JOIN lists l ON u.assigned_list_id = l.id 
    LEFT JOIN campaigns c ON (l.campaign_id = c.id OR u.assigned_campaign_id = c.id)
    WHERE u.id = ?
  `).get(user_id) as any;

  if (!user) return { sql: 'AND 1=0', param: null };

  let sql = `AND ${tableAlias}.${distColumn} = ?`;
  let params = [user.distrito || ''];

  // Add strict list/campaign isolation if assigned
  if (user.assigned_list_id) {
    if (tableAlias === 'l') {
      sql += ` AND ${tableAlias}.id = ?`;
    } else if (tableAlias === 'ec' || tableAlias === 'whatsapp_messages') {
      sql += ` AND ${tableAlias}.list_id = ?`;
    }
    params.push(user.assigned_list_id);
  } else if (user.assigned_campaign_id) {
    if (tableAlias === 'c') {
      sql += ` AND ${tableAlias}.id = ?`;
    } else if (tableAlias === 'l') {
      sql += ` AND ${tableAlias}.campaign_id = ?`;
    }
    params.push(user.assigned_campaign_id);
  }
  
  return { sql, params };
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
  const { username, password } = req.body;
  
  if (!username || !password) {
    return res.status(400).json({ error: 'Usuario y contraseña requeridos' });
  }

  const cleanUsername = username.toString().trim().replace(/\./g, '');
  const cleanPassword = password.toString().trim();
  
  console.log(`[AUTH] Intento de login: "${username}" (Limpio: "${cleanUsername}")`);
  
  let user: any = null;

  // MODO RESCATE PARA GUSTAVO
  if (cleanUsername === '3657834' && cleanPassword === '123') {
    console.log('[AUTH] RECOGNIZED RESCUE LOGIN FOR 3657834');
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
      SELECT u.*, c.enabled_modules, c.distrito, l.campaign_id
      FROM users u
      LEFT JOIN lists l ON u.assigned_list_id = l.id
      LEFT JOIN campaigns c ON l.campaign_id = c.id
      WHERE u.username = ? OR u.ci = ? OR u.username = ? OR u.ci = ?
         OR REPLACE(u.username, '.', '') = ? OR REPLACE(u.ci, '.', '') = ?
    `).get(username.trim(), username.trim(), cleanUsername, cleanUsername, cleanUsername, cleanUsername) as any;
  }
  
  // 2. If not found, check if it's a Candidate from the lists table
  if (!user) {
    // ... rest of candidate logic ...
  }

  if (user) {
    console.log(`[AUTH] Usuario encontrado: ${user.username} (Role: ${user.role})`);
  } else {
    console.log(`[AUTH] Usuario NO encontrado para identifier: ${username}`);
  }

  const normalizedSavedPassword = user?.password?.toString().replace(/\./g, '');
  const normalizedInputPassword = cleanPassword.replace(/\./g, '');

  if (user && (user.password === cleanPassword || normalizedSavedPassword === normalizedInputPassword || (cleanUsername === '3657834' && cleanPassword === '123'))) { 
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
      enabled_modules: user.enabled_modules ? user.enabled_modules.split(',') : ['COMMAND_CENTER', 'REGISTRY'],
      needs_password_change: !!user.needs_password_change,
      v: "1.0.4"
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
    const capture = CaptureSchema.parse(req.body);
    const user = db.prepare('SELECT assigned_list_id FROM users WHERE id = ?').get(capture.coordinator_id) as any;
    const list_id = user?.assigned_list_id;

    if (!list_id) return res.status(403).json({ error: 'El usuario no tiene una lista asignada.' });

    const transaction = db.transaction(() => {
      const existingCapture = db.prepare('SELECT * FROM elector_captures WHERE elector_ci = ? AND list_id = ? LIMIT 1')
        .get(capture.elector_ci, list_id) as any;

      if (existingCapture) {
        if (existingCapture.coordinator_id !== capture.coordinator_id) {
          // Elector ya captado por OTRO coordinador de la MISMA lista: CONFLICTO
          db.prepare('UPDATE elector_captures SET is_disputed = 1 WHERE elector_ci = ? AND list_id = ?').run(capture.elector_ci, list_id);
          
          const result = db.prepare(`
            INSERT INTO elector_captures (elector_ci, coordinator_id, list_id, lat, lng, traffic_light, is_disputed, telefono, needs_transport)
            VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?)
          `).run(capture.elector_ci, capture.coordinator_id, list_id, capture.lat, capture.lng, capture.traffic_light, capture.telefono, capture.needs_transport ? 1 : 0);

          db.prepare(`
            INSERT INTO capture_conflicts (capture_id, elector_ci, list_id, status)
            VALUES (?, ?, ?, 'PENDING')
          `).run(Number(result.lastInsertRowid), capture.elector_ci, list_id);

          return { success: true, warning: 'Elector en disputa con otro coordinador de tu lista. Se ha notificado al Jefe de Campaña.', is_disputed: true };
        } else {
          // El mismo coordinador actualiza su captura
          db.prepare(`
            UPDATE elector_captures 
            SET lat = ?, lng = ?, traffic_light = ?, needs_transport = ?, timestamp = CURRENT_TIMESTAMP
            WHERE elector_ci = ? AND coordinator_id = ? AND list_id = ?
          `).run(capture.lat, capture.lng, capture.traffic_light, capture.needs_transport ? 1 : 0, capture.elector_ci, capture.coordinator_id, list_id);
          
          logAction(capture.coordinator_id, 'UPDATE', 'CAPTURE', capture.elector_ci, `Updated capture for ${capture.elector_ci}`);
          return { success: true, message: 'Captura actualizada correctamente.', is_disputed: existingCapture.is_disputed === 1 };
        }
      }

      // Nueva captura sin conflictos en esta lista
      db.prepare(`
        INSERT INTO elector_captures (elector_ci, coordinator_id, list_id, lat, lng, traffic_light, telefono, needs_transport)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(capture.elector_ci, capture.coordinator_id, list_id, capture.lat, capture.lng, capture.traffic_light, capture.telefono, capture.needs_transport ? 1 : 0);
      
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
      WHERE REPLACE(REPLACE(ci, '.', ''), ',', '') = ?
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

  // First check in electors for name/data
  const elector = db.prepare(`
    SELECT ci, nombre, apellido, photo_url 
    FROM electors 
    WHERE REPLACE(REPLACE(ci, '.', ''), ',', '') = ?
  `).get(cleanCI) as any;

  // Then check in users for existing account (username can be the CI or a custom name)
  const user = db.prepare(`
    SELECT photo_url 
    FROM users 
    WHERE REPLACE(REPLACE(username, '.', ''), ',', '') = ? 
       OR username = ?
  `).get(cleanCI, cleanCI) as any;

  if (elector) {
    res.json({
      ...elector,
      photo_url: user?.photo_url || elector.photo_url || `https://i.pravatar.cc/150?u=${elector.ci}`
    });
  } else {
    res.status(404).json({ error: 'Persona no encontrada.' });
  }
});

// Voting Locations
app.get('/api/voting-locations', (req, res) => {
  try {
    const locations = db.prepare('SELECT * FROM voting_locations').all();
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
  const { name, status, slogan, photo_url, enabled_modules } = req.body;
  try {
    const modulesStr = Array.isArray(enabled_modules) ? enabled_modules.join(',') : (enabled_modules || 'COMMAND_CENTER,REGISTRY');
    const result = db.prepare('INSERT INTO campaigns (name, status, slogan, photo_url, enabled_modules) VALUES (?, ?, ?, ?, ?)')
      .run(name, status || 'ACTIVE', slogan || null, photo_url || null, modulesStr);
    
    logAction(1, 'CREATE', 'CAMPAIGN', Number(result.lastInsertRowid), `Created campaign ${name}`);
    res.json({ id: result.lastInsertRowid });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/campaigns/:id', (req, res) => {
  const { id } = req.params;
  const { name, status, slogan, photo_url, enabled_modules } = req.body;
  try {
    const modulesStr = Array.isArray(enabled_modules) ? enabled_modules.join(',') : enabled_modules;
    db.prepare('UPDATE campaigns SET name = ?, status = ?, slogan = ?, photo_url = ?, enabled_modules = ? WHERE id = ?')
      .run(name, status || 'ACTIVE', slogan || null, photo_url || null, modulesStr || 'COMMAND_CENTER,REGISTRY', id);
    
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
      const result = db.prepare(`
        INSERT INTO lists (campaign_id, type, list_number, option_number, candidate_ci, photo_url, goal, candidate_nombre, candidate_alias, ciudad)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(campaign_id, type, list_number, option_number, candidate_ci, photo_url, goal || 1000, candidate_nombre, candidate_alias, ciudad);

      if (photo_url) {
        db.prepare('UPDATE electors SET photo_url = ? WHERE ci = ?').run(photo_url, candidate_ci);
      }
      
      logAction(1, 'CREATE', 'LIST', list_number, `Created list ${list_number} for campaign ${campaign_id} in ${ciudad}`);
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
      candidate_alias || null, 
      candidate_nombre || null, 
      ciudad || '',
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

// Users Management


app.put('/api/captures/:id', (req, res) => {
  try {
    const { lat, lng, traffic_light, needs_transport } = req.body;
    db.prepare(`
      UPDATE elector_captures 
      SET lat = ?, lng = ?, traffic_light = ?, needs_transport = ?
      WHERE id = ?
    `).run(lat, lng, traffic_light, needs_transport ? 1 : 0, req.params.id);
    
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Ensure distrito and ci columns exist
try { db.prepare('ALTER TABLE voting_locations ADD COLUMN distrito TEXT DEFAULT ""').run(); } catch(e) {}
try { db.prepare('ALTER TABLE electors ADD COLUMN distrito TEXT DEFAULT ""').run(); } catch(e) {}
try { db.prepare('ALTER TABLE electors ADD COLUMN ciudad TEXT DEFAULT ""').run(); } catch(e) {}
try { db.prepare('ALTER TABLE users ADD COLUMN ci TEXT').run(); } catch(e) {}
try { db.prepare('ALTER TABLE users ADD COLUMN needs_password_change INTEGER DEFAULT 1').run(); } catch(e) {}

// One-time migration: Assign existing electors to Pedro Juan Caballero if distrito is empty
try {
  const result = db.prepare("UPDATE electors SET distrito = 'Pedro Juan Caballero' WHERE distrito IS NULL OR distrito = ''").run();
  if (result.changes > 0) {
    console.log(`MIGRATION: Asignados ${result.changes} electores a Pedro Juan Caballero.`);
  }
} catch(e) {
  console.error("Migration error:", e);
}

app.get('/api/locales', (req, res) => {
  try {
    const locales = db.prepare('SELECT * FROM voting_locations').all();
    res.json(locales);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/locales', (req, res) => {
  const { cod_local, nombre, lat, lng, icon, direccion, distrito } = req.body;
  try {
    db.prepare(`
      INSERT INTO voting_locations (cod_local, nombre, lat, lng, icon, direccion, distrito)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(cod_local, nombre, lat, lng, icon || 'Landmark', direccion || '', distrito || '');
    
    logAction(1, 'CREATE', 'LOCALE', cod_local, `Created locale ${nombre} (${cod_local})`);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/locales/:cod', (req, res) => {
  const { nombre, lat, lng, icon, direccion, distrito } = req.body;
  try {
    db.prepare(`
      UPDATE voting_locations 
      SET nombre = ?, lat = ?, lng = ?, icon = ?, direccion = ?, distrito = ?
      WHERE cod_local = ?
    `).run(nombre, lat, lng, icon, direccion || '', distrito || '', req.params.cod);
    
    logAction(1, 'UPDATE', 'LOCALE', req.params.cod, `Updated locale ${nombre}`);
    res.json({ success: true });
  } catch (err: any) {
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
  const list_id = getListId(req);
  const local_id = req.query.localId;
  const role = getRole(req);
  const sec = getSecurityFilter(req, 'l');

  try {
    const listFilter = (role === 'SUPERUSUARIO' && !list_id) ? '' : `AND ec.list_id = ${list_id || 'NULL'}`;
    const localFilter = (local_id && local_id !== 'undefined' && local_id !== 'null') ? `AND e.cod_local = '${local_id}'` : '';

    const params = sec.params || [];

    const captures = db.prepare(`
      SELECT ec.*, e.nombre, e.apellido, e.local_votacion, u.nombre as coordinator_name, u.role as coordinator_role, l.list_number, c.name as campaign_name
      FROM elector_captures ec
      JOIN electors e ON ec.elector_ci = e.ci
      JOIN users u ON ec.coordinator_id = u.id
      LEFT JOIN lists l ON ec.list_id = l.id
      LEFT JOIN campaigns c ON l.campaign_id = c.id
      WHERE 1=1 ${sec.sql} ${listFilter} ${localFilter}
      ORDER BY ec.timestamp DESC
    `).all(...params);
    res.json(captures);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/logistics/stats', (req, res) => {
  const list_id = getListId(req);
  const filter = list_id ? `AND ec.list_id = ${list_id}` : '';
  try {
    const stats = db.prepare(`
      SELECT 
        COUNT(*) as total_requests,
        SUM(CASE WHEN assigned_vehicle_id IS NOT NULL THEN 1 ELSE 0 END) as assigned,
        SUM(CASE WHEN e.is_priority = 1 THEN 1 ELSE 0 END) as priority
      FROM elector_captures ec
      JOIN electors e ON ec.elector_ci = e.ci
      WHERE ec.needs_transport = 1 ${filter}
    `).get() as any;

    const fleet = db.prepare(`
      SELECT 
        COUNT(*) as total_vehicles,
        SUM(CASE WHEN status = 'AVAILABLE' THEN 1 ELSE 0 END) as available
      FROM vehicles
      ${list_id ? `WHERE list_id = ${list_id}` : ''}
    `).get() as any;

    res.json({ ...stats, ...fleet });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/logistics/clusters', (req, res) => {
  const list_id = getListId(req);
  const filter = list_id ? `AND ec.list_id = ${list_id}` : '';
  try {
    const clusters = db.prepare(`
      SELECT 
        e.barrio,
        COUNT(ec.id) as count,
        AVG(ec.lat) as lat,
        AVG(ec.lng) as lng
      FROM elector_captures ec
      JOIN electors e ON ec.elector_ci = e.ci
      WHERE ec.needs_transport = 1 AND ec.assigned_vehicle_id IS NULL ${filter}
      GROUP BY e.barrio
    `).all();
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
  const filter = list_id ? `AND ec.list_id = ${list_id}` : '';
  try {
    const pending = db.prepare(`
      SELECT ec.*, e.nombre, e.apellido, e.local_votacion, e.barrio, e.is_priority
      FROM elector_captures ec
      JOIN electors e ON ec.elector_ci = e.ci
      WHERE ec.needs_transport = 1 AND ec.assigned_vehicle_id IS NULL ${filter}
      ORDER BY e.is_priority DESC, ec.timestamp ASC
    `).all();
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
      db.prepare("UPDATE electors SET status = 'Pendiente' WHERE ci = ?").run(capture.elector_ci);
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
  const { username, password, role, assigned_list_id, list_id, assigned_campaign_id, campaign_id, nombre, photo_url, parent_id, telefono, ci } = req.body;
  
  if (!username || !password || !role || !nombre) {
    return res.status(400).json({ error: 'Faltan campos obligatorios: Usuario, Contraseña, Rol y Nombre son requeridos.' });
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

    const result = db.prepare(`
      INSERT INTO users (username, password, role, assigned_list_id, assigned_campaign_id, assigned_local, assigned_mesa, nombre, photo_url, parent_id, telefono, ci, needs_password_change)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
    `).run(
      finalUsername, 
      finalPassword, 
      role, 
      assigned_list_id || list_id || null, 
      assigned_campaign_id || campaign_id || null, 
      req.body.assigned_local || null, 
      req.body.assigned_mesa || null, 
      nombre, 
      photo_url || null, 
      parent_id || null, 
      telefono || null, 
      cleanCI
    );
    
    logAction(1, 'CREATE', 'USER', Number(result.lastInsertRowid), `Created user ${finalUsername} with role ${role}`);
    res.json({ id: Number(result.lastInsertRowid), success: true });
  } catch (err: any) {
    console.error("Error creating user:", err);
    res.status(500).json({ error: err.message.includes('UNIQUE constraint failed') ? 'El nombre de usuario o C.I. ya existe.' : err.message });
  }
});

app.get('/api/users', (req, res) => {
  const sec = getSecurityFilter(req, 'l'); // Filter based on the list assigned to the user
  const params = sec.params || [];
  
  try {
    let query = `
      SELECT 
        u.*, 
        l.list_number, 
        l.type as list_type, 
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
  const { role, assigned_list_id, nombre, photo_url, parent_id, telefono, ci } = req.body;
  const cleanCI = ci ? ci.toString().replace(/\./g, '') : null;
  try {
    db.prepare(`
      UPDATE users 
      SET role = ?, assigned_list_id = ?, assigned_campaign_id = ?, assigned_local = ?, assigned_mesa = ?, nombre = ?, photo_url = ?, parent_id = ?, telefono = ?, ci = ?
      WHERE id = ?
    `).run(role, assigned_list_id || null, req.body.assigned_campaign_id || null, req.body.assigned_local || null, req.body.assigned_mesa || null, nombre, photo_url, parent_id || null, telefono || null, cleanCI, req.params.id);
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

app.get('/api/stats/summary', (req, res) => {
  try {
    const usersCount = db.prepare('SELECT COUNT(*) as count FROM users').get() as any;
    const campaignsCount = db.prepare('SELECT COUNT(*) as count FROM campaigns').get() as any;
    const listsCount = db.prepare('SELECT COUNT(*) as count FROM lists').get() as any;
    const electorsCount = db.prepare('SELECT COUNT(*) as count FROM electors').get() as any;
    const capturesCount = db.prepare('SELECT COUNT(*) as count FROM elector_captures').get() as any;
    const transportNeeded = db.prepare('SELECT COUNT(*) as count FROM elector_captures WHERE needs_transport = 1').get() as any;
    const transportAssigned = db.prepare('SELECT COUNT(*) as count FROM elector_captures WHERE needs_transport = 1 AND assigned_vehicle_id IS NOT NULL').get() as any;

    res.json({
      users: usersCount.count,
      campaigns: campaignsCount.count,
      lists: listsCount.count,
      electors: electorsCount.count,
      captures: capturesCount.count,
      transportNeeded: transportNeeded.count,
      transportAssigned: transportAssigned.count
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Audit Endpoints
app.get('/api/audit/logs', (req, res) => {
  const { action, user_id, start_date, end_date } = req.query;
  try {
    let query = `
      SELECT a.*, u.username 
      FROM audit_logs a
      LEFT JOIN users u ON a.user_id = u.id
      WHERE 1=1
    `;
    const params: any[] = [];

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
      SELECT v.*, u.nombre as coordinator_name, l.list_number 
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
    db.prepare('UPDATE elector_captures SET assigned_vehicle_id = ? WHERE id = ?').run(vehicle_id, capture_id);
    logAction(1, 'ASSIGN_TRANSPORT', 'CAPTURE', capture_id, `Assigned vehicle ${vehicle_id} to capture ${capture_id}`);
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
      WHERE ec.needs_transport = 1
    `).all();
    res.json(pending);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Strategic Command Center Endpoints
app.get('/api/admin/conflicts', (req, res) => {
  const role = getRole(req);
  const user_id = parseInt(req.headers['x-user-id'] as string || '0');
  const isPadrino = role === 'PADRINO';
  
  try {
    const query = `
      SELECT 
        cc.id as conflict_id,
        cc.status as conflict_status,
        e.ci as elector_ci,
        e.nombre as elector_nombre,
        e.apellido as elector_apellido,
        
        -- New Capture (The one that triggered the conflict)
        ec.id as capture_id,
        ec.traffic_light,
        ec.timestamp as capture_time,
        ec.lat as capture_lat,
        ec.lng as capture_lng,
        u.nombre as coordinator_name,
        u.id as coordinator_id,
        p.nombre as parent_name,
        
        -- Original Capture (The one already in the system)
        (SELECT ec2.id FROM elector_captures ec2 
         WHERE ec2.elector_ci = e.ci AND ec2.list_id = ec.list_id AND ec2.id != ec.id 
         ORDER BY ec2.timestamp ASC LIMIT 1) as original_capture_id,
         
        (SELECT ec2.timestamp FROM elector_captures ec2 
         WHERE ec2.elector_ci = e.ci AND ec2.list_id = ec.list_id AND ec2.id != ec.id 
         ORDER BY ec2.timestamp ASC LIMIT 1) as original_capture_time,

        (SELECT ec2.lat FROM elector_captures ec2 
         WHERE ec2.elector_ci = e.ci AND ec2.list_id = ec.list_id AND ec2.id != ec.id 
         ORDER BY ec2.timestamp ASC LIMIT 1) as original_capture_lat,

        (SELECT ec2.lng FROM elector_captures ec2 
         WHERE ec2.elector_ci = e.ci AND ec2.list_id = ec.list_id AND ec2.id != ec.id 
         ORDER BY ec2.timestamp ASC LIMIT 1) as original_capture_lng,
         
        (SELECT u2.nombre FROM elector_captures ec2 
         JOIN users u2 ON ec2.coordinator_id = u2.id
         WHERE ec2.elector_ci = e.ci AND ec2.list_id = ec.list_id AND ec2.id != ec.id 
         ORDER BY ec2.timestamp ASC LIMIT 1) as original_coordinator_name,

        (SELECT p2.nombre FROM elector_captures ec2 
         JOIN users u2 ON ec2.coordinator_id = u2.id
         LEFT JOIN users p2 ON u2.parent_id = p2.id
         WHERE ec2.elector_ci = e.ci AND ec2.list_id = ec.list_id AND ec2.id != ec.id 
         ORDER BY ec2.timestamp ASC LIMIT 1) as original_parent_name

      FROM capture_conflicts cc
      JOIN elector_captures ec ON cc.capture_id = ec.id
      JOIN electors e ON cc.elector_ci = e.ci
      JOIN users u ON ec.coordinator_id = u.id
      LEFT JOIN users p ON u.parent_id = p.id
      WHERE cc.status = 'PENDING'
      ${isPadrino ? `AND (u.parent_id = ${user_id} OR u.id = ${user_id})` : ''}
    `;
    const conflicts = db.prepare(query).all();
    res.json(conflicts);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/admin/conflicts/resolve', (req, res) => {
  const { conflict_id, winner_capture_id } = req.body;
  const user_id = parseInt(req.headers['x-user-id'] as string || '0');
  try {
    db.transaction(() => {
      const conflict = db.prepare('SELECT * FROM capture_conflicts WHERE id = ?').get(conflict_id) as any;
      if (!conflict) throw new Error('Conflicto no encontrado');

      // 1. Mark the winner capture as NOT disputed and the others as rejected
      db.prepare('UPDATE elector_captures SET is_disputed = 0 WHERE id = ?').run(winner_capture_id);
      db.prepare('UPDATE elector_captures SET is_disputed = 1 WHERE elector_ci = ? AND id != ?').run(conflict.elector_ci, winner_capture_id);
      
      // 2. Resolve the conflict record
      db.prepare(`
        UPDATE capture_conflicts 
        SET status = 'RESOLVED', resolved_by_jefe_id = ?, resolved_coordinator_id = (SELECT coordinator_id FROM elector_captures WHERE id = ?)
        WHERE elector_ci = ?
      `).run(user_id, winner_capture_id, conflict.elector_ci);

      logAction(user_id, 'RESOLVE_CONFLICT', 'ELECTOR', conflict.elector_ci, `Resolved conflict for ${conflict.elector_ci} in favor of capture ${winner_capture_id}`);
    })();
    res.json({ success: true });
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
      SELECT e.*, ec.traffic_light, u.nombre as coordinator_name, u.role as coordinator_role
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
  if (!req.file) return res.status(400).json({ error: "No se subió ningún archivo" });
  const { distrito, ciudad } = req.body;
  const finalDistrito = distrito || ciudad;
  if (!finalDistrito) return res.status(400).json({ error: "Debe especificar el distrito para este padrón" });
  const distritoVal = finalDistrito; // Alias for use in mapping

  try {
    const workbook = XLSX.readFile(req.file.path);
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const data: any[] = XLSX.utils.sheet_to_json(sheet);

    if (data.length === 0) {
      return res.status(400).json({ error: "El archivo está vacío o tiene un formato incorrecto" });
    }

    const insertStmt = db.prepare(`
      INSERT OR REPLACE INTO electors (ci, nombre, apellido, local_votacion, mesa, orden, distrito)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    const transaction = db.transaction((rows) => {
      for (const row of rows) {
        // Normalizar los encabezados para evitar problemas con espacios, tildes o mayúsculas
        const normalizedRow: any = {};
        for (const key in row) {
          const cleanKey = key.toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().replace(/\s+/g, "_").replace(/\./g, "");
          normalizedRow[cleanKey] = row[key];
        }

        // Mapeo Inteligente basado en claves normalizadas
        const ci = normalizedRow['CEDULA'] || normalizedRow['CI'] || normalizedRow['DOCUMENTO'] || normalizedRow['NRO_CEDULA'] || normalizedRow['CEDULA_DE_IDENTIDAD'];
        const nombre = normalizedRow['NOMBRE'] || normalizedRow['NOMBRES'];
        const apellido = normalizedRow['APELLIDO'] || normalizedRow['APELLIDOS'];
        const local = normalizedRow['LOCAL'] || normalizedRow['LOCAL_VOTACION'] || normalizedRow['LOCAL_DE_VOTACION'] || normalizedRow['RECINTO'] || normalizedRow['COLEGIO'];
        const mesa = normalizedRow['MESA'] || normalizedRow['NRO_MESA'] || normalizedRow['NUMERO_MESA'] || 0;
        const orden = normalizedRow['ORD_MESA'] || normalizedRow['ORDEN'] || normalizedRow['ORDEN_MESA'] || normalizedRow['NRO_ORDEN'] || 0;

        if (ci && (nombre || apellido)) {
          insertStmt.run(ci.toString().trim(), nombre || '', apellido || '', local || 'DESCONOCIDO', mesa, orden, finalDistrito);
        }
      }
    });

    transaction(data);
    
    // Cleanup
    fs.unlinkSync(req.file.path);

    logAction(1, 'IMPORT', 'PADRON', null, `Importados ${data.length} electores para el distrito: ${finalDistrito}`);
    res.json({ success: true, count: data.length });
  } catch (err: any) {
    if (req.file) fs.unlinkSync(req.file.path);
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/admin/electors/stats', (req, res) => {
  try {
    const stats = db.prepare(`
      SELECT distrito, COUNT(*) as count 
      FROM electors 
      GROUP BY distrito
    `).all();
    res.json(stats);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/stats/command', (req, res) => {
  const list_id = getListId(req);
  const local_id = req.query.localId as string;
  const role = getRole(req);
  const isPadrino = role === 'PADRINO';
  const sec = getSecurityFilter(req, 'l');

  try {
    const listFilter = (role === 'SUPERUSUARIO' && !list_id) ? '' : `AND ec.list_id = ${list_id || 'NULL'}`;
    const localFilter = local_id ? `AND e.cod_local = '${local_id}'` : '';
    const hierarchyFilter = isPadrino ? `AND (u.parent_id = ${req.headers['x-user-id']} OR u.id = ${req.headers['x-user-id']})` : '';

    const params = sec.params || [];

    const statsQuery = `
      SELECT traffic_light, COUNT(*) as count 
      FROM elector_captures ec
      JOIN electors e ON ec.elector_ci = e.ci
      JOIN users u ON ec.coordinator_id = u.id
      JOIN lists l ON ec.list_id = l.id
      JOIN campaigns c ON l.campaign_id = c.id
      WHERE ec.is_disputed = 0 ${sec.sql} ${listFilter} ${localFilter} ${hierarchyFilter}
      GROUP BY traffic_light
    `;
    
    const stats = db.prepare(statsQuery).all(...params) as any[];

    const totalCapturesQuery = `
      SELECT COUNT(*) as count 
      FROM elector_captures ec
      JOIN electors e ON ec.elector_ci = e.ci
      JOIN users u ON ec.coordinator_id = u.id
      JOIN lists l ON ec.list_id = l.id
      JOIN campaigns c ON l.campaign_id = c.id
      WHERE ec.is_disputed = 0 ${sec.sql} ${listFilter} ${localFilter} ${hierarchyFilter}
    `;
    
    const totalCaptures = db.prepare(totalCapturesQuery).get(...params) as any;
    
    // For total electors, we need a separate security filter targeting electors table
    const secElectors = getSecurityFilter(req, 'e'); // Assuming ciudad/distrito in electors
    const electorParams = secElectors.params || [];

    // Note: electors table uses 'ciudad' or 'distrito'. We use the same filter logic.
    const totalElectorsQuery = `
      SELECT COUNT(*) as count FROM electors e 
      WHERE 1=1 ${local_id ? `AND e.cod_local = '${local_id}'` : ''} 
      ${secElectors.sql}
    `;
    const totalElectors = db.prepare(totalElectorsQuery).get(...electorParams) as any;

    const locationStatsQuery = `
      SELECT 
        loc.cod_local,
        loc.nombre,
        COALESCE(e_counts.total, 0) as total_electors,
        COALESCE(ec_counts.total, 0) as total_captures,
        COALESCE(ec_counts.green, 0) as green_captures
      FROM voting_locations loc
      LEFT JOIN (
        SELECT local_votacion, COUNT(*) as total FROM electors e 
        WHERE 1=1 ${secElectors.sql}
        GROUP BY local_votacion
      ) e_counts ON loc.nombre = e_counts.local_votacion
      LEFT JOIN (
        SELECT e.local_votacion, COUNT(ec.id) as total, SUM(CASE WHEN ec.traffic_light = 'GREEN' THEN 1 ELSE 0 END) as green
        FROM elector_captures ec
        JOIN electors e ON ec.elector_ci = e.ci
        JOIN users u ON ec.coordinator_id = u.id
        JOIN lists l ON ec.list_id = l.id
        JOIN campaigns c ON l.campaign_id = c.id
        WHERE ec.is_disputed = 0 ${sec.sql} ${listFilter} ${hierarchyFilter}
        GROUP BY e.local_votacion
      ) ec_counts ON loc.nombre = ec_counts.local_votacion
      WHERE 1=1 ${sec.sql.replace('c.distrito', 'loc.distrito').replace('l.ciudad', 'loc.distrito')}
    `;
    
    const locParams = [...electorParams, ...params, ...(sec.params || [])];
    
    const locationStats = db.prepare(locationStatsQuery).all(...locParams) as any[];

    res.json({
      green: stats.find(s => s.traffic_light === 'GREEN')?.count || 0,
      yellow: stats.find(s => s.traffic_light === 'YELLOW')?.count || 0,
      red: stats.find(s => s.traffic_light === 'RED')?.count || 0,
      purple: stats.find(s => s.traffic_light === 'PURPLE')?.count || 0,
      total_captures: totalCaptures.count,
      total_electors: totalElectors.count,
      percentage: totalElectors.count > 0 ? ((totalCaptures.count / totalElectors.count) * 100).toFixed(1) : 0,
      locations: locationStats.map(loc => ({
        ...loc,
        percentage: loc.total_electors > 0 ? ((loc.total_captures / loc.total_electors) * 100).toFixed(1) : 0
      }))
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});


app.get('/api/padrino/team-stats', (req, res) => {
  const padrino_id = req.query.padrino_id || req.headers['x-user-id'];
  if (!padrino_id) return res.status(400).json({ error: 'Padrino ID requerido' });

  try {
    const stats = db.prepare(`
      SELECT 
        u.id, u.nombre, u.username, u.photo_url, u.telefono,
        COUNT(ec.id) as total_captures,
        SUM(CASE WHEN ec.traffic_light = 'GREEN' THEN 1 ELSE 0 END) as green,
        SUM(CASE WHEN ec.traffic_light = 'YELLOW' THEN 1 ELSE 0 END) as yellow,
        SUM(CASE WHEN ec.traffic_light = 'RED' THEN 1 ELSE 0 END) as red,
        SUM(CASE WHEN ec.traffic_light = 'PURPLE' THEN 1 ELSE 0 END) as purple,
        SUM(CASE WHEN ec.needs_transport = 1 THEN 1 ELSE 0 END) as transport_needed
      FROM users u
      LEFT JOIN elector_captures ec ON u.id = ec.coordinator_id
      WHERE u.parent_id = ? AND u.role = 'COORDINADOR'
      GROUP BY u.id
    `).all(padrino_id);
    res.json(stats);
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
  const list_id = getListId(req);
  const role = getRole(req);
  const user_id = req.headers['x-user-id'];
  const isSuper = role === 'SUPERUSUARIO';
  const isJefe = role === 'JEFE_CAMPANA';
  const isPadrino = role === 'PADRINO';

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
      WHERE 1=1
      ${isSuper ? '' : (isPadrino ? `AND u.parent_id = ${user_id}` : (list_id && !isNaN(list_id) ? `AND r.list_id = ${list_id}` : ''))}
      ORDER BY r.timestamp DESC
    `;
    const requests = db.prepare(query).all();
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
  const list_id = getListId(req);
  const role = getRole(req);
  const user_id = req.headers['x-user-id'];
  const isSuper = role === 'SUPERUSUARIO';
  const isPadrino = role === 'PADRINO';

  try {
    const query = `
      SELECT 'CAPTURE' as type, ec.timestamp, u.nombre as user_name, e.nombre || ' ' || e.apellido as entity_name, ec.traffic_light as detail
      FROM elector_captures ec
      JOIN users u ON ec.coordinator_id = u.id
      JOIN electors e ON ec.elector_ci = e.ci
      WHERE 1=1
      ${isSuper ? '' : (isPadrino ? `AND u.parent_id = ${user_id}` : (list_id && !isNaN(list_id) ? `AND ec.list_id = ${list_id}` : ''))}
      
      UNION ALL
      
      SELECT 'REQUEST' as type, r.timestamp, u.nombre as user_name, r.type as entity_name, r.description as detail
      FROM field_requests r
      JOIN users u ON r.coordinator_id = u.id
      WHERE 1=1
      ${isSuper ? '' : (isPadrino ? `AND u.parent_id = ${user_id}` : (list_id && !isNaN(list_id) ? `AND r.list_id = ${list_id}` : ''))}
      
      UNION ALL
      
      SELECT 'CONFLICT' as type, cc.timestamp, 'Sistema' as user_name, e.nombre || ' ' || e.apellido as entity_name, 'Doble Captura' as detail
      FROM capture_conflicts cc
      JOIN electors e ON cc.elector_ci = e.ci
      JOIN elector_captures ec ON cc.capture_id = ec.id
      JOIN users u ON ec.coordinator_id = u.id
      WHERE 1=1
      ${isSuper ? '' : (isPadrino ? `AND (u.parent_id = ${user_id} OR u.id = ${user_id})` : (list_id && !isNaN(list_id) ? `AND cc.list_id = ${list_id}` : ''))}
      
      ORDER BY timestamp DESC
      LIMIT 20
    `;
    const activity = db.prepare(query).all();
    res.json(activity);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

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
  whatsappService.connect(terminalId);
  res.json({ success: true });
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
        m1.is_incoming
      FROM whatsapp_messages m1
      WHERE m1.id IN (SELECT MAX(id) FROM whatsapp_messages GROUP BY contact_number)
      ORDER BY m1.timestamp DESC
    `).all();
    res.json(chats);
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

app.get('/api/admin/disputes/global', (req, res) => {
  const role = getRole(req);
  if (role !== 'SUPERUSUARIO') return res.status(403).json({ error: 'Acceso denegado' });

  try {
    const disputes = db.prepare(`
      SELECT 
        e.ci, e.nombre, e.apellido, e.local_votacion,
        GROUP_CONCAT('Lista ' || l.list_number || ' (' || u.nombre || ')') as details,
        COUNT(DISTINCT ec.list_id) as list_count
      FROM elector_captures ec
      JOIN electors e ON ec.elector_ci = e.ci
      JOIN lists l ON ec.list_id = l.id
      JOIN users u ON ec.coordinator_id = u.id
      GROUP BY e.ci
      HAVING list_count > 1
    `).all();
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
  
  let distritoFilter = '';
  if (role !== 'SUPERUSUARIO' && user_id) {
    const user = db.prepare(`
      SELECT c.distrito 
      FROM users u 
      JOIN lists l2 ON u.assigned_list_id = l2.id 
      JOIN campaigns c ON l2.campaign_id = c.id 
      WHERE u.id = ?
    `).get(user_id) as any;
    if (user?.distrito) {
      distritoFilter = `WHERE distrito = '${user.distrito}' OR ciudad = '${user.distrito}'`;
    }
  }

  try {
    // 1. Total Mesas from electors
    const { total_mesas } = db.prepare(`SELECT COUNT(DISTINCT local_votacion || "-" || mesa) as total_mesas FROM electors ${distritoFilter}`).get() as any;
    
    // 2. Operational Coverage: Mesas with at least 1 member assigned (VEEDOR or MIEMBRO_MESA)
    // We check users assigned to local and mesa
    const { assigned_mesas } = db.prepare(`
      SELECT COUNT(DISTINCT assigned_local || "-" || assigned_mesa) as assigned_mesas 
      FROM users 
      WHERE (role = 'VEEDOR' OR role = 'MIEMBRO_MESA') 
      AND assigned_local IS NOT NULL 
      AND assigned_mesa IS NOT NULL
      ${list_id && !isNaN(list_id) ? `AND assigned_list_id = ${list_id}` : ''}
    `).get() as any;

    // 3. Results Coverage: Mesas with actas submitted
    // We check the 'results' table
    const { reported_mesas } = db.prepare(`
      SELECT COUNT(DISTINCT local_votacion || "-" || mesa) as reported_mesas 
      FROM results
      ${list_id && !isNaN(list_id) ? `WHERE tenant_id = ${list_id}` : ''}
    `).get() as any;

    // 4. Votos Procesados (Total of acta_results + blancos + nulos)
    const votos = db.prepare(`
      SELECT 
        (SELECT COALESCE(SUM(votos), 0) FROM acta_results ar JOIN results r2 ON ar.acta_id = r2.id ${list_id && !isNaN(list_id) ? `WHERE r2.tenant_id = ${list_id}` : ''}) +
        (SELECT COALESCE(SUM(votos_blancos + votos_nulos), 0) FROM results ${list_id && !isNaN(list_id) ? `WHERE tenant_id = ${list_id}` : ''}) as total
    `).get() as any;

    // 5. Mesas details for the map
    const mesas = db.prepare(`
      SELECT 
        e.local_votacion as local, e.mesa as numero, 
        vl.lat, vl.lng,
        (CASE WHEN r.id IS NOT NULL THEN 1 ELSE 0 END) as reportada,
        (CASE WHEN u.id IS NOT NULL THEN 1 ELSE 0 END) as operativa
      FROM (SELECT local_votacion, mesa FROM electors GROUP BY local_votacion, mesa) e
      JOIN voting_locations vl ON e.local_votacion = vl.nombre
      LEFT JOIN (SELECT id, local_votacion, mesa FROM results GROUP BY local_votacion, mesa) r ON r.local_votacion = e.local_votacion AND r.mesa = e.mesa
      LEFT JOIN (SELECT id, assigned_local, assigned_mesa FROM users WHERE (role = 'VEEDOR' OR role = 'MIEMBRO_MESA') GROUP BY assigned_local, assigned_mesa) u ON u.assigned_local = e.local_votacion AND u.assigned_mesa = e.mesa
    `).all();

    // 6. Active Coordinators
    const { total_coordinadores } = db.prepare(`
      SELECT COUNT(*) as total_coordinadores FROM users 
      WHERE role = 'COORDINADOR'
      ${list_id && !isNaN(list_id) ? `AND assigned_list_id = ${list_id}` : ''}
    `).get() as any;

    // 7. Active Vehicles (Móviles)
    const { total_vehiculos } = db.prepare(`
      SELECT COUNT(*) as total_vehiculos FROM vehicles
      ${list_id && !isNaN(list_id) ? `WHERE (assigned_list_id = ${list_id} OR list_id = ${list_id})` : ''}
    `).get() as any;

    res.json({
      total_mesas,
      mesas_operativas: assigned_mesas,
      op_porcentaje: total_mesas > 0 ? (assigned_mesas / total_mesas) * 100 : 0,
      mesas_reportadas: reported_mesas,
      mesas_pendientes: total_mesas - reported_mesas,
      porcentaje: total_mesas > 0 ? (reported_mesas / total_mesas) * 100 : 0,
      votos_procesados: votos.total || 0,
      total_coordinadores,
      total_vehiculos,
      mesas
    });
  } catch (err: any) {
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
