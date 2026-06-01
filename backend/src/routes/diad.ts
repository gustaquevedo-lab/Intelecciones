import { Router } from 'express';
import multer from 'multer';
import db from '../db';
import { dbQueryAsync, dbGetAsync } from '../db-async';
import { getCachedUserInfo, getRole, getListId } from './helpers';
import { diadCoverageCache } from '../server';

export default function diadRoutes(upload: multer.Multer) {
  const router = Router();

  router.get('/coverage', async (req, res) => {
    const list_id = getListId(req);
    const role = getRole(req);
    const user_id = req.headers['x-user-id'];

    const cacheKey = `${user_id || 'global'}_${list_id || ''}`;
    const cached = await diadCoverageCache.get(cacheKey);
    if (cached) return res.json(cached);

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
      const mesasTotal = await dbGetAsync<any>(`SELECT COUNT(DISTINCT local_votacion || '-' || mesa) as total_mesas FROM electors ${distritoFilter}`, []);
      const total_mesas = mesasTotal?.total_mesas || 0;

      const assignedRow = await dbGetAsync<any>(`
        SELECT COUNT(DISTINCT u.assigned_local || '-' || u.assigned_mesa) as assigned_mesas
        FROM users u
        JOIN voting_locations vl ON u.assigned_local = vl.nombre
        WHERE (u.role = 'VEEDOR' OR u.role = 'MIEMBRO_MESA')
        AND u.assigned_local IS NOT NULL AND u.assigned_mesa IS NOT NULL
        ${vlFilter}
        ${list_id && !isNaN(list_id) ? `AND u.assigned_list_id = ${list_id}` : ''}
      `, []);
      const assigned_mesas = assignedRow?.assigned_mesas || 0;

      const reportedRow = await dbGetAsync<any>(`
        SELECT COUNT(DISTINCT r.local_votacion || '-' || r.mesa) as reported_mesas
        FROM results r
        JOIN voting_locations vl ON r.local_votacion = vl.nombre
        WHERE 1=1 ${vlFilter}
        ${list_id && !isNaN(list_id) ? `AND r.tenant_id = ${list_id}` : ''}
      `, []);
      const reported_mesas = reportedRow?.reported_mesas || 0;

      const votos = await dbGetAsync<any>(`
        SELECT
          (SELECT COALESCE(SUM(ar.votos), 0) FROM acta_results ar JOIN results r2 ON ar.acta_id = r2.id JOIN voting_locations vl ON r2.local_votacion = vl.nombre WHERE 1=1 ${vlFilter} ${list_id && !isNaN(list_id) ? `AND r2.tenant_id = ${list_id}` : ''}) +
          (SELECT COALESCE(SUM(r3.votos_blancos + r3.votos_nulos), 0) FROM results r3 JOIN voting_locations vl ON r3.local_votacion = vl.nombre WHERE 1=1 ${vlFilter} ${list_id && !isNaN(list_id) ? `AND r3.tenant_id = ${list_id}` : ''}) as total
      `, []);

      const mesas = await dbQueryAsync<any>(`
        SELECT
          e.local_votacion as local, e.mesa as numero, vl.lat, vl.lng,
          (CASE WHEN r.id IS NOT NULL THEN 1 ELSE 0 END) as reportada,
          (CASE WHEN u.id IS NOT NULL THEN 1 ELSE 0 END) as operativa
        FROM (SELECT local_votacion, mesa FROM electors ${distritoFilter} GROUP BY local_votacion, mesa) e
        JOIN voting_locations vl ON e.local_votacion = vl.nombre
        LEFT JOIN (SELECT id, local_votacion, mesa FROM results GROUP BY local_votacion, mesa) r ON r.local_votacion = e.local_votacion AND r.mesa = e.mesa
        LEFT JOIN (SELECT id, assigned_local, assigned_mesa FROM users WHERE (role = 'VEEDOR' OR role = 'MIEMBRO_MESA') GROUP BY assigned_local, assigned_mesa) u ON u.assigned_local = e.local_votacion AND u.assigned_mesa = e.mesa
        WHERE 1=1 ${vlFilter}
      `, []);

      const coordRow = await dbGetAsync<any>(`
        SELECT COUNT(*) as total_coordinadores FROM users u
        WHERE role = 'COORDINADOR'
        ${districtName ? `AND (UPPER(u.distrito) = UPPER('${districtName}'))` : ''}
        ${list_id && !isNaN(list_id) ? `AND u.assigned_list_id = ${list_id}` : ''}
      `, []);

      const vehicRow = await dbGetAsync<any>(`
        SELECT COUNT(*) as total_vehiculos FROM vehicles v
        WHERE 1=1
        ${list_id && !isNaN(list_id) ? `AND (v.assigned_list_id = ${list_id})` : ''}
      `, []);

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

  router.get('/results', (req, res) => {
    const list_id = getListId(req);
    try {
      const formatted = db.prepare(`
        SELECT l.id, l.list_number, l.candidate_alias, l.type, l.candidate_nombre,
          COALESCE(SUM(ar.votos), 0) as votos
        FROM lists l
        LEFT JOIN acta_results ar ON l.id = ar.lista_id
        ${list_id && !isNaN(list_id) ? `WHERE l.campaign_id = (SELECT campaign_id FROM lists WHERE id = ${list_id})` : ''}
        GROUP BY l.id ORDER BY votos DESC
      `).all() as any[];
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
    try {
      const result = db.prepare(`
        INSERT INTO lists (list_number, candidate_alias, type, is_adversary, campaign_id) VALUES (?, ?, ?, ?, 1)
      `).run(list_number, candidate_alias, type, is_adversary ? 1 : 0);
      res.json({ success: true, id: result.lastInsertRowid });
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  router.post('/acta', upload.single('foto_acta'), (req, res) => {
    const { mesa_id, votos_blanco, votos_nulos, listas } = req.body;
    const userId = req.headers['x-user-id'];
    try {
      const photoUrl = req.file ? `/uploads/${req.file.filename}` : null;
      const parsedListas = JSON.parse(listas);

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
    try {
      const actas = db.prepare(`
        SELECT r.id, r.mesa as mesa_numero, r.local_votacion as local,
          u.nombre as submitted_by,
          ((SELECT COALESCE(SUM(votos), 0) FROM acta_results ar WHERE ar.acta_id = r.id) + r.votos_blancos + r.votos_nulos) as votos_total,
          r.foto_acta_url as foto_url, r.timestamp as submitted_at
        FROM results r
        LEFT JOIN users u ON r.veedor_id = u.id
        ${list_id && !isNaN(list_id) ? `WHERE r.tenant_id = ${list_id}` : ''}
        ORDER BY r.timestamp DESC
      `).all();
      res.json(actas);
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  router.get('/members', (req, res) => {
    try {
      const members = db.prepare(`
        SELECT u.id, u.nombre, u.assigned_local, u.assigned_mesa, u.role, u.ci, u.telefono
        FROM users u WHERE u.role IN ('VEEDOR', 'MIEMBRO_MESA', 'APODERADO')
      `).all();
      res.json(members);
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  router.post('/members/assign', (req, res) => {
    const { ci, local, mesa, user_id, role } = req.body;
    const targetRole = role || 'MIEMBRO_MESA';
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
          const result = db.prepare(`INSERT INTO users (username, password, role, nombre, ci) VALUES (?, ?, ?, ?, ?)`).run(username, password, targetRole, fullName, ci);
          targetId = result.lastInsertRowid;
        }
      }
      if (!targetId) return res.status(400).json({ error: 'No se pudo identificar al usuario' });
      db.prepare(`UPDATE users SET assigned_local = ?, assigned_mesa = ?, role = ? WHERE id = ?`).run(local, mesa, targetRole, targetId);
      res.json({ success: true });
    } catch (err: any) { res.status(500).json({ error: err.message }); }
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
    const { order } = req.body;
    const userId = req.headers['x-user-id'];
    if (!userId) return res.status(401).json({ error: 'No user ID provided' });
    try {
      const user = db.prepare('SELECT assigned_local, assigned_mesa FROM users WHERE id = ?').get(userId) as any;
      const local = user?.assigned_local || 'ESC. BAS. CARLOS ANTONIO LOPEZ';
      const mesa = user?.assigned_mesa || 1;
      db.prepare(`INSERT INTO participation_logs (local_votacion, mesa, orden, veedor_id) VALUES (?, ?, ?, ?)`).run(local, mesa, order, userId);
      res.json({ success: true });
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  return router;
}
