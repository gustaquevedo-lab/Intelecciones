import { Router } from 'express';
import multer from 'multer';
import db from '../db';
import { getCachedUserInfo, getRole, getSecurityFilter, getListId, getDistrict, requireRole, sanitizeElectorData } from './helpers';
import { dbQueryAsync, dbGetAsync } from '../db-async';
import { trackEvent, fullReportCache, myTeamReportsCache, invalidateAllReportsCaches, logAction } from '../server';
import { normalizePhone } from '../utils/phone';

export default function teamRoutes(upload: multer.Multer) {
  const router = Router();
router.get('/padrino/team-stats', (req, res) => {
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
router.get('/structure/padrinos', (req, res) => {
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

router.get('/structure/padrinos/:id/coordinators', (req, res) => {
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

router.get('/structure/coordinators/:id/electors', (req, res) => {
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

router.get('/structure/padrinos/:id/full-report', async (req, res) => {
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

router.get('/coordinator/:id/captures', (req, res) => {
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

router.get('/admin/requests', (req, res) => {
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

router.post('/admin/requests/:id/resolve', (req, res) => {
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

router.post('/coordinator/request', upload.fields([{ name: 'photo', maxCount: 1 }, { name: 'audio', maxCount: 1 }]), (req, res) => {
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

router.get('/admin/activity', (req, res) => {
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
router.get('/my-team', requireRole('SUPERUSUARIO','JEFE_CAMPANA','PADRINO','SUBJEFE'), (req, res) => {
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
router.get('/my-team/reports', requireRole('SUPERUSUARIO','JEFE_CAMPANA','PADRINO','SUBJEFE'), async (req, res) => {
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
          extraFilters += ` AND (u.parent_id = ? OR ec.coordinator_id = ?)`;
          extraParams.push(parseInt(selectedPadrino), parseInt(selectedPadrino));
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
          electorSql += ` AND (u.parent_id = ? OR ec.coordinator_id = ?)`;
          electorParams.push(parseInt(selectedPadrino), parseInt(selectedPadrino));
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
router.get('/my-team/padrino/:id/coordinators', requireRole('SUPERUSUARIO','JEFE_CAMPANA','PADRINO','SUBJEFE'), (req, res) => {
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
router.get('/campaigns/mine', requireRole('SUPERUSUARIO','JEFE_CAMPANA','SUBJEFE','PADRINO'), (req, res) => {
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
// GET /my-team/copiatines — electors for copiatín printing
router.get('/my-team/copiatines', requireRole('SUPERUSUARIO','JEFE_CAMPANA','PADRINO','SUBJEFE'), async (req, res) => {
  const requesterId = req.headers['x-user-id'] as string;
  const role = getRole(req);
  const onlyUnprinted = req.query.only_unprinted === '1';
  const padrinoId = req.query.padrino_id as string;
  const coordinatorId = req.query.coordinator_id as string;

  try {
    const filter = getSecurityFilter(req, 'u');

    let filterPadrinos: any[] = [];
    if (role !== 'PADRINO') {
      filterPadrinos = await dbQueryAsync<any>(
        `SELECT u.id, u.nombre FROM users u WHERE u.role IN ('PADRINO','SUBJEFE') ${filter.sql} ORDER BY u.nombre`,
        filter.params
      );
    }

    let filterCoordinators: any[] = [];
    if (role === 'PADRINO') {
      filterCoordinators = await dbQueryAsync<any>(
        `SELECT u.id, u.nombre, u.parent_id FROM users u WHERE u.parent_id = ? AND u.role IN ('COORDINADOR','MIEMBRO_DE_MESA') ORDER BY u.nombre`,
        [requesterId]
      );
    } else {
      filterCoordinators = await dbQueryAsync<any>(
        `SELECT u.id, u.nombre, u.parent_id FROM users u WHERE u.role IN ('COORDINADOR','MIEMBRO_DE_MESA') ${filter.sql} ORDER BY u.nombre`,
        filter.params
      );
    }

    let electorSql = `
      SELECT ec.id as capture_id, ec.elector_ci, ec.copiatin_printed_at,
             COALESCE(e.nombre, 'ELECTOR') as nombre,
             COALESCE(e.apellido, 'NO REGISTRADO') as apellido,
             COALESCE(e.local_votacion, '') as local_votacion,
             COALESCE(e.mesa, 0) as mesa,
             COALESCE(e.orden, 0) as orden,
             COALESCE(e.ciudad, e.distrito, '') as ciudad,
             u.nombre as coordinator_name,
             u.parent_id as padrino_id,
             p.nombre as padrino_name,
             l.list_number, l.option_number, l.candidate_nombre, l.candidate_alias,
             l.campaign_id, c.name as campaign_name
      FROM elector_captures ec
      LEFT JOIN electors e ON ec.elector_ci = e.ci
      LEFT JOIN users u ON ec.coordinator_id = u.id
      LEFT JOIN users p ON u.parent_id = p.id
      LEFT JOIN lists l ON ec.list_id = l.id
      LEFT JOIN campaigns c ON l.campaign_id = c.id
      WHERE 1=1
    `;
    let electorParams: any[] = [];

    if (role === 'PADRINO') {
      electorSql += ` AND (u.parent_id = ? OR ec.coordinator_id = ?)`;
      electorParams.push(requesterId, requesterId);
    } else {
      electorSql += ` ${filter.sql}`;
      electorParams.push(...filter.params);
    }

    if (padrinoId && padrinoId !== 'ALL') {
      electorSql += ` AND u.parent_id = ?`;
      electorParams.push(parseInt(padrinoId));
    }
    if (coordinatorId && coordinatorId !== 'ALL') {
      electorSql += ` AND ec.coordinator_id = ?`;
      electorParams.push(parseInt(coordinatorId));
    }
    if (onlyUnprinted) {
      electorSql += ` AND ec.copiatin_printed_at IS NULL`;
    }

    electorSql += ` ORDER BY e.apellido, e.nombre LIMIT 500`;

    const electors = await dbQueryAsync<any>(electorSql, electorParams);

    const requesterInfo = getCachedUserInfo(requesterId);
    let campaignLists: any[] = [];
    if (requesterInfo?.campaign_id) {
      campaignLists = await dbQueryAsync<any>(
        `SELECT id, type, list_number, option_number, candidate_nombre, candidate_alias, photo_url
         FROM lists WHERE campaign_id = ? AND COALESCE(is_adversary, 0) = 0 ORDER BY id`,
        [requesterInfo.campaign_id]
      );
    }

    res.json({ electors, campaignLists, filterPadrinos, filterCoordinators });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /my-team/copiatines/mark-printed — mark captures as printed
router.post('/my-team/copiatines/mark-printed', requireRole('SUPERUSUARIO','JEFE_CAMPANA','PADRINO','SUBJEFE'), (req, res) => {
  const { capture_ids } = req.body;
  if (!Array.isArray(capture_ids) || capture_ids.length === 0) {
    return res.status(400).json({ error: 'capture_ids requerido' });
  }
  try {
    const placeholders = capture_ids.map(() => '?').join(',');
    db.prepare(
      `UPDATE elector_captures SET copiatin_printed_at = CURRENT_TIMESTAMP WHERE id IN (${placeholders}) AND copiatin_printed_at IS NULL`
    ).run(...capture_ids);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

  return router;
}
