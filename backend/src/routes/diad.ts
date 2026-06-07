import { Router } from 'express';
import multer from 'multer';
import db from '../db';
import { dbQueryAsync, dbGetAsync } from '../db-async';
import { getCachedUserInfo, getRole, getListId, getDistrict } from './helpers';
import { diadCoverageCache } from '../server';
import { getParaguayTimestamp } from '../utils/timezone';

export default function diadRoutes(upload: multer.Multer) {
  const router = Router();

  router.get('/coverage', async (req, res) => {
    const list_id = getListId(req);
    const role = getRole(req);
    const user_id = req.headers['x-user-id'];
    const districtFilter = getDistrict(req);

    const cacheKey = `${user_id || 'global'}_${list_id || ''}_${districtFilter || 'ALL'}`;
    const cached = await diadCoverageCache.get(cacheKey);
    if (cached) return res.json(cached);

    let districtName = '';
    let distritoClause = '';
    let distritoParams: any[] = [];
    let vlClause = '';
    let vlParams: any[] = [];
    let listClause = '';
    let listParams: any[] = [];

    if (list_id && !isNaN(list_id)) {
      listClause = `AND u.assigned_list_id = ?`;
      listParams = [list_id];
    }

    if (districtFilter) {
      districtName = districtFilter;
    } else if (role !== 'SUPERUSUARIO' && user_id) {
      const user = getCachedUserInfo(user_id as string);
      if (user?.distrito) {
        districtName = user.distrito;
      }
    }

    if (districtName) {
      distritoClause = `WHERE (UPPER(distrito) = UPPER(?) OR UPPER(ciudad) = UPPER(?))`;
      distritoParams = [districtName, districtName];
      vlClause = `AND (UPPER(vl.distrito) = UPPER(?) OR UPPER(vl.ciudad) = UPPER(?))`;
      vlParams = [districtName, districtName];
    }

    try {
      const mesasTotal = await dbGetAsync<any>(`SELECT COUNT(DISTINCT local_votacion || '-' || mesa) as total_mesas FROM electors ${distritoClause}`, distritoParams);
      const total_mesas = mesasTotal?.total_mesas || 0;

      const assignedRow = await dbGetAsync<any>(`
        SELECT COUNT(DISTINCT u.assigned_local || '-' || u.assigned_mesa) as assigned_mesas
        FROM users u
        JOIN voting_locations vl ON u.assigned_local = vl.nombre
        WHERE (u.role = 'VEEDOR' OR u.role = 'MIEMBRO_MESA')
        AND u.assigned_local IS NOT NULL AND u.assigned_mesa IS NOT NULL
        ${vlClause}
        ${listClause ? `AND u.assigned_list_id = ?` : ''}
      `, [...vlParams, ...(listClause ? [list_id] : [])]);
      const assigned_mesas = assignedRow?.assigned_mesas || 0;

      const reportedRow = await dbGetAsync<any>(`
        SELECT COUNT(DISTINCT r.local_votacion || '-' || r.mesa) as reported_mesas
        FROM results r
        JOIN voting_locations vl ON r.local_votacion = vl.nombre
        WHERE 1=1 ${vlClause}
        ${listClause ? `AND r.tenant_id = ?` : ''}
      `, [...vlParams, ...(listClause ? [list_id] : [])]);
      const reported_mesas = reportedRow?.reported_mesas || 0;

      const votos = await dbGetAsync<any>(`
        SELECT
          (SELECT COALESCE(SUM(ar.votos), 0) FROM acta_results ar JOIN results r2 ON ar.acta_id = r2.id JOIN voting_locations vl ON r2.local_votacion = vl.nombre WHERE 1=1 ${vlClause} ${listClause ? `AND r2.tenant_id = ?` : ''}) +
          (SELECT COALESCE(SUM(r3.votos_blancos + r3.votos_nulos), 0) FROM results r3 JOIN voting_locations vl ON r3.local_votacion = vl.nombre WHERE 1=1 ${vlClause} ${listClause ? `AND r3.tenant_id = ?` : ''}) as total
      `, listClause ? [...vlParams, list_id, ...vlParams, list_id] : [...vlParams, ...vlParams]);

      const mesas = await dbQueryAsync<any>(`
        SELECT
          e.local_votacion as local, e.mesa as numero, vl.lat, vl.lng,
          (CASE WHEN r.id IS NOT NULL THEN 1 ELSE 0 END) as reportada,
          (CASE WHEN u.id IS NOT NULL THEN 1 ELSE 0 END) as operativa,
          (CASE WHEN mc.is_confirmed = 1 THEN 1 ELSE 0 END) as confirmada
        FROM (SELECT local_votacion, mesa FROM electors ${distritoClause} GROUP BY local_votacion, mesa) e
        JOIN voting_locations vl ON e.local_votacion = vl.nombre
        LEFT JOIN (SELECT id, local_votacion, mesa FROM results GROUP BY local_votacion, mesa) r ON r.local_votacion = e.local_votacion AND r.mesa = e.mesa
        LEFT JOIN (SELECT id, assigned_local, assigned_mesa FROM users WHERE (role = 'VEEDOR' OR role = 'MIEMBRO_MESA') GROUP BY assigned_local, assigned_mesa) u ON u.assigned_local = e.local_votacion AND u.assigned_mesa = e.mesa
        LEFT JOIN mesa_constitutions mc ON mc.local_votacion = e.local_votacion AND mc.mesa = e.mesa
        WHERE 1=1 ${vlClause}
      `, [...distritoParams, ...vlParams]);

      const coordRow = await dbGetAsync<any>(`
        SELECT COUNT(*) as total_coordinadores FROM users u
        WHERE role = 'COORDINADOR'
        ${districtName ? `AND (UPPER(u.distrito) = UPPER(?))` : ''}
        ${listClause ? `AND u.assigned_list_id = ?` : ''}
      `, [...(districtName ? [districtName] : []), ...(listClause ? [list_id] : [])]);

      const vehicRow = await dbGetAsync<any>(`
        SELECT COUNT(*) as total_vehiculos FROM vehicles v
        WHERE 1=1
        ${listClause ? `AND (v.assigned_list_id = ?)` : ''}
      `, [...(listClause ? [list_id] : [])]);

      const responseData = {
        total_mesas,
        mesas_operativas: assigned_mesas,
        op_porcentaje: total_mesas > 0 ? (assigned_mesas / total_mesas) * 100 : 0,
        mesas_reportadas: reported_mesas,
        mesas_pendientes: total_mesas - reported_mesas,
        porcentaje: total_mesas > 0 ? (reported_mesas / total_mesas) * 100 : 0,
        votos_procesados: votos?.total || 0,
        total_coordinadores: coordRow?.total_coordinadores || 0,
        total_vehiculos: vehicRow?.total_vehiculos || 0,
        mesas
      };

      await diadCoverageCache.set(cacheKey, responseData);
      res.json(responseData);
    } catch (err: any) {
      console.error('[DIAD COVERAGE ERROR]', err);
      res.status(500).json({ error: err.message });
    }
  });

  router.get('/debug_db', (req, res) => {
    try {
      const counts = db.prepare("SELECT role, assigned_local, assigned_mesa, COUNT(*) as count FROM users GROUP BY role, assigned_local, assigned_mesa").all();

      // Check for assigned_local values that don't match voting_locations
      const mismatches = db.prepare(`
        SELECT u.id, u.nombre, u.ci, u.assigned_local, u.assigned_mesa, u.role, u.distrito
        FROM users u
        WHERE u.assigned_local IS NOT NULL
          AND u.assigned_local != ''
          AND u.assigned_mesa IS NOT NULL
          AND u.role IN ('MIEMBRO_MESA', 'MIEMBRO_DE_MESA', 'VEEDOR', 'APODERADO', 'PRESIDENTE', 'VOCAL')
          AND u.assigned_local NOT IN (SELECT nombre FROM voting_locations)
        LIMIT 20
      `).all();

      // Get a sample of voting_locations names
      const votingLocNames = db.prepare('SELECT DISTINCT nombre FROM voting_locations LIMIT 10').all();

      res.json({
        counts,
        mismatches,
        votingLocSample: votingLocNames,
        mismatchCount: (db.prepare("SELECT COUNT(*) as cnt FROM users u WHERE u.assigned_local IS NOT NULL AND u.assigned_local != '' AND u.assigned_local NOT IN (SELECT nombre FROM voting_locations)").get() as any).cnt
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  router.get('/results', async (req, res) => {
    const list_id = getListId(req);
    const districtFilter = getDistrict(req);
    const role = getRole(req);
    const user_id = req.headers['x-user-id'];

    let districtName = districtFilter || '';
    if (!districtName && role !== 'SUPERUSUARIO' && user_id) {
      const user = getCachedUserInfo(user_id as string);
      if (user?.distrito) districtName = user.distrito;
    }

    try {
      let sql = `
        SELECT l.id, l.list_number, l.candidate_alias, l.type, l.candidate_nombre, l.option_number,
          COALESCE(SUM(ar.votos), 0) as votos
        FROM lists l
        LEFT JOIN acta_results ar ON l.id = ar.lista_id
        LEFT JOIN results r ON ar.acta_id = r.id
        LEFT JOIN voting_locations vl ON r.local_votacion = vl.nombre
        WHERE 1=1
      `;
      const params: any[] = [];
      if (list_id && !isNaN(list_id)) {
        sql += ` AND l.campaign_id = (SELECT campaign_id FROM lists WHERE id = ?)`;
        params.push(list_id);
      }
      if (districtName) {
        sql += ` AND (UPPER(vl.distrito) = UPPER(?) OR UPPER(vl.ciudad) = UPPER(?))`;
        params.push(districtName, districtName);
      }
      sql += ` GROUP BY l.id ORDER BY votos DESC`;
      const formatted = await dbQueryAsync<any>(sql, params);
      const totalVotos = formatted.reduce((acc, curr) => acc + curr.votos, 0);
      formatted.forEach(f => f.porcentaje = totalVotos > 0 ? (f.votos / totalVotos) * 100 : 0);
      res.json(formatted);
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  router.get('/listas', (req, res) => {
    try {
      const lists = db.prepare(`
        SELECT id, candidate_alias as nombre, list_number, type, is_adversary
        FROM lists ORDER BY is_adversary ASC, list_number ASC
      `).all();
      res.json(lists);
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  router.post('/listas', (req, res) => {
    const { list_number, candidate_alias, type, is_adversary } = req.body;
    if (list_number === undefined || isNaN(Number(list_number))) return res.status(400).json({ error: 'list_number debe ser un número' });
    if (candidate_alias && typeof candidate_alias !== 'string') return res.status(400).json({ error: 'candidate_alias debe ser un texto' });
    const allowedTypes = ['INTENDENTE', 'CONCEJAL', 'DIPUTADO', 'SENADOR', 'LISTA_COMPLETA'];
    if (!type || !allowedTypes.includes(type)) return res.status(400).json({ error: 'type debe ser uno de: ' + allowedTypes.join(', ') });
    try {
      const result = db.prepare(`
        INSERT INTO lists (list_number, candidate_alias, type, is_adversary, campaign_id) VALUES (?, ?, ?, ?, 1)
      `).run(list_number, candidate_alias, type, is_adversary ? 1 : 0);
      res.json({ success: true, id: result.lastInsertRowid });
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  router.post('/acta', upload.single('foto_acta'), (req, res) => {
    const { mesa_id, votos_blanco, votos_nulos, listas, foto_acta_base64 } = req.body;
    const userId = req.headers['x-user-id'];
    if (!mesa_id) return res.status(400).json({ error: 'mesa_id es requerido' });
    if (votos_blanco === undefined || votos_blanco === null) return res.status(400).json({ error: 'votos_blanco es requerido' });
    if (votos_nulos === undefined || votos_nulos === null) return res.status(400).json({ error: 'votos_nulos es requerido' });
    let parsedListas;
    try {
      parsedListas = typeof listas === 'string' ? JSON.parse(listas) : listas;
    } catch {
      return res.status(400).json({ error: 'Formato inválido de listas' });
    }
    try {
      let photoUrl = req.file ? `/uploads/${req.file.filename}` : null;

      // Handle offline base64 image sync
      if (!photoUrl && foto_acta_base64 && typeof foto_acta_base64 === 'string') {
        try {
          const fs = require('fs');
          const path = require('path');
          const matches = foto_acta_base64.match(/^data:image\/([a-zA-Z+]+);base64,(.+)$/);
          if (matches && matches.length === 3) {
            const ext = matches[1];
            const dataBuffer = Buffer.from(matches[2], 'base64');
            const filename = `offline-acta-${Date.now()}-${Math.round(Math.random() * 1e9)}.${ext}`;
            const uploadDir = process.env.NODE_ENV === 'production' ? '/app/data/uploads' : path.join(__dirname, '../../uploads');
            if (!fs.existsSync(uploadDir)) {
              fs.mkdirSync(uploadDir, { recursive: true });
            }
            fs.writeFileSync(path.join(uploadDir, filename), dataBuffer);
            photoUrl = `/uploads/${filename}`;
          }
        } catch (fileErr) {
          console.error('[OFFLINE_ACTA] Error saving base64 image:', fileErr);
        }
      }

      db.transaction(() => {
        const user = db.prepare('SELECT assigned_local, assigned_mesa FROM users WHERE id = ?').get(userId) as any;
        const local = user?.assigned_local || 'PENDIENTE';
        const mesa = user?.assigned_mesa || 0;

        const result = db.prepare(`
          INSERT INTO results (tenant_id, mesa, local_votacion, votos_blancos, votos_nulos, foto_acta_url, veedor_id)
          VALUES (1, ?, ?, ?, ?, ?, ?)
        `).run(mesa, local, votos_blanco || 0, votos_nulos || 0, photoUrl, userId);

        const actaId = result.lastInsertRowid;
        const insertResult = db.prepare(`INSERT INTO acta_results (acta_id, lista_id, votos) VALUES (?, ?, ?)`);
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

  router.get('/actas', (req, res) => {
    const list_id = getListId(req);
    const districtFilter = getDistrict(req);
    const role = getRole(req);
    const user_id = req.headers['x-user-id'];

    let districtName = districtFilter || '';
    if (!districtName && role !== 'SUPERUSUARIO' && user_id) {
      const user = getCachedUserInfo(user_id as string);
      if (user?.distrito) districtName = user.distrito;
    }

    try {
      let sql = `
        SELECT r.id, r.mesa as mesa_numero, r.local_votacion as local,
          u.nombre as submitted_by,
          ((SELECT COALESCE(SUM(votos), 0) FROM acta_results ar WHERE ar.acta_id = r.id) + r.votos_blancos + r.votos_nulos) as votos_total,
          r.foto_acta_url as foto_url, r.timestamp as submitted_at
        FROM results r
        LEFT JOIN users u ON r.veedor_id = u.id
        LEFT JOIN voting_locations vl ON r.local_votacion = vl.nombre
        WHERE 1=1
      `;
      const params: any[] = [];
      if (list_id && !isNaN(list_id)) {
        sql += ` AND r.tenant_id = ?`;
        params.push(list_id);
      }
      if (districtName) {
        sql += ` AND (UPPER(vl.distrito) = UPPER(?) OR UPPER(vl.ciudad) = UPPER(?))`;
        params.push(districtName, districtName);
      }
      sql += ` ORDER BY r.timestamp DESC`;
      const actas = db.prepare(sql).all(...params);
      res.json(actas);
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  router.get('/members', (req, res) => {
    const districtFilter = getDistrict(req);
    const role = getRole(req);
    const user_id = req.headers['x-user-id'];

    let districtName = districtFilter || '';
    if (!districtName && role !== 'SUPERUSUARIO' && user_id) {
      const user = getCachedUserInfo(user_id as string);
      if (user?.distrito) districtName = user.distrito;
    }

    try {
      let sql = `
        SELECT u.id, u.nombre, u.assigned_local, u.assigned_mesa, u.role, u.ci, u.telefono, u.assigned_table_role
        FROM users u
        LEFT JOIN voting_locations vl ON u.assigned_local = vl.nombre
        WHERE u.role IN ('VEEDOR', 'MIEMBRO_MESA', 'MIEMBRO_DE_MESA', 'APODERADO', 'PRESIDENTE', 'VOCAL')
      `;
      const params: any[] = [];
      if (districtName) {
        let baseDistrict = districtName.replace('Ó', 'O').replace('ó', 'o').replace('ô', 'o').replace('á', 'a').replace('é', 'e').replace('í', 'i');
        // Include users that:
        // 1) Their user.distrito matches this district (primary - most reliable)
        // 2) Their assigned_local's district matches this district (via subquery lookup)
        // 3) Their assigned_local name contains the district (fallback for typos/variations)
        sql += ` AND (
          UPPER(u.distrito) LIKE UPPER(?)
          OR u.assigned_local IN (
            SELECT nombre FROM voting_locations
            WHERE UPPER(distrito) LIKE UPPER(?) OR UPPER(ciudad) LIKE UPPER(?)
          )
          OR UPPER(u.assigned_local) LIKE UPPER(?)
        )`;
        params.push(`%${baseDistrict}%`, `%${baseDistrict}%`, `%${baseDistrict}%`, `%${baseDistrict}%`);
      }
      const members = db.prepare(sql).all(...params);
      res.json(members);
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  router.post('/members/assign', async (req, res) => {
    const { ci, local, mesa, user_id, role, table_role, telefono } = req.body;
    if (!ci && !user_id) return res.status(400).json({ error: 'ci o user_id es requerido' });
    // local and mesa can be null/undefined when LIBERATING a member
    const VALID_ROLES = ['MIEMBRO_MESA', 'MIEMBRO_DE_MESA', 'VEEDOR', 'APODERADO', 'PRESIDENTE', 'VOCAL'];
    if (role && !VALID_ROLES.includes(role)) return res.status(400).json({ error: 'role inválido' });
    const targetRole = role || 'MIEMBRO_MESA';
    // Require mesa to be a valid number (>= 1) when assigning (not liberating)
    if (local !== null && local !== undefined && local !== '') {
      const mesaNum = parseInt(mesa);
      if (isNaN(mesaNum) || mesaNum < 1) {
        return res.status(400).json({ error: 'El número de mesa debe ser un número válido >= 1' });
      }
    }
    try {
      let targetId = user_id;
      if (ci && !targetId) {
        const existingUser = db.prepare('SELECT id FROM users WHERE ci = ?').get(ci) as any;
        if (existingUser) {
          targetId = existingUser.id;
        } else {
          const elector = db.prepare('SELECT nombre, apellido FROM electors WHERE ci = ?').get(ci) as any;
          if (!elector) return res.status(404).json({ error: 'Ciudadano no encontrado en el padrón' });
          const username = `member_${ci}`;
          const password = `pass_${ci}`;
          const fullName = `${elector.nombre} ${elector.apellido}`;
          // Get district from the voting location if local is provided
          let userDistrict = null;
          if (local) {
            const votingLoc = db.prepare('SELECT distrito, ciudad FROM voting_locations WHERE nombre = ?').get(local) as any;
            userDistrict = votingLoc?.distrito || votingLoc?.ciudad || null;
          }
          const result = db.prepare(`INSERT INTO users (username, password, role, nombre, ci, telefono, distrito) VALUES (?, ?, ?, ?, ?, ?, ?)`).run(username, password, targetRole, fullName, ci, telefono || null, userDistrict);
          targetId = result.lastInsertRowid;
        }
      }
      if (!targetId) return res.status(400).json({ error: 'No se pudo identificar al usuario' });

      // If liberating (local is null/empty), clear assignment
      const isLiberating = local === null || local === undefined || local === '';
      if (isLiberating) {
        db.prepare(`UPDATE users SET assigned_local = NULL, assigned_mesa = NULL WHERE id = ?`).run(targetId);
      } else {
        // Also update distrito if not already set (in case of existing user)
        const user = db.prepare('SELECT distrito FROM users WHERE id = ?').get(targetId) as any;
        if (!user?.distrito) {
          const votingLoc = db.prepare('SELECT distrito, ciudad FROM voting_locations WHERE nombre = ?').get(local) as any;
          const userDistrict = votingLoc?.distrito || votingLoc?.ciudad || null;
          if (telefono) {
            db.prepare(`UPDATE users SET assigned_local = ?, assigned_mesa = ?, role = ?, assigned_table_role = ?, telefono = ?, distrito = ? WHERE id = ?`).run(local, mesa, targetRole, table_role || null, telefono, userDistrict, targetId);
          } else {
            db.prepare(`UPDATE users SET assigned_local = ?, assigned_mesa = ?, role = ?, assigned_table_role = ?, distrito = ? WHERE id = ?`).run(local, mesa, targetRole, table_role || null, userDistrict, targetId);
          }
        } else {
          // User already has a distrito, just update assignment
          if (telefono) {
            db.prepare(`UPDATE users SET assigned_local = ?, assigned_mesa = ?, role = ?, assigned_table_role = ?, telefono = ? WHERE id = ?`).run(local, mesa, targetRole, table_role || null, telefono, targetId);
          } else {
            db.prepare(`UPDATE users SET assigned_local = ?, assigned_mesa = ?, role = ?, assigned_table_role = ? WHERE id = ?`).run(local, mesa, targetRole, table_role || null, targetId);
          }
        }
      }

      // Clear cache explicitly after modification
      await diadCoverageCache.invalidate();

      res.json({ success: true });
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  // 🚨 POST /api/diad/sos - Emit SOS alerts in real-time to active SSE clients
  router.post('/sos', (req, res) => {
    const { message, latitude, longitude, veedor_id, type } = req.body;
    try {
      const { sseClients } = require('../server');
      const payload = {
        type: 'SOS_ALERT',
        data: {
          id: Date.now(),
          title: '¡ALERTA SOS!',
          body: message || 'Se ha reportado una alerta SOS desde un local electoral.',
          type: type || 'error',
          latitude: latitude || null,
          longitude: longitude || null,
          veedor_id: veedor_id || null,
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }
      };

      // Broadcast to all active clients
      sseClients.forEach((client: any) => {
        try {
          client.write(`data: ${JSON.stringify(payload)}\n\n`);
        } catch (e) {
          // Client might be closed
        }
      });

      res.json({ success: true, message: 'Alerta SOS transmitida.' });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // 🚌 POST /api/diad/electors/:id/transport - Update elector transport status
  router.post('/electors/:id/transport', (req, res) => {
    const { status } = req.body;
    const electorId = req.params.id;
    try {
      db.prepare("UPDATE elector_captures SET transport_status = ? WHERE id = ?").run(status, electorId);
      
      // SSE Broadcast vehicle/passenger status change
      const { sseClients } = require('../server');
      const payload = {
        type: 'VEHICLE_UPDATE',
        data: { id: electorId, status }
      };
      sseClients.forEach((client: any) => {
        try { client.write(`data: ${JSON.stringify(payload)}\n\n`); } catch {}
      });

      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // 🍎 POST /api/diad/catering - Delivery checklists and signatures
  router.post('/catering', upload.single('photo'), (req, res) => {
    const { shift, received_by, list_id, local, signature } = req.body;
    try {
      const photoUrl = req.file ? `/uploads/${req.file.filename}` : null;
      
      // Save delivery audit or details
      db.prepare(`
        INSERT INTO audit_logs (user_id, action, entity, entity_id, details, list_id)
        VALUES (?, 'CATERING_DELIVERY', 'LOGISTICS', ?, ?, ?)
      `).run(
        req.headers['x-user-id'] ? Number(req.headers['x-user-id']) : null,
        shift || 'DESAYUNO',
        JSON.stringify({ received_by, local, photoUrl, signature }),
        list_id ? Number(list_id) : null
      );

      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // 🚨 POST /api/diad/incidents - Report substitutions/incidences with photos
  router.post('/incidents', upload.single('photo'), (req, res) => {
    const { mesa, type, description, local, foto_base64 } = req.body;
    const userId = req.headers['x-user-id'];
    try {
      let photoUrl = req.file ? `/uploads/${req.file.filename}` : null;
      if (!photoUrl && foto_base64 && typeof foto_base64 === 'string') {
        try {
          const fs = require('fs');
          const path = require('path');
          const matches = foto_base64.match(/^data:image\/([a-zA-Z+]+);base64,(.+)$/);
          if (matches && matches.length === 3) {
            const ext = matches[1];
            const dataBuffer = Buffer.from(matches[2], 'base64');
            const filename = `offline-incident-${Date.now()}.${ext}`;
            const uploadDir = process.env.NODE_ENV === 'production' ? '/app/data/uploads' : path.join(__dirname, '../../uploads');
            if (!fs.existsSync(uploadDir)) {
              fs.mkdirSync(uploadDir, { recursive: true });
            }
            fs.writeFileSync(path.join(uploadDir, filename), dataBuffer);
            photoUrl = `/uploads/${filename}`;
          }
        } catch (fileErr) {
          console.error('[OFFLINE_INCIDENT] Error saving base64 image:', fileErr);
        }
      }

      db.prepare(`
        INSERT INTO audit_logs (user_id, action, entity, entity_id, details)
        VALUES (?, 'INCIDENT_REPORT', 'LOCAL', ?, ?)
      `).run(
        userId ? Number(userId) : null,
        local || 'GENERAL',
        JSON.stringify({ mesa, type, description, photoUrl })
      );

      // SSE Broadcast incident to coordinators
      const { sseClients } = require('../server');
      const payload = {
        type: 'INCIDENT_ALERT',
        data: { local, mesa, type, description, photoUrl, time: new Date().toLocaleTimeString() }
      };
      sseClients.forEach((client: any) => {
        try { client.write(`data: ${JSON.stringify(payload)}\n\n`); } catch {}
      });

      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ── GET /api/diad/participation-summary ───────────────────────────────────
  router.get('/participation-summary', async (req, res) => {
    const role = getRole(req);
    const user_id = req.headers['x-user-id'];

    let distritoClause = '';
    let distritoParams: any[] = [];

    const districtFilter = getDistrict(req);

    let districtName = districtFilter || '';
    if (!districtName && role !== 'SUPERUSUARIO' && user_id) {
      const user = getCachedUserInfo(user_id as string);
      if (user?.distrito) {
        districtName = user.distrito;
      }
    }

    if (districtName) {
      distritoClause = `WHERE (UPPER(e.distrito) = UPPER(?) OR UPPER(e.ciudad) = UPPER(?))`;
      distritoParams = [districtName, districtName];
    }

    try {
      // 1. Get total electors by local and mesa
      const electorsGrouped = await dbQueryAsync<any>(`
        SELECT e.local_votacion, e.mesa, COUNT(*) as total_electors
        FROM electors e
        ${distritoClause}
        GROUP BY e.local_votacion, e.mesa
      `, distritoParams);

      // 2. Get voted electors and registered voted electors by local and mesa
      const participationGrouped = await dbQueryAsync<any>(`
        SELECT
          pl.local_votacion,
          pl.mesa,
          COUNT(*) as total_votos,
          SUM(CASE WHEN ec.id IS NOT NULL THEN 1 ELSE 0 END) as registered_votos
        FROM participation_logs pl
        JOIN electors e ON pl.local_votacion = e.local_votacion AND pl.mesa = e.mesa AND pl.orden = e.orden
        LEFT JOIN elector_captures ec ON e.ci = ec.elector_ci AND ec.is_disputed = 0
        ${distritoClause}
        GROUP BY pl.local_votacion, pl.mesa
      `, distritoParams);

      const localsMap = new Map<string, {
        local: string;
        total_electors: number;
        total_votos: number;
        registered_votos: number;
        mesas: Record<number, {
          mesa: number;
          total_electors: number;
          total_votos: number;
          registered_votos: number;
        }>
      }>();

      electorsGrouped.forEach((row: any) => {
        const localKey = row.local_votacion;
        if (!localsMap.has(localKey)) {
          localsMap.set(localKey, {
            local: localKey,
            total_electors: 0,
            total_votos: 0,
            registered_votos: 0,
            mesas: {}
          });
        }
        const localData = localsMap.get(localKey)!;
        localData.total_electors += row.total_electors;
        localData.mesas[row.mesa] = {
          mesa: row.mesa,
          total_electors: row.total_electors,
          total_votos: 0,
          registered_votos: 0
        };
      });

      participationGrouped.forEach((row: any) => {
        const localKey = row.local_votacion;
        const localData = localsMap.get(localKey);
        if (localData) {
          localData.total_votos += row.total_votos;
          localData.registered_votos += row.registered_votos || 0;
          if (localData.mesas[row.mesa]) {
            localData.mesas[row.mesa].total_votos = row.total_votos;
            localData.mesas[row.mesa].registered_votos = row.registered_votos || 0;
          }
        }
      });

      const response = Array.from(localsMap.values()).map(local => ({
        local: local.local,
        total_electors: local.total_electors,
        total_votos: local.total_votos,
        registered_votos: local.registered_votos,
        mesas: Object.values(local.mesas).sort((a, b) => a.mesa - b.mesa)
      })).sort((a, b) => a.local.localeCompare(b.local));

      res.json(response);
    } catch (err: any) {
      console.error('[DIAD PARTICIPATION SUMMARY ERROR]', err);
      res.status(500).json({ error: err.message });
    }
  });

  // ── GET /api/diad/participation-detail/:local/:mesa ───────────────────────
  router.get('/participation-detail/:local/:mesa', async (req, res) => {
    const { local, mesa } = req.params;
    const mesaNum = parseInt(mesa);
    if (isNaN(mesaNum)) {
      return res.status(400).json({ error: 'Mesa inválida' });
    }

    try {
      const voters = await dbQueryAsync<any>(`
        SELECT
          e.nombre,
          e.apellido,
          e.ci,
          e.orden,
          pl.timestamp as voted_at,
          (CASE WHEN ec.id IS NOT NULL THEN 1 ELSE 0 END) as registrado
        FROM participation_logs pl
        JOIN electors e ON pl.local_votacion = e.local_votacion AND pl.mesa = e.mesa AND pl.orden = e.orden
        LEFT JOIN elector_captures ec ON e.ci = ec.elector_ci
        WHERE pl.local_votacion = ? AND pl.mesa = ?
        ORDER BY pl.timestamp DESC
      `, [local, mesaNum]);

      res.json(voters);
    } catch (err: any) {
      console.error('[DIAD PARTICIPATION DETAIL ERROR]', err);
      res.status(500).json({ error: err.message });
    }
  });

  // ── GET /api/diad/participation-detail/:local ──────────────────────────────
  router.get('/participation-detail/:local', async (req, res) => {
    const { local } = req.params;
    try {
      const voters = await dbQueryAsync<any>(`
        SELECT
          e.nombre,
          e.apellido,
          e.ci,
          e.orden,
          e.mesa,
          pl.timestamp as voted_at,
          (CASE WHEN ec.id IS NOT NULL THEN 1 ELSE 0 END) as registrado
        FROM participation_logs pl
        JOIN electors e ON pl.local_votacion = e.local_votacion AND pl.mesa = e.mesa AND pl.orden = e.orden
        LEFT JOIN elector_captures ec ON e.ci = ec.elector_ci
        WHERE pl.local_votacion = ?
        ORDER BY e.mesa ASC, pl.timestamp DESC
      `, [local]);

      res.json(voters);
    } catch (err: any) {
      console.error('[DIAD PARTICIPATION LOCAL DETAIL ERROR]', err);
      res.status(500).json({ error: err.message });
    }
  });

  // ── MESA CONSTITUTION ENDPOINTS ──────────────────────────────────────────
  router.post('/mesa/confirm', (req, res) => {
    const { local_votacion, mesa } = req.body;
    if (!local_votacion || mesa === undefined) {
      return res.status(400).json({ error: 'local_votacion y mesa son requeridos' });
    }
    try {
      db.prepare(`
        INSERT INTO mesa_constitutions (local_votacion, mesa, is_confirmed, confirmed_at)
        VALUES (?, ?, 1, CURRENT_TIMESTAMP)
        ON CONFLICT(local_votacion, mesa) DO UPDATE SET
          is_confirmed = 1,
          confirmed_at = CURRENT_TIMESTAMP
      `).run(local_votacion, mesa);

      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  router.post('/sync-confirmations', (req, res) => {
    const { confirmations } = req.body;
    if (!confirmations || !Array.isArray(confirmations)) {
      return res.status(400).json({ error: 'confirmations debe ser un array' });
    }
    try {
      const stmt = db.prepare(`
        INSERT INTO mesa_constitutions (local_votacion, mesa, is_confirmed, confirmed_at)
        VALUES (?, ?, ?, ?)
        ON CONFLICT(local_votacion, mesa) DO UPDATE SET
          is_confirmed = excluded.is_confirmed,
          confirmed_at = excluded.confirmed_at
      `);

      db.transaction(() => {
        for (const conf of confirmations) {
          const isConfirmed = conf.is_confirmed ? 1 : 0;
          stmt.run(conf.local_votacion, conf.mesa, isConfirmed, conf.confirmed_at || new Date().toISOString());
        }
      })();

      res.json({ success: true, count: confirmations.length });
    } catch (err: any) {
      console.error('[SYNC CONFIRMATIONS ERROR]', err);
      res.status(500).json({ error: err.message });
    }
  });

  router.post('/mesa/upload-acta', upload.single('photo'), (req, res) => {
    const { local_votacion, mesa } = req.body;
    if (!local_votacion || mesa === undefined) {
      return res.status(400).json({ error: 'local_votacion y mesa son requeridos' });
    }
    try {
      const photoUrl = req.file ? `/uploads/${req.file.filename}` : null;
      if (!photoUrl) {
        return res.status(400).json({ error: 'La fotografía del acta es requerida' });
      }

      db.prepare(`
        INSERT INTO mesa_constitutions (local_votacion, mesa, foto_acta_url, constituted_at)
        VALUES (?, ?, ?, CURRENT_TIMESTAMP)
        ON CONFLICT(local_votacion, mesa) DO UPDATE SET
          foto_acta_url = ?,
          constituted_at = CURRENT_TIMESTAMP
      `).run(local_votacion, mesa, photoUrl, photoUrl);

      res.json({ success: true, foto_acta_url: photoUrl });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  router.get('/mesa/status/:local/:mesa', (req, res) => {
    const { local, mesa } = req.params;
    try {
      const constitution = db.prepare(`
        SELECT is_confirmed, foto_acta_url, confirmed_at, constituted_at
        FROM mesa_constitutions
        WHERE local_votacion = ? AND mesa = ?
      `).get(local, mesa) as any;

      const members = db.prepare(`
        SELECT id, nombre, role, ci, telefono, assigned_table_role
        FROM users
        WHERE assigned_local = ? AND assigned_mesa = ?
      `).all(local, mesa) as any[];

      res.json({
        is_confirmed: constitution ? !!constitution.is_confirmed : false,
        foto_acta_url: constitution ? constitution.foto_acta_url : null,
        confirmed_at: constitution ? constitution.confirmed_at : null,
        constituted_at: constitution ? constitution.constituted_at : null,
        members
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  router.post('/wipe-test-data', (req, res) => {
    try {
      // Clear only participation and constitution data — NOT member assignments
      db.prepare('DELETE FROM mesa_constitutions').run();
      db.prepare('DELETE FROM participation_logs').run();
      res.json({ success: true, message: 'Base de datos limpia de pruebas.' });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Fix users assigned to mesa=0 (invalid) — reset their mesa to NULL so they can be properly reassigned via UI
  router.post('/fix-mesa-zero', (req, res) => {
    try {
      const result = db.prepare(`
        UPDATE users 
        SET assigned_mesa = NULL 
        WHERE (assigned_mesa = 0 OR assigned_mesa IS NULL) 
          AND assigned_local IS NOT NULL 
          AND assigned_local != ''
          AND role IN ('MIEMBRO_MESA', 'MIEMBRO_DE_MESA', 'PRESIDENTE', 'VOCAL', 'VEEDOR')
      `).run();
      res.json({ success: true, fixed: result.changes, message: `${result.changes} miembros liberados de mesa=0` });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  router.get('/debug-cerro', (req, res) => {
    try {
      const users = db.prepare("SELECT id, username, ci, nombre, role, assigned_local, distrito FROM users WHERE assigned_local LIKE '%CERRO%'").all();
      res.json({ users });
    } catch (e: any) {
      res.status(500).json({ error: e.message });

    }
  });

  router.get('/debug-members-consistency', (req, res) => {
    try {
      const districtFilter = getDistrict(req);

      // Get all members with assignments
      const allMembers = db.prepare(`
        SELECT id, nombre, ci, role, assigned_local, assigned_mesa, distrito
        FROM users
        WHERE role IN ('VEEDOR', 'MIEMBRO_MESA', 'MIEMBRO_DE_MESA', 'APODERADO', 'PRESIDENTE', 'VOCAL')
        AND assigned_local IS NOT NULL
        AND assigned_local != ''
        LIMIT 50
      `).all();

      // Check which ones would pass the district filter
      const districtFilter_normalized = districtFilter ? districtFilter.replace('Ó', 'O').replace('ó', 'o').replace('ô', 'o') : null;
      const members_with_filter_check = allMembers.map((m: any) => {
        let passes_filter = false;
        if (!districtFilter_normalized) {
          passes_filter = true;
        } else {
          // Check if would pass the district filter
          if (m.distrito && m.distrito.toUpperCase().includes(districtFilter_normalized.toUpperCase())) {
            passes_filter = true;
          } else {
            const votingLocMatch = db.prepare(`
              SELECT COUNT(*) as cnt FROM voting_locations
              WHERE nombre = ? AND (UPPER(distrito) LIKE UPPER(?) OR UPPER(ciudad) LIKE UPPER(?))
            `).get(m.assigned_local, `%${districtFilter_normalized}%`, `%${districtFilter_normalized}%`) as any;
            passes_filter = votingLocMatch.cnt > 0;
          }
        }
        return { ...m, passes_filter };
      });

      // Also check voting_locations structure
      const votingLocs_sample = db.prepare(`
        SELECT DISTINCT nombre, distrito, ciudad FROM voting_locations LIMIT 10
      `).all();

      res.json({
        district_filter: districtFilter,
        all_members_count: allMembers.length,
        members_with_filter: members_with_filter_check,
        voting_locations_sample: votingLocs_sample
      });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  router.get('/diagnose-votes-concepcion', (req, res) => {
    try {
      // Check Concepcion voting participation
      const concepcionLocations = db.prepare(`
        SELECT DISTINCT nombre FROM voting_locations
        WHERE distrito LIKE '%CONCEPCION%' OR ciudad LIKE '%CONCEPCION%'
      `).all() as any[];

      const locationNames = concepcionLocations.map(l => l.nombre);

      // Check participation logs for Concepcion
      const participationByMesa = db.prepare(`
        SELECT local_votacion, mesa, COUNT(*) as votos
        FROM participation_logs
        WHERE local_votacion IN (${locationNames.map(() => '?').join(',')})
        GROUP BY local_votacion, mesa
        ORDER BY votos DESC
      `).all(...locationNames) as any[];

      // Check results (actas) for Concepcion
      const resultsByMesa = db.prepare(`
        SELECT local_votacion, mesa, COUNT(*) as acta_count
        FROM results
        WHERE local_votacion IN (${locationNames.map(() => '?').join(',')})
        GROUP BY local_votacion, mesa
      `).all(...locationNames) as any[];

      // Check audit logs for voting activity
      const auditVotingActivity = db.prepare(`
        SELECT action, COUNT(*) as count, MAX(timestamp) as last_activity
        FROM audit_logs
        WHERE entity = 'PARTICIPATION' OR entity = 'VOTE' OR action LIKE '%vote%' OR action LIKE '%VOTE%'
        GROUP BY action
        ORDER BY last_activity DESC
      `).all() as any[];

      // Total votos vs actas
      const summary = {
        concepcion_locations: locationNames.length,
        total_participation_logs: db.prepare(`SELECT COUNT(*) as cnt FROM participation_logs`).get(),
        total_results: db.prepare(`SELECT COUNT(*) as cnt FROM results`).get(),
        participation_in_concepcion: participationByMesa.length,
        results_in_concepcion: resultsByMesa.length
      };

      res.json({
        concepcionLocations: locationNames,
        participationByMesa: participationByMesa.slice(0, 20),
        resultsByMesa: resultsByMesa.slice(0, 20),
        auditVotingActivity: auditVotingActivity.slice(0, 10),
        summary,
        warning: participationByMesa.length === 0 ? '⚠️ NO PARTICIPATION LOGS FOUND FOR CONCEPCION' : '',
        info: 'If participation_logs is empty but results exist, votes may be saved directly without participation tracking'
      });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  router.get('/diagnose-critical', (req, res) => {
    try {
      // 1. Check Concepcion members
      const concepcionMembers = db.prepare(`
        SELECT id, nombre, ci, role, assigned_local, assigned_mesa, distrito
        FROM users
        WHERE (distrito LIKE '%CONCEPCION%' OR assigned_local LIKE '%CONCEPCION%')
        AND role IN ('MIEMBRO_MESA', 'MIEMBRO_DE_MESA', 'VEEDOR', 'APODERADO', 'PRESIDENTE', 'VOCAL')
        LIMIT 50
      `).all();

      // 2. Check SUBJEFE role users
      const subjefes = db.prepare(`
        SELECT id, nombre, username, role, distrito, assigned_local, enabled_modules
        FROM users
        WHERE role = 'SUBJEFE'
        LIMIT 20
      `).all();

      // 3. Check participation issues
      const participationIssues = db.prepare(`
        SELECT
          COUNT(*) as total_participation_logs,
          COUNT(DISTINCT local_votacion) as distinct_locals,
          COUNT(DISTINCT mesa) as distinct_mesas
        FROM participation_logs
      `).get();

      // 4. Check for orphan users (created but not in locations)
      const orphanUsers = db.prepare(`
        SELECT u.id, u.nombre, u.ci, u.role, u.assigned_local, u.assigned_mesa, u.distrito
        FROM users u
        LEFT JOIN voting_locations vl ON u.assigned_local = vl.nombre
        WHERE u.assigned_local IS NOT NULL
        AND u.assigned_local != ''
        AND vl.nombre IS NULL
        AND u.role IN ('MIEMBRO_MESA', 'MIEMBRO_DE_MESA', 'VEEDOR')
        LIMIT 30
      `).all();

      // 5. Check Concepcion voting locations
      const concepcionLocations = db.prepare(`
        SELECT nombre, distrito, ciudad
        FROM voting_locations
        WHERE distrito LIKE '%CONCEPCION%' OR ciudad LIKE '%CONCEPCION%'
        LIMIT 20
      `).all();

      // 6. Check total users by district
      const usersByDistrict = db.prepare(`
        SELECT distrito, COUNT(*) as count
        FROM users
        WHERE role IN ('MIEMBRO_MESA', 'MIEMBRO_DE_MESA', 'VEEDOR', 'APODERADO')
        GROUP BY distrito
        ORDER BY count DESC
        LIMIT 10
      `).all();

      res.json({
        concepcionMembers: { count: (concepcionMembers as any[]).length, data: concepcionMembers },
        subjefes: { count: (subjefes as any[]).length, data: subjefes },
        participationIssues,
        orphanUsers: { count: (orphanUsers as any[]).length, data: orphanUsers },
        concepcionLocations: { count: (concepcionLocations as any[]).length, data: concepcionLocations },
        usersByDistrict,
        summary: {
          problem_concepcion_lost: (concepcionMembers as any[]).length === 0,
          problem_subjefe_missing: (subjefes as any[]).length === 0,
          problem_participation_empty: (participationIssues as any).total_participation_logs === 0,
          problem_orphan_users: (orphanUsers as any[]).length > 0
        }
      });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  router.get('/audit-data-sync', (req, res) => {
    try {
      console.log('[AUDIT] Starting data sync audit...');

      // 1. Check mesa_constitutions vs participation_logs
      const constitutions = db.prepare(`
        SELECT local_votacion, mesa, is_confirmed, confirmed_at, foto_acta_url, constituted_at
        FROM mesa_constitutions
        LIMIT 20
      `).all();

      // 2. Check for votos registered without constitution confirmed
      const votos_without_constitution = db.prepare(`
        SELECT DISTINCT pl.local_votacion, pl.mesa, COUNT(*) as votos_count
        FROM participation_logs pl
        LEFT JOIN mesa_constitutions mc ON pl.local_votacion = mc.local_votacion AND pl.mesa = mc.mesa
        WHERE mc.local_votacion IS NULL
        GROUP BY pl.local_votacion, pl.mesa
        LIMIT 20
      `).all();

      // 3. Check participacion_logs structure
      const participation_sample = db.prepare(`
        SELECT local_votacion, mesa, COUNT(*) as votos
        FROM participation_logs
        GROUP BY local_votacion, mesa
        LIMIT 10
      `).all();

      // 4. Check if there are results without corresponding participation
      const results_structure = db.prepare(`
        SELECT r.id, r.local_votacion, r.mesa, r.veedor_id,
               COUNT(ar.id) as acta_results_count,
               (SELECT COUNT(*) FROM participation_logs
                WHERE local_votacion = r.local_votacion AND mesa = r.mesa) as participation_count
        FROM results r
        LEFT JOIN acta_results ar ON r.id = ar.acta_id
        GROUP BY r.local_votacion, r.mesa
        LIMIT 20
      `).all();

      // 5. Check audit logs for apoderado confirmations
      const audit_logs = db.prepare(`
        SELECT id, user_id, action, entity, entity_id, details, timestamp
        FROM audit_logs
        WHERE action LIKE '%confirm%' OR action LIKE '%mesa%' OR entity = 'MESA'
        ORDER BY timestamp DESC
        LIMIT 20
      `).all();

      res.json({
        mesa_constitutions: constitutions,
        votos_without_constitution: votos_without_constitution,
        participation_sample: participation_sample,
        results_structure: results_structure,
        audit_logs: audit_logs,
        summary: {
          total_constitutions: db.prepare('SELECT COUNT(*) as cnt FROM mesa_constitutions').get(),
          total_participation_logs: db.prepare('SELECT COUNT(*) as cnt FROM participation_logs').get(),
          total_results: db.prepare('SELECT COUNT(*) as cnt FROM results').get(),
          confirmed_mesas: db.prepare('SELECT COUNT(*) as cnt FROM mesa_constitutions WHERE is_confirmed = 1').get()
        }
      });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  router.post('/fix-orphan-users', async (req, res) => {
    try {
      console.log('[FIX] Fixing orphan users with non-existent voting locations...');

      // Find all users assigned to voting locations that don't exist
      const orphans = db.prepare(`
        SELECT u.id, u.assigned_local, u.distrito
        FROM users u
        LEFT JOIN voting_locations vl ON u.assigned_local = vl.nombre
        WHERE u.assigned_local IS NOT NULL
        AND u.assigned_local != ''
        AND vl.nombre IS NULL
        AND u.role IN ('MIEMBRO_MESA', 'MIEMBRO_DE_MESA', 'VEEDOR')
      `).all() as any[];

      console.log(`[FIX] Found ${orphans.length} orphan users`);

      if (orphans.length === 0) {
        return res.json({ success: true, fixed: 0, message: 'No orphan users found' });
      }

      // Group by assigned_local to find the correct voting location
      const orphansByLocal = new Map<string, any[]>();
      orphans.forEach(u => {
        if (!orphansByLocal.has(u.assigned_local)) {
          orphansByLocal.set(u.assigned_local, []);
        }
        orphansByLocal.get(u.assigned_local)!.push(u);
      });

      // For each orphan local, try to find a match in voting_locations
      const fixes: any[] = [];
      orphansByLocal.forEach((users, orphanLocal) => {
        // Try fuzzy matching
        const candidates = db.prepare(`
          SELECT nombre, distrito, ciudad
          FROM voting_locations
          WHERE UPPER(nombre) LIKE UPPER(?)
          OR UPPER(ciudad) LIKE UPPER(?)
          LIMIT 3
        `).all(`%${orphanLocal.substring(0, 10)}%`, `%${orphanLocal.substring(0, 10)}%`) as any[];

        if (candidates.length > 0) {
          const correctLocal = candidates[0];
          users.forEach(u => {
            db.prepare('UPDATE users SET assigned_local = ? WHERE id = ?')
              .run(correctLocal.nombre, u.id);
            fixes.push({ id: u.id, from: orphanLocal, to: correctLocal.nombre });
          });
        }
      });

      // Clear cache
      await diadCoverageCache.invalidate();

      res.json({
        success: true,
        fixed: fixes.length,
        fixes: fixes.slice(0, 10),
        message: `Fixed ${fixes.length} users by matching voting locations`
      });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  router.post('/test-member-assignment', (req, res) => {
    try {
      console.log('[TEST] Starting test member assignment...');

      // Get an elector from padrón
      const elector = db.prepare(`
        SELECT ci, nombre, apellido FROM electors
        WHERE local_votacion IS NOT NULL AND mesa IS NOT NULL
        LIMIT 1
      `).get() as any;

      if (!elector) return res.status(404).json({ error: 'No electors found in padrón' });

      // Get a voting location
      const votingLoc = db.prepare(`
        SELECT nombre, distrito, ciudad FROM voting_locations LIMIT 1
      `).get() as any;

      if (!votingLoc) return res.status(404).json({ error: 'No voting locations found' });

      console.log(`[TEST] Using elector: ${elector.ci} - ${elector.nombre}`);
      console.log(`[TEST] Using location: ${votingLoc.nombre} (${votingLoc.distrito || votingLoc.ciudad})`);

      // Clean up previous test user
      db.prepare('DELETE FROM users WHERE ci = ?').run(elector.ci);

      // Create user (simulating the assignment endpoint)
      const username = `member_${elector.ci}`;
      const userDistrict = votingLoc.distrito || votingLoc.ciudad;
      const result = db.prepare(`
        INSERT INTO users (username, password, role, nombre, ci, telefono, distrito)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(
        username,
        `pass_${elector.ci}`,
        'MIEMBRO_MESA',
        `${elector.nombre} ${elector.apellido}`,
        elector.ci,
        null,
        userDistrict
      );

      const userId = result.lastInsertRowid as number;

      // Assign to mesa
      const mesa = 1;
      db.prepare(`
        UPDATE users
        SET assigned_local = ?, assigned_mesa = ?, role = ?, assigned_table_role = ?
        WHERE id = ?
      `).run(votingLoc.nombre, mesa, 'MIEMBRO_MESA', null, userId);

      console.log(`[TEST] User created and assigned: ID=${userId}, Mesa=${mesa}`);

      // Check if member appears in members list with district filter
      const district = votingLoc.distrito || votingLoc.ciudad;
      const members = db.prepare(`
        SELECT u.id, u.nombre, u.assigned_local, u.assigned_mesa, u.distrito
        FROM users u
        WHERE u.role IN ('VEEDOR', 'MIEMBRO_MESA', 'MIEMBRO_DE_MESA', 'APODERADO', 'PRESIDENTE', 'VOCAL')
        AND (
          UPPER(u.distrito) LIKE UPPER(?)
          OR u.assigned_local IN (
            SELECT nombre FROM voting_locations
            WHERE UPPER(distrito) LIKE UPPER(?) OR UPPER(ciudad) LIKE UPPER(?)
          )
        )
      `).all(`%${district}%`, `%${district}%`, `%${district}%`) as any[];

      const found = members.find(m => m.id === userId);

      // Cleanup
      db.prepare('DELETE FROM users WHERE id = ?').run(userId);

      res.json({
        success: true,
        test: {
          elector: elector.ci,
          location: votingLoc.nombre,
          district: district,
          user_created: { id: userId, nombre: `${elector.nombre} ${elector.apellido}`, distrito: userDistrict },
          assigned_to_mesa: mesa,
          appears_in_members_list: !!found,
          total_members_in_district: members.length,
          message: found ? '✅ TEST PASSED: User appears in members list' : '❌ TEST FAILED: User NOT in members list'
        }
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  return router;
}


export function veedorRoutes() {
  const router = Router();

  router.get('/table-status', (req, res) => {
    try {
      const userId = req.headers['x-user-id'];
      if (!userId) return res.status(401).json({ error: 'No user ID provided' });

      const user = db.prepare('SELECT assigned_local, assigned_mesa FROM users WHERE id = ?').get(userId) as any;
      if (!user?.assigned_local) {
        return res.json({ info: { local: 'SIN ASIGNACIÓN', mesa: 0, total: 400 }, votedOrders: [] });
      }

      const local = user.assigned_local;
      const mesa = user.assigned_mesa || 1;
      const stats = db.prepare('SELECT MAX(orden) as total FROM electors WHERE local_votacion = ? AND mesa = ?').get(local, mesa) as any;
      const voted = db.prepare('SELECT orden FROM participation_logs WHERE local_votacion = ? AND mesa = ?').all(local, mesa) as any[];
      res.json({ info: { local, mesa, total: stats?.total || 400 }, votedOrders: voted.map(v => v.orden) });
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  router.post('/mark-vote', (req, res) => {
    const { order, local: bodyLocal, mesa: bodyMesa } = req.body;
    const userId = req.headers['x-user-id'];
    if (!userId) return res.status(401).json({ error: 'No user ID provided' });
    try {
      const user = db.prepare('SELECT assigned_local, assigned_mesa FROM users WHERE id = ?').get(userId) as any;
      const local = bodyLocal || user?.assigned_local || 'ESC. BAS. CARLOS ANTONIO LOPEZ';
      const mesa = bodyMesa || user?.assigned_mesa || 1;
      db.prepare(`INSERT OR IGNORE INTO participation_logs (local_votacion, mesa, orden, veedor_id) VALUES (?, ?, ?, ?)`).run(local, mesa, order, userId);
      res.json({ success: true });
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  router.post('/unmark-vote', (req, res) => {
    const { order, local: bodyLocal, mesa: bodyMesa } = req.body;
    const userId = req.headers['x-user-id'];
    if (!userId) return res.status(401).json({ error: 'No user ID provided' });
    try {
      const user = db.prepare('SELECT assigned_local, assigned_mesa FROM users WHERE id = ?').get(userId) as any;
      const local = bodyLocal || user?.assigned_local || 'ESC. BAS. CARLOS ANTONIO LOPEZ';
      const mesa = bodyMesa || user?.assigned_mesa || 1;
      db.prepare(`DELETE FROM participation_logs WHERE local_votacion = ? AND mesa = ? AND orden = ?`).run(local, mesa, order);
      res.json({ success: true });
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  return router;
}
