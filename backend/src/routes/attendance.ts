import { Router } from 'express';
import db from '../db';
import { getCachedUserInfo, getRole, requireRole } from './helpers';
import { logAction } from '../server';
import { normalizePhone } from '../utils/phone';

export default function attendanceRoutes() {
  const router = Router();

  // Search elector by CI filtered by registerer's district
  router.get('/search/:ci', (req, res) => {
    const userId = req.headers['x-user-id'] as string;
    const role = getRole(req);
    const userInfo = getCachedUserInfo(userId);
    const userDistrito = userInfo?.distrito;
    const rawCI = req.params.ci;
    
    if (!rawCI) {
      return res.status(400).json({ error: 'Cédula requerida.' });
    }

    const cleanCI = rawCI.replace(/\./g, '').replace(/ /g, '').trim();

    try {
      let elector;
      if (role === 'SUPERUSUARIO' || !userDistrito) {
        elector = db.prepare(`
          SELECT ci, nombre, apellido, local_votacion, mesa, orden, distrito 
          FROM electors 
          WHERE ci = ?
        `).get(cleanCI);
      } else {
        elector = db.prepare(`
          SELECT ci, nombre, apellido, local_votacion, mesa, orden, distrito 
          FROM electors 
          WHERE ci = ? AND UPPER(distrito) = UPPER(?)
        `).get(cleanCI, userDistrito);
      }

      if (elector) {
        res.json(elector);
      } else {
        res.status(404).json({ error: 'Elector no encontrado en el padrón de este distrito.' });
      }
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Register attendance
  router.post('/register', (req, res) => {
    const { ci, nombre, apellido, distrito, cargo, telefono, photo_url } = req.body;
    const userId = req.headers['x-user-id'] as string;

    if (!ci || !nombre || !distrito || !cargo || !telefono) {
      return res.status(400).json({ error: 'Faltan campos obligatorios: Cédula, Nombre, Distrito, Cargo y Teléfono.' });
    }

    const cleanCI = ci.toString().replace(/\./g, '').replace(/ /g, '').trim();
    const cleanPhone = normalizePhone(telefono);

    try {
      const result = db.prepare(`
        INSERT OR REPLACE INTO attendance (ci, nombre, apellido, distrito, cargo, telefono, photo_url, registered_by)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(cleanCI, nombre, apellido || '', distrito, cargo, cleanPhone, photo_url || null, userId || null);

      logAction(userId ? Number(userId) : null, 'REGISTER_ATTENDANCE', 'ATTENDANCE', cleanCI, `Registered attendance for ${nombre} as ${cargo}`);
      res.json({ success: true, id: result.lastInsertRowid });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Retrieve attendance list
  router.get('/list', (req, res) => {
    const userId = req.headers['x-user-id'] as string;
    const role = getRole(req);
    const userInfo = getCachedUserInfo(userId);
    const userDistrito = userInfo?.distrito;

    try {
      let list;
      if (role === 'SUPERUSUARIO' || !userDistrito) {
        list = db.prepare(`
          SELECT a.*, u.nombre as registered_by_name 
          FROM attendance a 
          LEFT JOIN users u ON a.registered_by = u.id 
          ORDER BY a.timestamp DESC
        `).all();
      } else {
        list = db.prepare(`
          SELECT a.*, u.nombre as registered_by_name 
          FROM attendance a 
          LEFT JOIN users u ON a.registered_by = u.id 
          WHERE UPPER(a.distrito) = UPPER(?) 
          ORDER BY a.timestamp DESC
        `).all(userDistrito);
      }
      res.json(list);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Bulk create users for system use
  router.post('/assign-massively', requireRole('SUPERUSUARIO'), (req, res) => {
    const { cis, role: targetRole } = req.body;
    const superUserId = req.headers['x-user-id'] as string;

    if (!cis || !Array.isArray(cis) || cis.length === 0) {
      return res.status(400).json({ error: 'Lista de cédulas vacía o inválida.' });
    }

    if (!targetRole) {
      return res.status(400).json({ error: 'Rol de destino requerido.' });
    }

    const results = {
      created: 0,
      skipped: 0,
      errors: [] as string[]
    };

    try {
      db.transaction(() => {
        for (const ci of cis) {
          const cleanCI = ci.toString().replace(/\./g, '').replace(/ /g, '').trim();

          // Check if user already exists
          const existingUser = db.prepare('SELECT id FROM users WHERE ci = ? OR username = ?').get(cleanCI, cleanCI);
          if (existingUser) {
            results.skipped++;
            continue;
          }

          // Lookup details in electors and/or attendance
          const elector = db.prepare('SELECT nombre, apellido, local_votacion, mesa, distrito FROM electors WHERE ci = ?').get(cleanCI) as any;
          const attendanceRec = db.prepare('SELECT nombre, apellido, distrito, telefono, photo_url FROM attendance WHERE ci = ?').get(cleanCI) as any;

          if (!elector && !attendanceRec) {
            results.errors.push(`C.I. ${cleanCI} no encontrado en electores ni asistencia.`);
            continue;
          }

          const nombre = elector ? `${elector.nombre} ${elector.apellido || ''}`.trim() : attendanceRec.nombre;
          const distrito = elector ? elector.distrito : attendanceRec.distrito;
          const local = elector ? elector.local_votacion : null;
          const mesa = elector ? elector.mesa : null;
          const telefono = attendanceRec ? attendanceRec.telefono : null;
          const photoUrl = attendanceRec ? attendanceRec.photo_url : null;

          // Create the user
          db.prepare(`
            INSERT INTO users (username, password, role, nombre, ci, distrito, assigned_local, assigned_mesa, needs_password_change, telefono, photo_url, parent_id)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?)
          `).run(
            cleanCI,      // username
            cleanCI,      // password
            targetRole,   // system role
            nombre,
            cleanCI,
            distrito,
            local,
            mesa,
            telefono,
            photoUrl,
            superUserId || null
          );

          results.created++;
        }
      })();

      logAction(superUserId ? Number(superUserId) : null, 'BULK_ASSIGN_USERS', 'USERS', null, `Bulk created ${results.created} users with role ${targetRole}`);
      res.json({ success: true, ...results });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  return router;
}
