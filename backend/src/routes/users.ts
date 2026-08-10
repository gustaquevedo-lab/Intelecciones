import { Router } from 'express';
import db from '../db';
import { getCachedUserInfo, getRole, getSecurityFilter, getListId, clearUserCache, sanitizeElectorData } from './helpers';
import { trackEvent, invalidateAllReportsCaches, logAction, adminLimiter } from '../server';
import { normalizePhone } from '../utils/phone';

const canModifyUser = (requesterId: string | number | undefined, requesterRole: string, targetUserId: string | number): boolean => {
  const reqRole = requesterRole.toUpperCase().trim();
  if (reqRole === 'SUPERUSUARIO' || reqRole === 'SUPER_ADMIN') return true;
  if (!requesterId) return false;
  const reqId = Number(requesterId);
  const targetId = Number(targetUserId);
  if (reqId === targetId) return true;
  try {
    const target = db.prepare('SELECT role, parent_id, assigned_campaign_id FROM users WHERE id = ?').get(targetId) as any;
    if (!target) return false;
    const requesterInfo = getCachedUserInfo(String(reqId));
    if (target.assigned_campaign_id && requesterInfo?.campaign_id && target.assigned_campaign_id !== requesterInfo.campaign_id) return false;
    if (target.parent_id === reqId) return true;
    if (reqRole === 'SUBJEFE' || reqRole === 'JEFE_CAMPANA' || reqRole === 'CANDIDATO') {
      if (target.role !== 'SUPERUSUARIO' && target.role !== 'JEFE_CAMPANA' && target.role !== 'CANDIDATO') return true;
    }
    return false;
  } catch (err) {
    console.error('Error in canModifyUser check:', err);
    return false;
  }
};

const isAllowedParent = (requesterId: string | number, requesterRole: string, parentId: string | number | null, createdRole: string): boolean => {
  const reqRole = requesterRole.toUpperCase().trim();
  if (reqRole === 'SUPERUSUARIO' || reqRole === 'SUPER_ADMIN') return true;
  const reqId = Number(requesterId);
  const pId = parentId ? Number(parentId) : null;
  if (reqRole === 'PADRINO') return pId === reqId;
  if (reqRole === 'SUBJEFE') {
    if (createdRole === 'PADRINO') return pId === reqId;
    if (createdRole === 'COORDINADOR' || createdRole === 'MIEMBRO_DE_MESA') {
      if (pId === reqId) return true;
      if (pId) {
        const parent = db.prepare('SELECT role, parent_id FROM users WHERE id = ?').get(pId) as any;
        return parent && parent.role === 'PADRINO' && parent.parent_id === reqId;
      }
    }
  }
  if (reqRole === 'JEFE_CAMPANA' || reqRole === 'CANDIDATO') {
    if (createdRole === 'SUBJEFE' || createdRole === 'PADRINO') return pId === reqId;
    if (createdRole === 'COORDINADOR' || createdRole === 'MIEMBRO_DE_MESA') {
      if (pId === reqId) return true;
      if (pId) {
        const parent = db.prepare('SELECT role, parent_id FROM users WHERE id = ?').get(pId) as any;
        return parent && parent.role === 'PADRINO' && parent.parent_id === reqId;
      }
    }
  }
  return false;
};

export default function usersRoutes() {
  const router = Router();
router.post('/', adminLimiter, (req, res) => {
  const requesterRole = (req.headers['x-user-role'] as string || '').toUpperCase().trim();
  const requesterId   = req.headers['x-user-id'] as string;

  const { username, password, role: rawRole, assigned_list_id, list_id, assigned_campaign_id, campaign_id, nombre, photo_url, parent_id, telefono, ci } = req.body;
  const role = (rawRole || '').toUpperCase().trim();

  if (!username || !password || !role || !nombre) {
    return res.status(400).json({ error: 'Faltan campos obligatorios: Usuario, Contraseña, Rol y Nombre son requeridos.' });
  }

  if (username.toString().trim().length < 3) return res.status(400).json({ error: 'El usuario debe tener al menos 3 caracteres' });
  if (password.toString().trim().length < 6) return res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres' });

  // ── Authorization: who can create whom ──────────────────────────────────
  const ALLOWED_ROLES_TO_CREATE: Record<string, string[]> = {
    SUPERUSUARIO: ['SUPERUSUARIO','JEFE_CAMPANA','PADRINO','SUBJEFE','COORDINADOR','MIEMBRO_DE_MESA','CANDIDATO','MIEMBRO_MESA','APODERADO','VEEDOR'],
    SUPER_ADMIN:  ['SUPERUSUARIO','JEFE_CAMPANA','PADRINO','SUBJEFE','COORDINADOR','MIEMBRO_DE_MESA','CANDIDATO','MIEMBRO_MESA','APODERADO','VEEDOR'],
    JEFE_CAMPANA: ['PADRINO','SUBJEFE','COORDINADOR','MIEMBRO_DE_MESA','MIEMBRO_MESA','APODERADO','VEEDOR'],
    PADRINO:      ['SUBJEFE','COORDINADOR','MIEMBRO_DE_MESA','MIEMBRO_MESA','APODERADO','VEEDOR'],
    SUBJEFE:      ['PADRINO','COORDINADOR','MIEMBRO_DE_MESA','MIEMBRO_MESA','APODERADO','VEEDOR'],
  };
  const allowed = ALLOWED_ROLES_TO_CREATE[requesterRole] || [];
  if (!allowed.includes(role.toUpperCase())) {
    return res.status(403).json({ error: `Tu rol (${requesterRole}) no puede crear usuarios con el rol ${role}.` });
  }

  // JEFE_CAMPANA/PADRINO/SUBJEFE: force campaign_id to their own, prevent cross-tenant creation
  let forcedCampaignId: number | null = null;
  let forcedListId: number | null = null;
  if (requesterRole !== 'SUPERUSUARIO' && requesterId) {
    const requesterInfo = getCachedUserInfo(requesterId);
    if (!requesterInfo?.campaign_id) {
      return res.status(403).json({ error: 'No tienes una campaña asignada. Contacta al administrador.' });
    }
    forcedCampaignId = requesterInfo.campaign_id;
    forcedListId = requesterInfo.assigned_list_id;
    const bodyAssigned = assigned_campaign_id || campaign_id;
    if (bodyAssigned && parseInt(bodyAssigned) !== forcedCampaignId) {
      return res.status(403).json({ error: 'No puedes crear usuarios en otra campaña.' });
    }
  }

  // Auto-assign and validate parent_id based on creator
  let finalParentId = parent_id ? Number(parent_id) : null;
  if (requesterRole !== 'SUPERUSUARIO' && requesterId) {
    const reqId = Number(requesterId);
    if (!finalParentId) {
      if (requesterRole === 'PADRINO') {
        finalParentId = reqId;
      } else if (requesterRole === 'SUBJEFE' && role === 'PADRINO') {
        finalParentId = reqId;
      } else if ((requesterRole === 'JEFE_CAMPANA' || requesterRole === 'CANDIDATO') && (role === 'SUBJEFE' || role === 'PADRINO')) {
        finalParentId = reqId;
      }
    }

    if (!isAllowedParent(reqId, requesterRole, finalParentId, role)) {
      return res.status(403).json({ error: 'No tienes permisos para asignar el superior/padre indicado para este usuario.' });
    }
  }

  // Inherit list and campaign if not provided
  const inputListId = assigned_list_id || list_id;
  let finalAssignedListId = (inputListId !== undefined && inputListId !== null && inputListId !== '') ? Number(inputListId) : null;
  
  if (!finalAssignedListId) {
    if (forcedListId) {
      finalAssignedListId = forcedListId;
    } else if (requesterId) {
      const requesterInfo = getCachedUserInfo(requesterId);
      if (requesterInfo?.assigned_list_id) {
        finalAssignedListId = requesterInfo.assigned_list_id;
      }
    }
    if (!finalAssignedListId && finalParentId) {
      const parentInfo = db.prepare('SELECT assigned_list_id FROM users WHERE id = ?').get(finalParentId) as any;
      if (parentInfo?.assigned_list_id) {
        finalAssignedListId = parentInfo.assigned_list_id;
      }
    }
  }

  let finalCampaignId = (assigned_campaign_id || campaign_id) ? Number(assigned_campaign_id || campaign_id) : null;
  if (forcedCampaignId) {
    finalCampaignId = forcedCampaignId;
  }
  if (!finalCampaignId) {
    if (requesterId) {
      const requesterInfo = getCachedUserInfo(requesterId);
      if (requesterInfo?.campaign_id) {
        finalCampaignId = requesterInfo.campaign_id;
      }
    }
    if (!finalCampaignId && finalParentId) {
      const parentInfo = db.prepare('SELECT assigned_campaign_id FROM users WHERE id = ?').get(finalParentId) as any;
      if (parentInfo?.assigned_campaign_id) {
        finalCampaignId = parentInfo.assigned_campaign_id;
      }
    }
    if (!finalCampaignId && finalAssignedListId) {
      const listInfo = db.prepare('SELECT campaign_id FROM lists WHERE id = ?').get(finalAssignedListId) as any;
      if (listInfo?.campaign_id) {
        finalCampaignId = listInfo.campaign_id;
      }
    }
  }

  // If list is still not assigned, fall back to the first list of the campaign
  if (!finalAssignedListId && finalCampaignId) {
    const firstList = db.prepare('SELECT id FROM lists WHERE campaign_id = ? LIMIT 1').get(finalCampaignId) as any;
    if (firstList) {
      finalAssignedListId = firstList.id;
    }
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

    let distrito = req.body.distrito;
    if (!distrito) {
      if (finalAssignedListId) {
        const origin = db.prepare('SELECT ciudad as distrito FROM lists WHERE id = ?').get(finalAssignedListId) as any;
        distrito = origin?.distrito;
      }
      if (!distrito && finalCampaignId) {
        const origin = db.prepare('SELECT distrito FROM campaigns WHERE id = ?').get(finalCampaignId) as any;
        distrito = origin?.distrito;
      }
      if (!distrito && requesterId) {
        const requesterInfo = getCachedUserInfo(requesterId);
        distrito = requesterInfo?.distrito;
      }
      if (!distrito && finalParentId) {
        const parentInfo = db.prepare('SELECT distrito FROM users WHERE id = ?').get(finalParentId) as any;
        distrito = parentInfo?.distrito;
      }
    }

    const result = db.prepare(`
      INSERT INTO users (username, password, role, assigned_list_id, assigned_campaign_id, assigned_local, assigned_mesa, nombre, photo_url, parent_id, telefono, ci, needs_password_change, distrito)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)
    `).run(
      finalUsername,
      finalPassword,
      role,
      finalAssignedListId,
      finalCampaignId,
      req.body.assigned_local || null,
      req.body.assigned_mesa || null,
      nombre,
      photo_url || null,
      finalParentId,
      telefono || null,
      cleanCI,
      distrito || null
    );
    
    logAction(1, 'CREATE', 'USER', Number(result.lastInsertRowid), `Created user ${finalUsername} with role ${role}`);
    invalidateAllReportsCaches();
    res.json({ id: Number(result.lastInsertRowid), success: true });
  } catch (err: any) {
    console.error("Error creating user:", err);
    res.status(500).json({ error: err.message.includes('UNIQUE constraint failed') ? 'El nombre de usuario o C.I. ya existe.' : err.message });
  }
});

router.get('/', (req, res) => {
  const requesterId = req.headers['x-user-id'] as string;
  const role = getRole(req);

  try {
    let limitStr = '';
    let offsetStr = '';
    const limit = parseInt(req.query.limit as string);
    const offset = parseInt(req.query.offset as string);
    if (!isNaN(limit)) {
      limitStr = ` LIMIT ${limit}`;
      if (!isNaN(offset)) {
         offsetStr = ` OFFSET ${offset}`;
      }
    } else {
      // Default safety limit for massive tables
      limitStr = ` LIMIT 1500`;
    }

    // Optimization: If parent_id is requested and requester is authorized, query directly without slow OR EXISTS security filter
    if (req.query.parent_id) {
      const parentId = String(req.query.parent_id);
      let isAuthorized = false;

      if (parentId === requesterId) {
        isAuthorized = true;
      } else if (role === 'SUPERUSUARIO' || role === 'SUPER_ADMIN') {
        isAuthorized = true;
      } else if (role === 'JEFE_CAMPANA' || role === 'SUBJEFE') {
        const requesterInfo = getCachedUserInfo(requesterId);
        const targetParentInfo = getCachedUserInfo(parentId);
        if (requesterInfo && targetParentInfo) {
          const campaignMatch = !requesterInfo.campaign_id || !targetParentInfo.campaign_id || requesterInfo.campaign_id === targetParentInfo.campaign_id;
          const districtMatch = !requesterInfo.distrito || !targetParentInfo.distrito || requesterInfo.distrito.toUpperCase().trim() === targetParentInfo.distrito.toUpperCase().trim();
          if (campaignMatch && districtMatch) {
            isAuthorized = true;
          }
        }
      }

      if (isAuthorized) {
        const query = `
          SELECT 
            u.id, u.username, u.role, u.assigned_list_id, u.assigned_campaign_id,
            u.assigned_local, u.assigned_mesa, u.nombre, NULL as photo_url,
            u.needs_password_change, u.parent_id, u.telefono, u.distrito, u.ci, u.status, u.enabled_modules, 
            l.list_number, 
            l.type as list_type, 
            COALESCE(c1.id, c2.id) as effective_campaign_id,
            COALESCE(c1.name, c2.name) as campaign_name,
            p.nombre as parent_name
          FROM users u
          LEFT JOIN lists l ON u.assigned_list_id = l.id
          LEFT JOIN campaigns c1 ON l.campaign_id = c1.id
          LEFT JOIN campaigns c2 ON u.assigned_campaign_id = c2.id
          LEFT JOIN users p ON u.parent_id = p.id
          WHERE u.parent_id = ?
        `;
        const users = db.prepare(query + limitStr + offsetStr).all(parentId);
        console.log(`[ADMIN] Sirviendo ${users.length} usuarios por parent_id (bypass filtro de distrito).`);
        return res.json(users);
      }
    }

    // Fallback: Standard query with sec.sql filter
    const sec = getSecurityFilter(req, 'u');
    const params = sec.params || [];
    let query = `
      SELECT 
        u.id, u.username, u.role, u.assigned_list_id, u.assigned_campaign_id,
        u.assigned_local, u.assigned_mesa, u.nombre, NULL as photo_url,
        u.needs_password_change, u.parent_id, u.telefono, u.distrito, u.ci, u.status, u.enabled_modules, 
        l.list_number, 
        l.type as list_type, 
        COALESCE(c1.id, c2.id) as effective_campaign_id,
        COALESCE(c1.name, c2.name) as campaign_name,
        p.nombre as parent_name
      FROM users u
      LEFT JOIN lists l ON u.assigned_list_id = l.id
      LEFT JOIN campaigns c1 ON l.campaign_id = c1.id
      LEFT JOIN campaigns c2 ON u.assigned_campaign_id = c2.id
      LEFT JOIN users p ON u.parent_id = p.id
      WHERE 1=1 ${sec.sql}
    `;
    
    let users;
    if (req.query.parent_id) {
      users = db.prepare(query + ' AND u.parent_id = ?' + limitStr + offsetStr).all(...params, req.query.parent_id);
    } else {
      users = db.prepare(query + limitStr + offsetStr).all(...params);
    }
    
    console.log(`[ADMIN] Sirviendo ${users.length} usuarios.`);
    res.json(users);
  } catch (err: any) {
    console.error('[ADMIN ERROR] Fallo al listar usuarios:', err);
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id', (req, res) => {
  const requesterRole = (req.headers['x-user-role'] as string || '').toUpperCase().trim();
  const requesterId   = req.headers['x-user-id'] as string;
  const userId = req.params.id;

  try {
    const userToDelete = db.prepare('SELECT username FROM users WHERE id = ?').get(userId) as any;
    if (userToDelete?.username === 'admin') {
      return res.status(403).json({ error: 'No se puede eliminar al administrador maestro (admin).' });
    }

    const user = db.prepare('SELECT id, role, parent_id FROM users WHERE id = ?').get(userId) as any;
    if (!user) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    if (requesterRole !== 'SUPERUSUARIO' && requesterId) {
      if (!canModifyUser(requesterId, requesterRole, userId)) {
        return res.status(403).json({ error: 'No tienes permisos para eliminar este usuario.' });
      }
      
      if (user.role === 'PADRINO') {
        if (!['JEFE_CAMPANA', 'SUBJEFE', 'CANDIDATO'].includes(requesterRole)) {
          return res.status(403).json({ error: 'Solo Jefes y Subjefes de campaña pueden eliminar Padrinos.' });
        }
      }
    }

    const capturesAction = req.query.action as string;

    const transaction = db.transaction(() => {
      db.prepare('PRAGMA foreign_keys = OFF').run();
      
      // 1. Handle elector_captures based on action
      if (capturesAction === 'delete') {
        db.prepare('DELETE FROM capture_conflicts WHERE capture_id IN (SELECT id FROM elector_captures WHERE coordinator_id = ?) OR capture_id_b IN (SELECT id FROM elector_captures WHERE coordinator_id = ?)').run(userId, userId);
        db.prepare('DELETE FROM elector_captures WHERE coordinator_id = ?').run(userId);
      } else if (capturesAction === 'inherit' && user.parent_id) {
        db.prepare('UPDATE elector_captures SET coordinator_id = ? WHERE coordinator_id = ?').run(user.parent_id, userId);
      } else {
        // Default behavior (nullify)
        db.prepare('UPDATE elector_captures SET coordinator_id = NULL WHERE coordinator_id = ?').run(userId);
      }
      
      // 2. Nullify references in vehicles (formerly logistics)
      db.prepare('UPDATE vehicles SET assigned_user_id = NULL WHERE assigned_user_id = ?').run(userId);
      
      // 3. Nullify references in field_requests
      db.prepare('UPDATE field_requests SET coordinator_id = NULL WHERE coordinator_id = ?').run(userId);

      // 4. Nullify references in capture_conflicts and audit_logs
      db.prepare('UPDATE capture_conflicts SET resolved_by_jefe_id = NULL WHERE resolved_by_jefe_id = ?').run(userId);
      db.prepare('UPDATE capture_conflicts SET resolved_coordinator_id = NULL WHERE resolved_coordinator_id = ?').run(userId);
      db.prepare('UPDATE audit_logs SET user_id = NULL WHERE user_id = ?').run(userId);

      // 5. Nullify references in participation_logs
      db.prepare('UPDATE participation_logs SET veedor_id = NULL WHERE veedor_id = ?').run(userId);


      // 8. Update children users to have no parent (orphan them instead of deleting)
      db.prepare('UPDATE users SET parent_id = NULL WHERE parent_id = ?').run(userId);

      // 9. Finally delete the user
      db.prepare('DELETE FROM users WHERE id = ?').run(userId);
      db.prepare('PRAGMA foreign_keys = ON').run();

      logAction(1, 'DELETE', 'USER', userId, `Deleted user with ID ${userId} and cleaned up all references`);
    });

    transaction();
    invalidateAllReportsCaches();
    res.json({ success: true });
  } catch (err: any) {
    console.error('[DELETE USER ERROR]:', err);
    res.status(500).json({ error: err.message });
  }
});

router.post('/change-p', (req, res) => {
  const { user_id, new_password } = req.body;
  console.log(`[AUTH] Updating password for user ID: ${user_id}`);
  if (!user_id || isNaN(Number(user_id))) return res.status(400).json({ error: 'user_id debe ser un número' });
  if (!new_password || new_password.toString().trim().length < 6) return res.status(400).json({ error: 'La nueva contraseña debe tener al menos 6 caracteres' });
  try {
    db.prepare('UPDATE users SET password = ?, needs_password_change = 0 WHERE id = ?').run(new_password, user_id);
    logAction(user_id, 'UPDATE_PASSWORD', 'USER', user_id, 'User updated their password');
    res.json({ success: true });
  } catch (err: any) {
    console.error('[AUTH ERROR] Password update failed:', err);
    res.status(500).json({ error: err.message });
  }
});

// Admin: reset needs_password_change flag for users
router.post('/admin/reset-password-flags', (req, res) => {
  const requesterRole = (req.headers['x-user-role'] as string || '').toUpperCase().trim();
  if (requesterRole !== 'SUPERUSUARIO') {
    return res.status(403).json({ error: 'Solo Super Administradores pueden ejecutar esta acción.' });
  }
  try {
    const { role } = req.body; // optional filter by role
    let sql = 'UPDATE users SET needs_password_change = 0 WHERE needs_password_change = 1';
    let params: any[] = [];
    if (role) {
      sql += ' AND role = ?';
      params.push(role.toUpperCase());
    }
    const result = db.prepare(sql).run(...params);
    res.json({ success: true, updated: result.changes });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/:id', (req, res) => {
  const requesterRole = (req.headers['x-user-role'] as string || '').toUpperCase().trim();
  const requesterId   = req.headers['x-user-id'] as string;

  if (requesterRole !== 'SUPERUSUARIO' && requesterId) {
    if (!canModifyUser(requesterId, requesterRole, req.params.id)) {
      return res.status(403).json({ error: 'No tienes permisos para modificar este usuario.' });
    }
  }

  const { role, nombre, photo_url, parent_id, telefono, ci } = req.body;

  if (requesterRole !== 'SUPERUSUARIO' && requesterId) {
    const ALLOWED_ROLES_TO_CREATE: Record<string, string[]> = {
      JEFE_CAMPANA: ['PADRINO','SUBJEFE','COORDINADOR','MIEMBRO_DE_MESA','MIEMBRO_MESA','APODERADO','VEEDOR'],
      PADRINO:      ['SUBJEFE','COORDINADOR','MIEMBRO_DE_MESA','MIEMBRO_MESA','APODERADO','VEEDOR'],
      SUBJEFE:      ['PADRINO','COORDINADOR','MIEMBRO_DE_MESA','MIEMBRO_MESA','APODERADO','VEEDOR'],
    };
    const allowed = ALLOWED_ROLES_TO_CREATE[requesterRole] || [];
    if (role && !allowed.includes(role.toUpperCase())) {
      return res.status(403).json({ error: `Tu rol (${requesterRole}) no puede asignar el rol ${role}.` });
    }

    if (parent_id !== undefined) {
      const finalParentId = parent_id ? Number(parent_id) : null;
      const targetRole = role || (db.prepare('SELECT role FROM users WHERE id = ?').get(req.params.id) as any)?.role;
      if (!isAllowedParent(Number(requesterId), requesterRole, finalParentId, targetRole)) {
        return res.status(403).json({ error: 'No tienes permisos para asignar el superior/padre indicado para este usuario.' });
      }
    }
  }

  const existingUser = db.prepare('SELECT role, assigned_list_id, assigned_campaign_id, parent_id, distrito FROM users WHERE id = ?').get(req.params.id) as any;
  if (!existingUser) {
    return res.status(404).json({ error: 'Usuario no encontrado' });
  }

  const cleanCI = ci ? ci.toString().replace(/\./g, '') : null;
  
  // Parent:
  let finalParentId = parent_id !== undefined ? (parent_id ? Number(parent_id) : null) : existingUser.parent_id;

  // List assignment:
  let finalAssignedListId = existingUser.assigned_list_id;
  const incomingListId = req.body.assigned_list_id;
  if (incomingListId !== undefined && incomingListId !== null && incomingListId !== '') {
    finalAssignedListId = Number(incomingListId);
  } else if (!finalAssignedListId) {
    if (requesterId) {
      const requesterInfo = getCachedUserInfo(requesterId);
      if (requesterInfo?.assigned_list_id) {
        finalAssignedListId = requesterInfo.assigned_list_id;
      }
    }
    if (!finalAssignedListId && finalParentId) {
      const parentInfo = db.prepare('SELECT assigned_list_id FROM users WHERE id = ?').get(finalParentId) as any;
      if (parentInfo?.assigned_list_id) {
        finalAssignedListId = parentInfo.assigned_list_id;
      }
    }
  }

  // Campaign assignment:
  let finalCampaignId = existingUser.assigned_campaign_id;
  const incomingCampaignId = req.body.assigned_campaign_id || req.body.campaign_id;
  if (incomingCampaignId !== undefined && incomingCampaignId !== null && incomingCampaignId !== '') {
    finalCampaignId = Number(incomingCampaignId);
  } else if (!finalCampaignId) {
    if (requesterId) {
      const requesterInfo = getCachedUserInfo(requesterId);
      if (requesterInfo?.campaign_id) {
        finalCampaignId = requesterInfo.campaign_id;
      }
    }
    if (!finalCampaignId && finalParentId) {
      const parentInfo = db.prepare('SELECT assigned_campaign_id FROM users WHERE id = ?').get(finalParentId) as any;
      if (parentInfo?.assigned_campaign_id) {
        finalCampaignId = parentInfo.assigned_campaign_id;
      }
    }
    if (!finalCampaignId && finalAssignedListId) {
      const listInfo = db.prepare('SELECT campaign_id FROM lists WHERE id = ?').get(finalAssignedListId) as any;
      if (listInfo?.campaign_id) {
        finalCampaignId = listInfo.campaign_id;
      }
    }
  }

  // District assignment:
  let distrito = req.body.distrito || existingUser.distrito;
  if (!distrito) {
    if (finalAssignedListId) {
      const origin = db.prepare('SELECT ciudad as distrito FROM lists WHERE id = ?').get(finalAssignedListId) as any;
      distrito = origin?.distrito;
    }
    if (!distrito && finalCampaignId) {
      const origin = db.prepare('SELECT distrito FROM campaigns WHERE id = ?').get(finalCampaignId) as any;
      distrito = origin?.distrito;
    }
    if (!distrito && requesterId) {
      const requesterInfo = getCachedUserInfo(requesterId);
      distrito = requesterInfo?.distrito;
    }
    if (!distrito && finalParentId) {
      const parentInfo = db.prepare('SELECT distrito FROM users WHERE id = ?').get(finalParentId) as any;
      distrito = parentInfo?.distrito;
    }
  }

  try {
    db.prepare(`
      UPDATE users 
      SET role = ?, assigned_list_id = ?, assigned_campaign_id = ?, assigned_local = ?, assigned_mesa = ?, nombre = ?, photo_url = ?, parent_id = ?, telefono = ?, ci = ?, distrito = COALESCE(?, distrito)
      WHERE id = ?
    `).run(
      role || existingUser.role, 
      finalAssignedListId, 
      finalCampaignId, 
      req.body.assigned_local || null, 
      req.body.assigned_mesa || null, 
      nombre, 
      photo_url, 
      finalParentId, 
      telefono || null, 
      cleanCI, 
      distrito || null,
      req.params.id
    );
    clearUserCache(req.params.id); // invalidate cache after update
    invalidateAllReportsCaches();
    logAction(1, 'UPDATE', 'USER', req.params.id, `Updated user ${nombre} (${role || existingUser.role})`);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});


router.post('/admin/:id/reset-password', (req, res) => {
  const requesterRole = (req.headers['x-user-role'] as string || '').toUpperCase().trim();
  const requesterId   = req.headers['x-user-id'] as string;

  if (requesterRole !== 'SUPERUSUARIO' && requesterId) {
    if (!canModifyUser(requesterId, requesterRole, req.params.id)) {
      return res.status(403).json({ error: 'No tienes permisos para resetear la contraseña de este usuario.' });
    }
  }

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
router.put('/profile/photo', (req, res) => {
    const userId = req.headers['x-user-id'] as string;
    const { photo_url } = req.body;

    if (!userId) {
      return res.status(401).json({ error: 'No autorizado' });
    }
    if (!photo_url) {
      return res.status(400).json({ error: 'photo_url es requerido' });
    }

    try {
      db.prepare('UPDATE users SET photo_url = ? WHERE id = ?').run(photo_url, userId);
      clearUserCache(userId);
      invalidateAllReportsCaches();
      res.json({ success: true, photo_url });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  return router;
}
