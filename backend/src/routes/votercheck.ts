import { Router } from 'express';
import db from '../db';
import { getCachedUserInfo, getDistrict, getRole, requireRole } from './helpers';

export default function voterCheckRoutes() {
  const router = Router();

  // Only COORDINADOR and above can use this module
  router.use(requireRole('SUPERUSUARIO', 'JEFE_CAMPANA', 'PADRINO', 'SUBJEFE', 'COORDINADOR'));

  // Search elector by CI in padrón
  router.get('/elector/:ci', (req, res) => {
    const rawCI = req.params.ci.toString().replace(/\./g, '').replace(/ /g, '').trim();
    const userId = req.headers['x-user-id'] as string;
    const role = getRole(req);
    const userInfo = userId ? getCachedUserInfo(userId) : null;
    const userDistrito = userInfo?.distrito;

    if (!rawCI) return res.status(400).json({ error: 'Cédula requerida' });

    try {
      let elector: any;
      if (role === 'SUPERUSUARIO' || !userDistrito) {
        elector = db.prepare(`
          SELECT ci, nombre, apellido, local_votacion, mesa, orden, distrito
          FROM electors WHERE ci = ?
        `).get(rawCI);
      } else {
        elector = db.prepare(`
          SELECT ci, nombre, apellido, local_votacion, mesa, orden, distrito
          FROM electors WHERE ci = ? AND UPPER(distrito) = UPPER(?)
        `).get(rawCI, userDistrito);
      }

      if (!elector) {
        return res.status(404).json({ error: 'Elector no encontrado en el padrón' });
      }

      // Also check if already confirmed
      const alreadyConfirmed = db.prepare(`
        SELECT confirmed_at FROM voter_confirmations WHERE elector_ci = ?
      `).get(rawCI) as any;

      res.json({ ...elector, already_confirmed: !!alreadyConfirmed, confirmed_at: alreadyConfirmed?.confirmed_at || null });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Confirm elector presence
  router.post('/confirm', (req, res) => {
    const { ci } = req.body;
    const userId = req.headers['x-user-id'] as string;

    if (!ci) return res.status(400).json({ error: 'Cédula requerida' });

    const rawCI = ci.toString().replace(/\./g, '').replace(/ /g, '').trim();

    try {
      // Find elector in padrón
      const elector = db.prepare(`
        SELECT ci, nombre, apellido, local_votacion, mesa, orden, distrito
        FROM electors WHERE ci = ?
      `).get(rawCI) as any;

      if (!elector) {
        return res.status(404).json({ error: 'Elector no encontrado en el padrón' });
      }

      // Insert confirmation (upsert — one confirmation per elector)
      db.prepare(`
        INSERT INTO voter_confirmations
          (elector_ci, nombre, apellido, local_votacion, mesa, orden, distrito, confirmed_by, confirmed_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
        ON CONFLICT(elector_ci) DO UPDATE SET
          confirmed_at = datetime('now'),
          confirmed_by = excluded.confirmed_by
      `).run(
        elector.ci,
        elector.nombre,
        elector.apellido,
        elector.local_votacion,
        elector.mesa,
        elector.orden,
        elector.distrito,
        userId || null
      );

      res.json({ success: true, elector });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Get confirmation history (for coordinator's own district)
  router.get('/history', (req, res) => {
    const userId = req.headers['x-user-id'] as string;
    const role = getRole(req);
    const userInfo = userId ? getCachedUserInfo(userId) : null;
    const userDistrito = userInfo?.distrito;
    const districtParam = getDistrict(req);
    const district = districtParam || userDistrito;

    try {
      let rows: any[];
      let total: number;
      if (role === 'SUPERUSUARIO' || !district) {
        total = (db.prepare(`SELECT COUNT(*) as c FROM voter_confirmations`).get() as any).c;
        rows = db.prepare(`
          SELECT vc.*, u.nombre as coordinator_nombre
          FROM voter_confirmations vc
          LEFT JOIN users u ON vc.confirmed_by = u.id
          ORDER BY vc.confirmed_at DESC
          LIMIT 5000
        `).all();
      } else {
        total = (db.prepare(`SELECT COUNT(*) as c FROM voter_confirmations WHERE UPPER(distrito) = UPPER(?)`).get(district) as any).c;
        rows = db.prepare(`
          SELECT vc.*, u.nombre as coordinator_nombre
          FROM voter_confirmations vc
          LEFT JOIN users u ON vc.confirmed_by = u.id
          WHERE UPPER(vc.distrito) = UPPER(?)
          ORDER BY vc.confirmed_at DESC
          LIMIT 5000
        `).all(district);
      }
      res.json({ rows, total });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Delete a confirmation (undo)
  router.delete('/:ci', (req, res) => {
    const rawCI = req.params.ci.toString().replace(/\./g, '').trim();
    try {
      db.prepare('DELETE FROM voter_confirmations WHERE elector_ci = ?').run(rawCI);
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Compare captured electors vs actual votes — source: elector_captures (not voter_confirmations)
  // Shows which coordinator captured each elector and whether that elector voted.
  router.get('/compare', (req, res) => {
    const userId = req.headers['x-user-id'] as string;
    const userInfo = userId ? getCachedUserInfo(userId) : null;
    const districtParam = getDistrict(req);
    const district = districtParam || userInfo?.distrito;

    try {
      const districtFilter = district ? `AND UPPER(e.distrito) = UPPER(?)` : '';
      const params: any[] = district ? [district] : [];

      // One row per elector_ci (latest non-disputed capture).
      // Joins: elector_captures → electors (mesa/orden/local) → coordinator → padrino
      const captured = db.prepare(`
        SELECT
          ec.elector_ci,
          e.nombre,
          e.apellido,
          e.local_votacion,
          e.mesa,
          e.orden,
          e.distrito,
          ec.telefono         AS elector_telefono,
          ec.traffic_light,
          ec.timestamp        AS captured_at,
          -- Coordinator who registered this elector
          u_coord.id          AS coord_id,
          u_coord.nombre      AS coord_nombre,
          u_coord.telefono    AS coord_telefono,
          u_coord.role        AS coord_role,
          -- Padrino = coordinator's parent
          u_pad.nombre        AS padrino_nombre,
          u_pad.telefono      AS padrino_telefono,
          u_pad.role          AS padrino_role
        FROM elector_captures ec
        INNER JOIN electors e ON ec.elector_ci = e.ci
        LEFT JOIN users u_coord ON ec.coordinator_id = u_coord.id
        LEFT JOIN users u_pad   ON u_coord.parent_id = u_pad.id
        WHERE ec.is_disputed = 0
          ${districtFilter}
        GROUP BY ec.elector_ci
        ORDER BY ec.timestamp DESC
        LIMIT 5000
      `).all(...params) as any[];

      // Check voted status for each captured elector
      const results = captured.map((c: any) => {
        const votedLog = db.prepare(`
          SELECT 1 FROM participation_logs
          WHERE orden = ? AND mesa = ? AND UPPER(local_votacion) = UPPER(?)
          LIMIT 1
        `).get(c.orden, c.mesa, c.local_votacion) as any;

        const votedTenant = db.prepare(`
          SELECT 1 FROM tenant_electors WHERE elector_ci = ? AND status = 'Voto Realizado'
          LIMIT 1
        `).get(c.elector_ci) as any;

        const voted = !!(votedLog || votedTenant);
        const semaforo = voted ? 'green' : 'red';

        return { ...c, voted, semaforo };
      });

      const totalCaptured = results.length;
      const totalVoted = results.filter((r: any) => r.voted).length;
      const pct = totalCaptured > 0 ? Math.round((totalVoted / totalCaptured) * 100) : 0;

      res.json({
        summary: {
          totalConfirmed: totalCaptured,   // kept same key for compat
          totalVoted,
          confirmedButNotVoted: totalCaptured - totalVoted,
          pct
        },
        records: results
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  return router;
}
