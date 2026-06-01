import { Router } from 'express';
import db from '../db';
import {
  getCachedUserInfo, getRole, getSecurityFilter, getListId
} from './helpers';
import {
  captureLimiter, clearElectorsCache, invalidateAllReportsCaches,
  logAction, CaptureSchema
} from '../server';

export default function capturesRoutes() {
  const router = Router();

  // ── POST /api/captures ──────────────────────────────────────────────────────
  router.post('/', captureLimiter, (req, res) => {
    try {
      const rawCapture = CaptureSchema.parse(req.body);
      const capture = { ...rawCapture, elector_ci: rawCapture.elector_ci.replace(/\./g, '').replace(/,/g, '').trim() };

      const user = db.prepare('SELECT assigned_list_id, assigned_campaign_id, distrito FROM users WHERE id = ?').get(capture.coordinator_id) as any;
      const list_id = user?.assigned_list_id;
      const campaign_id = user?.assigned_campaign_id;
      const userDistrict = user?.distrito || 'DESCONOCIDO';

      if (!list_id) return res.status(403).json({ error: 'El usuario no tiene una lista asignada.' });

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
          capture.elector_ci, nombre, apellido,
          userDistrict, userDistrict, campaign_id,
          capture.photo_ci_frente || null, capture.photo_ci_verso || null
        );

        clearElectorsCache();
      }

      const transaction = db.transaction(() => {
        const intraListCapture = db.prepare('SELECT * FROM elector_captures WHERE elector_ci = ? AND list_id = ? LIMIT 1')
          .get(capture.elector_ci, list_id) as any;

        if (intraListCapture) {
          if (intraListCapture.coordinator_id !== capture.coordinator_id) {
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
            db.prepare(`
              UPDATE elector_captures
              SET lat = ?, lng = ?, traffic_light = ?, needs_transport = ?, photo_ci_frente = ?, photo_ci_verso = ?, timestamp = CURRENT_TIMESTAMP
              WHERE elector_ci = ? AND coordinator_id = ? AND list_id = ?
            `).run(capture.lat, capture.lng, capture.traffic_light, capture.needs_transport ? 1 : 0, capture.photo_ci_frente || null, capture.photo_ci_verso || null, capture.elector_ci, capture.coordinator_id, list_id);

            logAction(capture.coordinator_id, 'UPDATE', 'CAPTURE', capture.elector_ci, `Updated capture for ${capture.elector_ci}`);
            return { success: true, message: 'Captura actualizada correctamente.', is_disputed: intraListCapture.is_disputed === 1 };
          }
        }

        const interListCapture = db.prepare(`
          SELECT * FROM elector_captures
          WHERE elector_ci = ? AND campaign_id = ? AND list_id != ? AND is_disputed = 0
          LIMIT 1
        `).get(capture.elector_ci, campaign_id, list_id) as any;

        if (interListCapture) {
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

  // ── GET /api/captures ───────────────────────────────────────────────────────
  router.get('/', (req, res) => {
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

      const totalCountRes = db.prepare(`
        SELECT COUNT(*) as count
        FROM elector_captures ec
        LEFT JOIN electors e ON ec.elector_ci = e.ci
        JOIN users u ON ec.coordinator_id = u.id
        WHERE 1=1 ${sec.sql} ${listFilter} ${localFilter}
      `).get(...params) as any;
      const total = totalCountRes?.count || 0;

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

      res.json({ data: captures, total, page, perPage, totalPages: Math.ceil(total / perPage) });
    } catch (err: any) {
      console.error('[CAPTURES ERROR]', err);
      res.status(500).json({ error: err.message });
    }
  });

  // ── PUT /api/captures/:id ───────────────────────────────────────────────────
  router.put('/:id', (req, res) => {
    try {
      const { traffic_light, needs_transport, telefono } = req.body;
      db.prepare(`
        UPDATE elector_captures
        SET traffic_light = ?, needs_transport = ?, telefono = ?
        WHERE id = ?
      `).run(traffic_light, needs_transport ? 1 : 0, telefono, req.params.id);
      invalidateAllReportsCaches();
      res.json({ success: true });
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  // ── DELETE /api/captures/:id ────────────────────────────────────────────────
  router.delete('/:id', (req, res) => {
    try {
      const capture = db.prepare('SELECT elector_ci FROM elector_captures WHERE id = ?').get(req.params.id) as any;
      if (capture) {
        try { db.prepare("UPDATE electors SET status = 'Pendiente' WHERE ci = ?").run(capture.elector_ci); } catch (e) { /* legacy */ }
        db.prepare('DELETE FROM elector_captures WHERE id = ?').run(req.params.id);
      }
      invalidateAllReportsCaches();
      res.json({ success: true });
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  return router;
}

export function coordinatorsRoutes() {
  const router = Router();

  // DELETE /api/coordinators/:id/captures
  router.delete('/:id/captures', (req, res) => {
    const coordinatorId = req.params.id;
    const userRole = (req.headers['x-user-role'] as string || '').toUpperCase().trim();

    if (!['SUPERUSUARIO', 'SUPER_ADMIN', 'JEFE_CAMPANA'].includes(userRole)) {
      return res.status(403).json({ error: 'Acceso denegado. Rol insuficiente.' });
    }

    try {
      db.transaction(() => {
        const captures = db.prepare('SELECT elector_ci FROM elector_captures WHERE coordinator_id = ?').all(coordinatorId) as any[];
        for (const cap of captures) {
          try { db.prepare("UPDATE electors SET status = 'Pendiente' WHERE ci = ?").run(cap.elector_ci); } catch (e) { /* legacy */ }
        }
        db.prepare('DELETE FROM elector_captures WHERE coordinator_id = ?').run(coordinatorId);
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

  // GET /api/coordinators/:id/history
  router.get('/:id/history', (req, res) => {
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
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  return router;
}

// ── Conflicts helper (used by decide and consent) ───────────────────────────
const checkAndFinalizeConflict = (conflict_id: number, resolver_id: number) => {
  const cc = db.prepare('SELECT * FROM capture_conflicts WHERE id = ?').get(conflict_id) as any;
  if (cc.jefe_decision_id && cc.consent_a === 1 && cc.consent_b === 1) {
    const winnerId = cc.jefe_decision_id;
    const loserId = (cc.capture_id === winnerId) ? cc.capture_id_b : cc.capture_id;
    db.prepare('UPDATE elector_captures SET is_disputed = 0 WHERE id = ?').run(winnerId);
    db.prepare('UPDATE elector_captures SET is_disputed = 1 WHERE id = ?').run(loserId);
    db.prepare("UPDATE capture_conflicts SET status = 'RESOLVED', resolved_by_jefe_id = ?, winner_capture_id = ?, resolved_at = CURRENT_TIMESTAMP WHERE id = ?")
      .run(resolver_id, winnerId, conflict_id);
    console.log(`[CONFLICT] Resolved and finalized conflict ${conflict_id}`);
  }
};

export function conflictsRoutes() {
  const router = Router();

  // ── GET /api/admin/conflicts ────────────────────────────────────────────────
  router.get('/', (req, res) => {
    const list_id = getListId(req);
    try {
      let sql = `
        SELECT
          cc.id as conflict_id, cc.status as conflict_status, cc.conflict_type,
          cc.jefe_decision_id, cc.consent_a, cc.consent_b, cc.list_id_a, cc.list_id_b,
          cc.elector_ci as elector_ci, e.nombre as elector_nombre, e.apellido as elector_apellido,
          ca.id as capture_a_id, ca.traffic_light as tl_a, ca.needs_transport as transport_a,
          ca.timestamp as time_a, ca.lat as lat_a, ca.lng as lng_a,
          ua.nombre as coord_a, ua.photo_url as photo_a, pa.nombre as padrino_a,
          la.list_number as list_a, la.option_number as option_a,
          cb.id as capture_b_id, cb.traffic_light as tl_b, cb.needs_transport as transport_b,
          cb.timestamp as time_b, cb.lat as lat_b, cb.lng as lng_b,
          ub.nombre as coord_b, ub.photo_url as photo_b, pb.nombre as padrino_b,
          lb.list_number as list_b, lb.option_number as option_b
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
      sql += ` ${sec.sql}`;
      params.push(...sec.params);

      const user_id = req.headers['x-user-id'] as string;
      const user = getCachedUserInfo(user_id);
      const role = (user?.role || req.headers['x-user-role'] as string || '').toUpperCase().trim();

      if (role === 'SUBJEFE' && list_id && !isNaN(list_id) && list_id !== 0) {
        sql += " AND (cc.list_id_a = ? OR cc.list_id_b = ?)";
        params.push(list_id, list_id);
      }

      const conflicts = db.prepare(sql).all(...params) as any[];
      res.json(conflicts);
    } catch (err: any) {
      console.error('[CONFLICTS ERROR]', err);
      res.status(500).json({ error: err.message });
    }
  });

  // ── GET /api/admin/conflicts/history ───────────────────────────────────────
  router.get('/history', (req, res) => {
    const district = req.query.district as string;
    const list_id = getListId(req);
    try {
      let sql = `
        SELECT
          cc.id as conflict_id, cc.status as conflict_status, cc.resolved_at,
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

      if (role === 'SUBJEFE' && list_id && !isNaN(list_id) && list_id !== 0) {
        sql += " AND (cc.list_id_a = ? OR cc.list_id_b = ?)";
        params.push(list_id, list_id);
      }
      sql += " ORDER BY cc.resolved_at DESC LIMIT 100";

      res.json(db.prepare(sql).all(...params));
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  // ── POST /api/admin/conflicts/decide ───────────────────────────────────────
  router.post('/decide', (req, res) => {
    const { conflict_id, winner_capture_id } = req.body;
    const user_id = parseInt(req.headers['x-user-id'] as string || '0');
    try {
      db.transaction(() => {
        const conflict = db.prepare('SELECT * FROM capture_conflicts WHERE id = ?').get(conflict_id) as any;
        if (!conflict) throw new Error('Conflicto no encontrado');

        db.prepare("UPDATE capture_conflicts SET jefe_decision_id = ?, status = 'WAITING_CONSENT' WHERE id = ?")
          .run(winner_capture_id, conflict_id);

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
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  // ── POST /api/admin/conflicts/consent ──────────────────────────────────────
  router.post('/consent', (req, res) => {
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
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  return router;
}
