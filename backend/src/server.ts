import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { z } from 'zod';
import db from './db';
import { whatsappService } from './whatsappService';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'x-list-id', 'x-user-role']
}));
app.use(express.json());

// 📸 Multer Setup for Photos
const uploadDir = process.env.NODE_ENV === 'production'
  ? '/app/data/uploads'
  : path.join(__dirname, '../uploads');
  
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});
const upload = multer({ storage });

app.use('/uploads', express.static(uploadDir));

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
  const baseUrl = process.env.APP_URL || `http://${req.get('host')}`;
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
  traffic_light: z.enum(['GREEN', 'YELLOW', 'RED']),
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
  // In a real app, this would come from a JWT or session
  // For now, we'll expect it in the headers or body, but ideally inferred from the authenticated user
  return parseInt(req.headers['x-list-id'] as string) || null;
};

const getRole = (req: express.Request) => {
  return req.headers['x-user-role'] as string || 'COORDINADOR';
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
  const user = db.prepare(`
    SELECT u.*, c.enabled_modules, l.campaign_id
    FROM users u
    LEFT JOIN lists l ON u.assigned_list_id = l.id
    LEFT JOIN campaigns c ON l.campaign_id = c.id
    WHERE u.username = ?
  `).get(username) as any;
  
  console.log(`[AUTH] Intento de login: ${username}. Encontrado: ${user ? 'SI' : 'NO'}`);
  if (user) console.log(`[AUTH] Rol: ${user.role}, Coincide clave: ${user.password === password}`);

  if (user && user.password === password) { 
    res.json({
      id: user.id,
      username: user.username,
      role: user.role,
      assigned_list_id: user.assigned_list_id,
      nombre: user.nombre,
      photo_url: user.photo_url,
      enabled_modules: user.enabled_modules ? user.enabled_modules.split(',') : ['COMMAND_CENTER', 'REGISTRY']
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
  
  const elector = db.prepare(`
    SELECT e.*, c.traffic_light, c.is_disputed, c.coordinator_id as captured_by
    FROM electors e
    LEFT JOIN elector_captures c ON e.ci = c.elector_ci AND (c.list_id = ? OR ? IS NULL)
    WHERE e.ci = ?
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

app.get('/api/captures', (req, res) => {
  const list_id = getListId(req);
  const role = getRole(req);
  const isSuper = role === 'SUPERUSUARIO';

  try {
    const query = `
      SELECT ec.*, e.nombre, e.apellido, l.list_number, c.name as campaign_name, u.nombre as coordinator_name
      FROM elector_captures ec
      JOIN electors e ON ec.elector_ci = e.ci
      JOIN lists l ON ec.list_id = l.id
      JOIN campaigns c ON l.campaign_id = c.id
      JOIN users u ON ec.coordinator_id = u.id
      ${isSuper || !list_id ? '' : `WHERE ec.list_id = ${list_id}`}
    `;
    const captures = db.prepare(query).all();
    res.json(captures);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

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
  const campaigns = db.prepare('SELECT * FROM campaigns').all();
  res.json(campaigns);
});

app.post('/api/campaigns', (req, res) => {
  const { name, enabled_modules } = req.body;
  try {
    const modulesStr = Array.isArray(enabled_modules) ? enabled_modules.join(',') : 'COMMAND_CENTER,REGISTRY';
    const result = db.prepare('INSERT INTO campaigns (name, enabled_modules) VALUES (?, ?)').run(name, modulesStr);
    res.json({ id: Number(result.lastInsertRowid), name });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/campaigns/:id', (req, res) => {
  const { id } = req.params;
  const { name, status, enabled_modules } = req.body;
  try {
    if (enabled_modules !== undefined) {
      const modulesStr = Array.isArray(enabled_modules) ? enabled_modules.join(',') : enabled_modules;
      db.prepare('UPDATE campaigns SET name = ?, status = ?, enabled_modules = ? WHERE id = ?')
        .run(name, status || 'ACTIVE', modulesStr, id);
    } else {
      db.prepare('UPDATE campaigns SET name = ?, status = ? WHERE id = ?')
        .run(name, status || 'ACTIVE', id);
    }
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
    res.json({ success: true });
  } catch (err: any) {
    console.error("Error deleting campaign:", err);
    res.status(500).json({ error: "No se pudo borrar la campaña: " + err.message });
  }
});

// Lists Management
app.post('/api/lists', (req, res) => {
  const { campaign_id, type, list_number, option_number, candidate_ci, photo_url, goal, candidate_nombre, candidate_alias } = req.body;
  
  if (!campaign_id || !type || !list_number || !candidate_ci) {
    return res.status(400).json({ error: 'Faltan campos obligatorios para registrar la lista.' });
  }

  try {
    db.transaction(() => {
      const result = db.prepare(`
        INSERT INTO lists (campaign_id, type, list_number, option_number, candidate_ci, photo_url, goal, candidate_nombre, candidate_alias)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(campaign_id, type, list_number, option_number, candidate_ci, photo_url, goal || 1000, candidate_nombre, candidate_alias);

      if (photo_url) {
        db.prepare('UPDATE electors SET photo_url = ? WHERE ci = ?').run(photo_url, candidate_ci);
      }
      
      logAction(1, 'CREATE', 'LIST', list_number, `Created list ${list_number} for campaign ${campaign_id}`);
    })();
    res.json({ success: true });
  } catch (err: any) {
    console.error("Error creating list:", err);
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/lists/:id', (req, res) => {
  const { id } = req.params;
  const { goal, photo_url, type, list_number, option_number, campaign_id, candidate_alias, candidate_nombre } = req.body;
  try {
    db.prepare(`
      UPDATE lists 
      SET goal = ?, photo_url = ?, type = ?, list_number = ?, option_number = ?, campaign_id = ?, candidate_alias = ?, candidate_nombre = ?
      WHERE id = ?
    `).run(goal || 1000, photo_url, type, list_number, option_number, campaign_id, candidate_alias, candidate_nombre, id);
    
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

app.get('/api/captures', (req, res) => {
  try {
    const captures = db.prepare(`
      SELECT ec.*, e.nombre, e.apellido, e.local_votacion, u.username as coordinator_name
      FROM elector_captures ec
      JOIN electors e ON ec.elector_ci = e.ci
      JOIN users u ON ec.coordinator_id = u.id
      ORDER BY ec.timestamp DESC
    `).all();
    res.json(captures);
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
  const { username, password, role, assigned_list_id, nombre, photo_url } = req.body;
  try {
    const result = db.prepare(`
      INSERT INTO users (username, password, role, assigned_list_id, nombre, photo_url)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(username, password, role, assigned_list_id, nombre, photo_url);
    
    logAction(1, 'CREATE', 'USER', Number(result.lastInsertRowid), `Created user ${username} with role ${role}`);
    res.json({ id: Number(result.lastInsertRowid) });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/users', (req, res) => {
  try {
    const users = db.prepare(`
      SELECT u.*, l.list_number, l.type as list_type
      FROM users u
      LEFT JOIN lists l ON u.assigned_list_id = l.id
    `).all();
    res.json(users);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/users/:id', (req, res) => {
  try {
    db.prepare('DELETE FROM users WHERE id = ?').run(req.params.id);
    logAction(1, 'DELETE', 'USER', req.params.id, `Deleted user with ID ${req.params.id}`);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/users/:id', (req, res) => {
  const { role, assigned_list_id, nombre, photo_url } = req.body;
  try {
    db.prepare(`
      UPDATE users 
      SET role = ?, assigned_list_id = ?, nombre = ?, photo_url = ?
      WHERE id = ?
    `).run(role, assigned_list_id, nombre, photo_url, req.params.id);
    logAction(1, 'UPDATE', 'USER', req.params.id, `Updated user ${nombre} (${role})`);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/lists', (req, res) => {
  try {
    const lists = db.prepare(`
      SELECT l.*, c.name as campaign_name, e.nombre as candidate_nombre, e.apellido as candidate_apellido,
      (SELECT COUNT(*) FROM elector_captures ec JOIN electors e2 ON ec.elector_ci = e2.ci WHERE e2.coordinador_asignado IN (SELECT username FROM users WHERE assigned_list_id = l.id)) as captures
      FROM lists l
      JOIN campaigns c ON l.campaign_id = c.id
      LEFT JOIN electors e ON l.candidate_ci = e.ci
    `).all();
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

// System Maintenance
app.post('/api/admin/system/wipe-captures', (req, res) => {
  const { key } = req.body;
  try {
    const storedKey = db.prepare("SELECT value FROM settings WHERE key = 'master_key'").get() as any;
    
    if (!storedKey || key !== storedKey.value) {
      return res.status(403).json({ error: 'Llave Maestra inválida. Acción denegada.' });
    }

    db.transaction(() => {
      db.prepare('DELETE FROM elector_captures').run();
      db.prepare('DELETE FROM logistics').run();
      db.prepare('DELETE FROM elector_locations').run();
      db.prepare("UPDATE electors SET status = 'Pendiente', coordinador_asignado = NULL, is_priority = 0").run();
      logAction(1, 'SYSTEM_WIPE', 'GLOBAL', null, 'Performed a master wipe of all capture data');
    })();
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

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
  try {
    const conflicts = db.prepare(`
      SELECT 
        cc.id as conflict_id,
        cc.status as conflict_status,
        e.ci as elector_ci,
        e.nombre as elector_nombre,
        e.apellido as elector_apellido,
        ec.id as capture_id,
        ec.traffic_light,
        ec.timestamp as capture_time,
        u.nombre as coordinator_name,
        u.id as coordinator_id
      FROM capture_conflicts cc
      JOIN elector_captures ec ON cc.capture_id = ec.id
      JOIN electors e ON cc.elector_ci = e.ci
      JOIN users u ON ec.coordinator_id = u.id
      WHERE cc.status = 'PENDING'
    `).all();
    res.json(conflicts);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/admin/conflicts/resolve', (req, res) => {
  const { conflict_id, winner_capture_id } = req.body;
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
        SET status = 'RESOLVED', resolved_by_jefe_id = 1, resolved_coordinator_id = (SELECT coordinator_id FROM elector_captures WHERE id = ?)
        WHERE elector_ci = ?
      `).run(winner_capture_id, conflict.elector_ci, conflict.elector_ci);

      logAction(1, 'RESOLVE_CONFLICT', 'ELECTOR', conflict.elector_ci, `Resolved conflict for ${conflict.elector_ci} in favor of capture ${winner_capture_id}`);
    })();
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/admin/electors/search', (req, res) => {
  const { q } = req.query;
  try {
    const electors = db.prepare(`
      SELECT e.*, ec.traffic_light, u.nombre as coordinator_name
      FROM electors e
      LEFT JOIN elector_captures ec ON e.ci = ec.elector_ci AND ec.is_disputed = 0
      LEFT JOIN users u ON ec.coordinator_id = u.id
      WHERE e.ci LIKE ? OR e.nombre LIKE ? OR e.apellido LIKE ?
      LIMIT 50
    `).all(`%${q}%`, `%${q}%`, `%${q}%`);
    res.json(electors);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/stats/command', (req, res) => {
  const list_id = getListId(req);
  const role = getRole(req);
  const isSuper = role === 'SUPERUSUARIO';

  try {
    const statsQuery = isSuper || !list_id
      ? `SELECT traffic_light, COUNT(*) as count FROM elector_captures WHERE is_disputed = 0 GROUP BY traffic_light`
      : `SELECT traffic_light, COUNT(*) as count FROM elector_captures WHERE is_disputed = 0 AND list_id = ${list_id} GROUP BY traffic_light`;
    
    const stats = db.prepare(statsQuery).all() as any[];

    const totalCapturesQuery = isSuper || !list_id
      ? `SELECT COUNT(*) as count FROM elector_captures WHERE is_disputed = 0`
      : `SELECT COUNT(*) as count FROM elector_captures WHERE is_disputed = 0 AND list_id = ${list_id}`;
    
    const totalCaptures = db.prepare(totalCapturesQuery).get() as any;
    const totalElectors = db.prepare('SELECT COUNT(*) as count FROM electors').get() as any;

    const locationStatsQuery = `
      SELECT 
        l.cod_local,
        l.nombre,
        COUNT(e.ci) as total_electors,
        SUM(CASE WHEN ec.id IS NOT NULL AND ec.is_disputed = 0 THEN 1 ELSE 0 END) as total_captures,
        SUM(CASE WHEN ec.traffic_light = 'GREEN' AND ec.is_disputed = 0 THEN 1 ELSE 0 END) as green_captures
      FROM voting_locations l
      LEFT JOIN electors e ON l.cod_local = e.cod_local OR l.nombre = e.local_votacion
      LEFT JOIN elector_captures ec ON e.ci = ec.elector_ci ${isSuper || !list_id ? '' : `AND ec.list_id = ${list_id}`}
      GROUP BY l.cod_local, l.nombre
    `;
    
    const locationStats = db.prepare(locationStatsQuery).all() as any[];

    const topCoordinatorsQuery = `
      SELECT u.id, u.nombre, COUNT(c.id) as capture_count
      FROM users u
      JOIN captures c ON u.id = c.coordinator_id
      ${isSuper || !list_id ? '' : `WHERE u.assigned_list_id = ${list_id}`}
      GROUP BY u.id
      ORDER BY capture_count DESC
      LIMIT 5
    `;
    
    const topCoordinators = db.prepare(topCoordinatorsQuery).all();

    res.json({
      green: stats.find(s => s.traffic_light === 'GREEN')?.count || 0,
      yellow: stats.find(s => s.traffic_light === 'YELLOW')?.count || 0,
      red: stats.find(s => s.traffic_light === 'RED')?.count || 0,
      total_captures: totalCaptures.count,
      total_electors: totalElectors.count,
      percentage: ((totalCaptures.count / totalElectors.count) * 100).toFixed(1),
      locations: locationStats.map(loc => ({
        ...loc,
        percentage: loc.total_electors > 0 ? ((loc.total_captures / loc.total_electors) * 100).toFixed(1) : 0
      })),
      top_coordinators: topCoordinators
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/admin/requests', (req, res) => {
  const list_id = getListId(req);
  const role = getRole(req);
  const isSuper = role === 'SUPERUSUARIO';

  try {
    const query = `
      SELECT r.*, u.nombre as coordinator_name, u.username as coordinator_username
      FROM field_requests r
      JOIN users u ON r.coordinator_id = u.id
      ${isSuper || !list_id ? '' : `WHERE r.list_id = ${list_id}`}
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

app.post('/api/coordinator/request', (req, res) => {
  const { coordinator_id, type, description, priority } = req.body;
  try {
    const result = db.prepare(`
      INSERT INTO field_requests (coordinator_id, type, description, priority)
      VALUES (?, ?, ?, ?)
    `).run(coordinator_id, type, description, priority || 'NORMAL');
    
    logAction(coordinator_id, 'CREATE_REQUEST', 'FIELD_REQUEST', Number(result.lastInsertRowid), `New ${type} request from field`);
    res.json({ success: true, id: Number(result.lastInsertRowid) });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/admin/activity', (req, res) => {
  const list_id = getListId(req);
  const role = getRole(req);
  const isSuper = role === 'SUPERUSUARIO';

  try {
    const query = `
      SELECT 'CAPTURE' as type, ec.timestamp, u.nombre as user_name, e.nombre || ' ' || e.apellido as entity_name, ec.traffic_light as detail
      FROM elector_captures ec
      JOIN users u ON ec.coordinator_id = u.id
      JOIN electors e ON ec.elector_ci = e.ci
      ${isSuper || !list_id ? '' : `WHERE ec.list_id = ${list_id}`}
      
      UNION ALL
      
      SELECT 'REQUEST' as type, r.timestamp, u.nombre as user_name, r.type as entity_name, r.description as detail
      FROM field_requests r
      JOIN users u ON r.coordinator_id = u.id
      ${isSuper || !list_id ? '' : `WHERE r.list_id = ${list_id}`}
      
      UNION ALL
      
      SELECT 'CONFLICT' as type, cc.timestamp, 'Sistema' as user_name, e.nombre || ' ' || e.apellido as entity_name, 'Doble Captura' as detail
      FROM capture_conflicts cc
      JOIN electors e ON cc.elector_ci = e.ci
      ${isSuper || !list_id ? '' : `WHERE cc.list_id = ${list_id}`}
      
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
app.get('/api/whatsapp/status', (req, res) => {
  res.json(whatsappService.getStatus());
});

app.post('/api/whatsapp/connect', (req, res) => {
  whatsappService.connect();
  res.json({ success: true });
});

app.post('/api/whatsapp/disconnect', (req, res) => {
  whatsappService.disconnect();
  res.json({ success: true });
});

app.post('/api/whatsapp/broadcast', async (req, res) => {
  const { template_id, target_list_id, custom_message } = req.body;
  const role = getRole(req);
  if (role !== 'SUPERUSUARIO' && role !== 'JEFE_CAMPANA') return res.status(403).json({ error: 'Prohibido' });

  try {
    // Logic for mass sending with delays
    res.json({ success: true, queued: 1240 });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
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

app.listen(Number(PORT), '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
});
