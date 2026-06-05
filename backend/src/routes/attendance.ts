import { Router } from 'express';
import db from '../db';
import { getCachedUserInfo, getRole, requireRole } from './helpers';
import { logAction } from '../server';
import { normalizePhone } from '../utils/phone';

export default function attendanceRoutes() {
  const router = Router();

  // Enforce access control: only SUPERUSUARIO, JEFE_CAMPANA, and PADRINO can access this module
  router.use(requireRole('SUPERUSUARIO', 'JEFE_CAMPANA', 'PADRINO'));

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
    const { ci, nombre, apellido, distrito, cargo, telefono, photo_url, attended } = req.body;
    const userId = req.headers['x-user-id'] as string;

    if (!ci || !nombre || !distrito || !cargo || !telefono) {
      return res.status(400).json({ error: 'Faltan campos obligatorios: Cédula, Nombre, Distrito, Cargo y Teléfono.' });
    }

    const cleanCI = ci.toString().replace(/\./g, '').replace(/ /g, '').trim();
    const cleanPhone = normalizePhone(telefono);
    const finalAttended = attended !== undefined ? Number(attended) : 1;

    try {
      const result = db.prepare(`
        INSERT INTO attendance (ci, nombre, apellido, distrito, cargo, telefono, photo_url, registered_by, attended)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(ci) DO UPDATE SET
          nombre = excluded.nombre,
          apellido = COALESCE(excluded.apellido, apellido),
          distrito = excluded.distrito,
          cargo = excluded.cargo,
          telefono = excluded.telefono,
          photo_url = COALESCE(excluded.photo_url, photo_url),
          registered_by = COALESCE(excluded.registered_by, registered_by),
          attended = CASE WHEN attended = 1 THEN 1 ELSE excluded.attended END
      `).run(cleanCI, nombre, apellido || '', distrito, cargo, cleanPhone, photo_url || null, userId || null, finalAttended);

      logAction(userId ? Number(userId) : null, 'REGISTER_ATTENDANCE', 'ATTENDANCE', cleanCI, `Registered/Updated attendance status ${finalAttended} for ${nombre} as ${cargo}`);
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

  // Bulk create users for system use (enhanced with custom user attributes and dynamic role mapping)
  router.post('/assign-massively', requireRole('SUPERUSUARIO'), (req, res) => {
    const { cis, role: targetRole, list_id, parent_id, distrito } = req.body;
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
          const attendanceRec = db.prepare('SELECT nombre, apellido, distrito, cargo, telefono, photo_url FROM attendance WHERE ci = ?').get(cleanCI) as any;

          if (!elector && !attendanceRec) {
            results.errors.push(`C.I. ${cleanCI} no encontrado en electores ni asistencia.`);
            continue;
          }

          // Map dynamic role if set to ASISTENTE_DEFAULT, else fallback to selected role
          let finalRole = targetRole;
          if (targetRole === 'ASISTENTE_DEFAULT' && attendanceRec?.cargo) {
            finalRole = attendanceRec.cargo; // APODERADO or MIEMBRO_DE_MESA
          }

          const nombre = elector ? `${elector.nombre} ${elector.apellido || ''}`.trim() : attendanceRec.nombre;
          const finalDistrito = distrito || (elector ? elector.distrito : attendanceRec.distrito);
          const local = elector ? elector.local_votacion : null;
          const mesa = elector ? elector.mesa : null;
          const telefono = attendanceRec ? attendanceRec.telefono : null;
          const photoUrl = attendanceRec ? attendanceRec.photo_url : null;

          // Create the user
          db.prepare(`
            INSERT INTO users (username, password, role, nombre, ci, distrito, assigned_local, assigned_mesa, needs_password_change, telefono, photo_url, parent_id, assigned_list_id)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?)
          `).run(
            cleanCI,      // username
            cleanCI,      // password
            finalRole,    // system role
            nombre,
            cleanCI,
            finalDistrito,
            local,
            mesa,
            telefono,
            photoUrl,
            parent_id || superUserId || null,
            list_id || null
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

  // Edit attendance record
  router.put('/:id', (req, res) => {
    const { id } = req.params;
    const { cargo, telefono, photo_url, attended } = req.body;
    const userId = req.headers['x-user-id'] as string;

    if (!cargo || !telefono) {
      return res.status(400).json({ error: 'Cargo y teléfono son obligatorios.' });
    }

    const cleanPhone = normalizePhone(telefono);

    try {
      db.prepare(`
        UPDATE attendance 
        SET cargo = ?, telefono = ?, photo_url = COALESCE(?, photo_url), attended = COALESCE(?, attended)
        WHERE id = ?
      `).run(cargo, cleanPhone, photo_url || null, attended !== undefined ? Number(attended) : null, id);

      logAction(userId ? Number(userId) : null, 'UPDATE_ATTENDANCE', 'ATTENDANCE', id, `Updated attendance record ID ${id} with cargo ${cargo}, phone ${cleanPhone}, attended ${attended}`);
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Delete attendance record
  router.delete('/:id', (req, res) => {
    const { id } = req.params;
    const userId = req.headers['x-user-id'] as string;

    try {
      db.prepare('DELETE FROM attendance WHERE id = ?').run(id);
      logAction(userId ? Number(userId) : null, 'DELETE_ATTENDANCE', 'ATTENDANCE', id, `Deleted attendance record ID ${id}`);
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Wipe all attendance records (restricted to SUPERUSUARIO)
  router.post('/wipe', requireRole('SUPERUSUARIO'), (req, res) => {
    const userId = req.headers['x-user-id'] as string;
    try {
      db.prepare('DELETE FROM attendance').run();
      logAction(userId ? Number(userId) : null, 'WIPE_ATTENDANCE', 'ATTENDANCE', null, 'Wiped all attendance data');
      res.json({ success: true, message: 'Todos los datos de asistencia han sido eliminados.' });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // GET /recover-photos — recovers lost photos from uploads directory using audit logs matching
  router.get('/recover-photos', requireRole('SUPERUSUARIO', 'JEFE_CAMPANA'), (req, res) => {
    const fs = require('fs');
    const path = require('path');
    
    const dbDir = process.env.NODE_ENV === 'production' ? '/app/data' : process.cwd();
    let uploadDir = process.env.NODE_ENV === 'production' ? '/app/data/uploads' : path.join(dbDir, 'uploads');
    
    if (process.env.NODE_ENV !== 'production') {
      const rootBackendPath = path.join(process.cwd(), 'backend');
      if (fs.existsSync(rootBackendPath) && fs.statSync(rootBackendPath).isDirectory()) {
        uploadDir = path.join(rootBackendPath, 'uploads');
      }
    }

    if (!fs.existsSync(uploadDir)) {
      return res.status(404).json({ error: `Directorio de uploads no encontrado en: ${uploadDir}` });
    }

    try {
      const logs = db.prepare(`
        SELECT entity_id as ci, timestamp 
        FROM audit_logs 
        WHERE action = 'REGISTER_ATTENDANCE'
        ORDER BY timestamp ASC
      `).all() as any[];

      if (logs.length === 0) {
        return res.json({ success: true, message: 'No hay logs de registro de asistencia en el historial de auditoría.', recovered: 0 });
      }

      const parsedLogs = logs.map(l => {
        const dateStr = l.timestamp.includes('Z') ? l.timestamp : `${l.timestamp.replace(' ', 'T')}Z`;
        return {
          ci: l.ci,
          time: new Date(dateStr).getTime()
        };
      }).filter(l => !isNaN(l.time));

      const files = fs.readdirSync(uploadDir);
      const photoFiles: { filename: string; time: number }[] = [];

      for (const file of files) {
        const match = file.match(/^(\d+)-/);
        if (match) {
          const fileMs = parseInt(match[1]);
          photoFiles.push({
            filename: file,
            time: fileMs
          });
        }
      }

      if (photoFiles.length === 0) {
        return res.json({ success: true, message: 'No se encontraron fotos con timestamp en el nombre en la carpeta uploads.', recovered: 0 });
      }

      photoFiles.sort((a, b) => a.time - b.time);
      parsedLogs.sort((a, b) => a.time - b.time);

      let recoveredCount = 0;
      const updates: { ci: string; photo_url: string }[] = [];

      const host = req.get('host') || '';
      let protocol = (req.headers['x-forwarded-proto'] as string) || req.protocol;
      if (process.env.NODE_ENV === 'production' || host.includes('railway.app') || host.includes('vercel.app')) {
        protocol = 'https';
      }
      const baseUrl = process.env.APP_URL ? process.env.APP_URL.replace(/\/$/, '') : `${protocol}://${host}`;

      for (const photo of photoFiles) {
        const matchedLog = parsedLogs.find(log => log.time >= photo.time && log.time <= photo.time + 60000);
        if (matchedLog) {
          const photoUrl = `${baseUrl}/uploads/${photo.filename}`;
          updates.push({
            ci: matchedLog.ci,
            photo_url: photoUrl
          });
        }
      }

      db.transaction(() => {
        for (const update of updates) {
          db.prepare(`
            UPDATE attendance 
            SET photo_url = ? 
            WHERE ci = ? AND (photo_url IS NULL OR photo_url = '')
          `).run(update.photo_url, update.ci);
          recoveredCount++;
        }
      })();

      res.json({
        success: true,
        message: `Búsqueda y recuperación completada.`,
        analyzed_logs: logs.length,
        analyzed_files: photoFiles.length,
        matches_found: updates.length,
        db_records_restored: recoveredCount
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  return router;
}
