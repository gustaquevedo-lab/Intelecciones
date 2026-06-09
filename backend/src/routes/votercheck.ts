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
      if (role === 'SUPERUSUARIO' || !district) {
        rows = db.prepare(`
          SELECT vc.*, u.nombre as coordinator_nombre
          FROM voter_confirmations vc
          LEFT JOIN users u ON vc.confirmed_by = u.id
          ORDER BY vc.confirmed_at DESC
          LIMIT 500
        `).all();
      } else {
        rows = db.prepare(`
          SELECT vc.*, u.nombre as coordinator_nombre
          FROM voter_confirmations vc
          LEFT JOIN users u ON vc.confirmed_by = u.id
          WHERE UPPER(vc.distrito) = UPPER(?)
          ORDER BY vc.confirmed_at DESC
          LIMIT 500
        `).all(district);
      }
      res.json(rows);
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

  // Compare confirmations vs actual votes (for Día D tab)
  router.get('/compare', (req, res) => {
    const userId = req.headers['x-user-id'] as string;
    const role = getRole(req);
    const userInfo = userId ? getCachedUserInfo(userId) : null;
    const districtParam = getDistrict(req);
    const district = districtParam || userInfo?.distrito;

    try {
      // Get confirmed electors
      const confirmedQuery = district
        ? `SELECT vc.elector_ci, vc.nombre, vc.apellido, vc.local_votacion, vc.mesa, vc.orden, vc.distrito, vc.confirmed_at
           FROM voter_confirmations vc WHERE UPPER(vc.distrito) = UPPER('${district.replace(/'/g, "''")}') ORDER BY vc.confirmed_at DESC`
        : `SELECT vc.elector_ci, vc.nombre, vc.apellido, vc.local_votacion, vc.mesa, vc.orden, vc.distrito, vc.confirmed_at
           FROM voter_confirmations vc ORDER BY vc.confirmed_at DESC LIMIT 2000`;

      const confirmed = db.prepare(confirmedQuery).all() as any[];

      // For each confirmed, check if they actually voted (via tenant_electors or participation_logs)
      const results = confirmed.map((c: any) => {
        // Check participation_logs via orden+mesa+local match
        const voted = db.prepare(`
          SELECT 1 FROM participation_logs
          WHERE orden = ? AND mesa = ? AND UPPER(local_votacion) = UPPER(?)
          LIMIT 1
        `).get(c.orden, c.mesa, c.local_votacion) as any;

        // Also check tenant_electors as backup
        const votedTenant = db.prepare(`
          SELECT status FROM tenant_electors WHERE elector_ci = ? AND status = 'Voto Realizado'
          LIMIT 1
        `).get(c.elector_ci) as any;

        return {
          ...c,
          voted: !!(voted || votedTenant)
        };
      });

      // Summary stats
      const totalConfirmed = results.length;
      const totalVoted = results.filter((r: any) => r.voted).length;
      const confirmedButNotVoted = results.filter((r: any) => !r.voted);
      const pct = totalConfirmed > 0 ? Math.round((totalVoted / totalConfirmed) * 100) : 0;

      res.json({
        summary: { totalConfirmed, totalVoted, confirmedButNotVoted: confirmedButNotVoted.length, pct },
        records: results
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  return router;
}
