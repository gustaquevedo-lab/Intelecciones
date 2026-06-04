import express from 'express';
import db from '../db';
import { normalizePhone } from '../utils/phone';

export interface CachedUser {
  id: number;
  role: string;
  assigned_list_id: number | null;
  assigned_campaign_id: number | null;
  distrito: string | null;
  campaign_id: number | null;
  ts: number;
}

const _userCache = new Map<string, CachedUser>();
const USER_CACHE_TTL = 120_000;

export const getCachedUserInfo = (user_id: string): CachedUser | null => {
  const now = Date.now();
  const hit = _userCache.get(user_id);
  if (hit && now - hit.ts < USER_CACHE_TTL) return hit;
  const user = db.prepare(`
    SELECT u.id, u.role, u.assigned_list_id, u.assigned_campaign_id,
           COALESCE(u.distrito, l.ciudad, c1.distrito, c2.distrito) as distrito,
           COALESCE(l.campaign_id, u.assigned_campaign_id) as campaign_id
    FROM users u
    LEFT JOIN lists l ON u.assigned_list_id = l.id
    LEFT JOIN campaigns c1 ON l.campaign_id = c1.id
    LEFT JOIN campaigns c2 ON u.assigned_campaign_id = c2.id
    WHERE u.id = ?
  `).get(user_id) as any;
  if (!user) return null;
  const entry: CachedUser = {
    id: user.id,
    role: user.role,
    assigned_list_id: user.assigned_list_id,
    assigned_campaign_id: user.assigned_campaign_id,
    distrito: user.distrito,
    campaign_id: user.campaign_id ?? null,
    ts: now
  };
  _userCache.set(user_id, entry);
  return entry;
};

export const clearUserCache = (user_id: string | number) => _userCache.delete(String(user_id));

export const getListId = (req: express.Request) => {
  const q = req.query.listId as string;
  if (q && q !== 'null' && q !== 'undefined' && q !== '') return parseInt(q);
  const h = req.headers['x-list-id'];
  return (h && h !== 'null' && h !== 'undefined' && h !== '') ? parseInt(h as string) : null;
};

export const getDistrict = (req: express.Request) => {
  const q = req.query.district as string;
  const d = req.headers['x-district'];
  const val = (q && q !== 'null' && q !== 'undefined' && q !== '') ? q : (d as string);
  if (!val || val === 'null' || val === 'undefined' || val === '') return null;
  const normalized = val.toString().toUpperCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();
  if (['GLOBAL', 'TODOS', 'ALL', 'TODAS', 'NULL'].includes(normalized)) return null;
  return normalized;
};

export const getRole = (req: express.Request) => {
  const role = (req.headers['x-user-role'] as string || 'GUEST').toUpperCase().trim();
  if (role === 'SUPER_ADMIN' || role === 'SUPERUSUARIO') return 'SUPERUSUARIO';
  if (role === 'CANDIDATE' || role === 'JEFE_CAMPANA') return 'JEFE_CAMPANA';
  if (role === 'SUBJEFE' || role === 'LIDER_LISTA') return 'SUBJEFE';
  if (role === 'COORDINATOR' || role === 'COORDINADOR') return 'COORDINADOR';
  return role;
};

export function requireRole(...roles: string[]) {
  return (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const role = (req.headers['x-user-role'] as string || '').toUpperCase().trim();
    if (!roles.map(r => r.toUpperCase()).includes(role)) {
      return res.status(403).json({ error: 'Acceso denegado. Rol insuficiente.' });
    }
    next();
  };
}

export const getSecurityFilter = (req: express.Request, tableAlias: string = 'c') => {
  try {
    const user_id = req.headers['x-user-id'] as string;
    const headerRole = (req.headers['x-user-role'] as string || '').toUpperCase().trim();
    const activeDistrict = getDistrict(req);

    let user: CachedUser | null = null;
    if (user_id && user_id !== 'undefined' && user_id !== 'null' && user_id !== '') {
      user = getCachedUserInfo(user_id);
    }

    const role = (user?.role || headerRole || 'GUEST').toUpperCase().trim();

    let distColumn = 'distrito';
    if (tableAlias === 'l') distColumn = 'ciudad';

    if (role === 'SUPERUSUARIO' || role === 'SUPER_ADMIN' || role === 'JEFE_CAMPANA' || role === 'SUBJEFE' || role === 'PADRINO' || role === 'CANDIDATO' || role === 'CANDIDATE') {
      let sql = '';
      let params: any[] = [];

      let effectiveDistrict = getDistrict(req);

      if ((role === 'JEFE_CAMPANA' || role === 'SUBJEFE' || role === 'PADRINO' || role === 'CANDIDATO' || role === 'CANDIDATE') && user?.distrito) {
        effectiveDistrict = user.distrito;
      }

      if (effectiveDistrict) {
        const d = effectiveDistrict;
        console.log(`[SECURITY] Applying district filter: ${d} for table ${tableAlias}`);

        if (tableAlias === 'u') {
          sql += ` AND (
            u.distrito = ? OR
            EXISTS (SELECT 1 FROM lists l2 WHERE l2.id = u.assigned_list_id AND l2.ciudad = ?) OR
            EXISTS (SELECT 1 FROM campaigns c2 WHERE c2.id = u.assigned_campaign_id AND c2.distrito = ?)
          )`;
          params.push(d, d, d);
        } else if (tableAlias === 'ec') {
          sql += ` AND e.distrito = ?`;
          params.push(d);
        } else if (tableAlias === 'cc' || tableAlias === 'cc_history') {
          sql += ` AND e.distrito = ?`;
          params.push(d);
        } else {
          let col = 'distrito';
          if (tableAlias === 'l') col = 'ciudad';

          sql += ` AND ${tableAlias}.${col} = ?`;
          params.push(d);

          if (tableAlias === 'loc') {
            sql = sql.slice(0, -1);
            sql = sql.replace(` AND ${tableAlias}.${col} = `, ` AND (${tableAlias}.ciudad = ? OR ${tableAlias}.distrito = ?)`);
            params.push(d);
          }
        }
      }

      if ((role === 'JEFE_CAMPANA' || role === 'CANDIDATO' || role === 'CANDIDATE') && !effectiveDistrict) {
        if (user?.campaign_id) {
          if (tableAlias === 'e') {
            sql += ` AND (e.campaign_id = ? OR e.campaign_id IS NULL)`;
            params.push(user.campaign_id);
          } else {
            const col = (tableAlias === 'c') ? 'id' : 'assigned_campaign_id';
            const finalCol = (tableAlias === 'l') ? 'campaign_id' : col;
            sql += ` AND ${tableAlias}.${finalCol} = ?`;
            params.push(user.campaign_id);
          }
        }
      }

      let listId = getListId(req);

      if ((role === 'SUBJEFE' || role === 'PADRINO') && user?.assigned_list_id) {
        listId = user.assigned_list_id;
      }

      if (listId && !isNaN(listId)) {
        if (tableAlias === 'l') {
          sql += ` AND ${tableAlias}.id = ?`;
          params.push(listId);
        } else if (tableAlias === 'ec' || tableAlias === 'whatsapp_messages' || tableAlias === 'u' || tableAlias === 'capture_conflicts') {
          const col = (tableAlias === 'u') ? 'assigned_list_id' : 'list_id';
          sql += ` AND ${tableAlias}.${col} = ?`;
          params.push(listId);
        } else if (tableAlias === 'e') {
          sql += ` AND EXISTS (SELECT 1 FROM elector_captures ec2 WHERE ec2.elector_ci = e.ci AND ec2.list_id = ?)`;
          params.push(listId);
        }
      }

      const isDetailQuery = ['ec', 'u'].includes(tableAlias);
      const isPublicStats = req.path.includes('/stats/command');

      if (role === 'JEFE_CAMPANA' && tableAlias === 'u' && !isPublicStats) {
        const listCol = 'assigned_list_id';
        sql += ` AND (
            ${tableAlias}.${listCol} IS NULL OR
            ${tableAlias}.role IN ('SUBJEFE') OR
            NOT EXISTS (SELECT 1 FROM users ul WHERE ul.assigned_list_id = ${tableAlias}.${listCol} AND ul.role = 'SUBJEFE')
          )`;
      }

      return { sql, params };
    }

    if (!user || !user.distrito) {
      if (role !== 'GUEST') {
        console.warn(`[SECURITY] User ${user_id} (${role}) blocked - missing district assignment. Cache result:`, user);
      }
      return { sql: ' AND 1=0', params: [] };
    }

    let sql = '';
    let params: any[] = [];
    if (tableAlias === 'ec') {
      sql = ` AND e.distrito = ?`;
      params = [user.distrito];
    } else if (tableAlias === 'cc') {
      sql = ` AND (e.distrito = ? OR ua.distrito = ? OR ub.distrito = ?)`;
      params = [user.distrito, user.distrito, user.distrito];
    } else if (tableAlias === 'cc_history') {
      sql = ` AND (e.distrito = ? OR u_win_1.distrito = ? OR u_win_2.distrito = ?)`;
      params = [user.distrito, user.distrito, user.distrito];
    } else {
      let targetCol = distColumn;
      sql = ` AND ${tableAlias}.${targetCol} = ?`;
      params = [user.distrito];
    }

    if ((tableAlias === 'e') && user.campaign_id) {
      sql += ` AND (${tableAlias}.campaign_id = ? OR ${tableAlias}.campaign_id IS NULL)`;
      params.push(user.campaign_id);
    }

    if ((tableAlias === 'u' || tableAlias === 'l') && !['SUPERUSUARIO', 'SUPER_ADMIN', 'JEFE_CAMPANA', 'SUBJEFE', 'PADRINO'].includes(role)) {
      if (user.assigned_list_id) {
        if (tableAlias === 'l') sql += ` AND ${tableAlias}.id = ?`;
        else if (tableAlias === 'u') sql += ` AND ${tableAlias}.assigned_list_id = ?`;
        params.push(user.assigned_list_id);
      } else if (user.assigned_campaign_id) {
        if (tableAlias === 'l') sql += ` AND ${tableAlias}.campaign_id = ?`;
        else if (tableAlias === 'u') sql += ` AND ${tableAlias}.assigned_campaign_id = ?`;
        params.push(user.assigned_campaign_id);
      }
    }
    return { sql, params };
  } catch (err: any) {
    console.error('[SECURITY FILTER ERROR]', err);
    return { sql: '', params: [] };
  }
};

export const getTenant = (req: any) => {
  return parseInt(req.headers['x-list-id'] as string) || null;
};

export const applyTenantFilter = (query: string, req: express.Request, params: any[] = []) => {
  const role = getRole(req);
  const listId = getListId(req);

  if (role === 'SUPERUSUARIO' || !listId) {
    return { filteredQuery: query, filteredParams: params };
  }

  const hasWhere = query.toUpperCase().includes('WHERE');
  const filteredQuery = hasWhere
    ? query.replace(/WHERE/i, 'WHERE list_id = ? AND ')
    : query + ' WHERE list_id = ?';

  return { filteredQuery, filteredParams: [...params, listId] };
};

export function sanitizeElectorData(elector: any): any {
  if (!elector) return elector;
  const copy = { ...elector };
  copy.nombre = copy.nombre ? copy.nombre.trim().toUpperCase() : 'SIN NOMBRE';
  copy.apellido = copy.apellido && copy.apellido.trim() !== '' ? copy.apellido.trim().toUpperCase() : 'DATO NO REGISTRADO';
  copy.ci = copy.ci ? copy.ci.toString().trim() : 'DATO NO REGISTRADO';
  if (!copy.local_votacion || copy.local_votacion.trim() === '' || copy.local_votacion === '0' || copy.local_votacion.toLowerCase() === 'sin local' || copy.local_votacion.toLowerCase() === 'desconocido') {
    copy.local_votacion = 'DATO NO REGISTRADO';
  } else {
    copy.local_votacion = copy.local_votacion.trim().toUpperCase();
  }
  const rawMesa = parseInt(copy.mesa) || 0;
  copy.mesa = rawMesa === 0 ? 'DATO NO REGISTRADO' : rawMesa;
  const rawOrden = parseInt(copy.orden) || 0;
  copy.orden = rawOrden === 0 ? 'DATO NO REGISTRADO' : rawOrden;
  if (!copy.ciudad || copy.ciudad.trim() === '' || copy.ciudad === '0') {
    copy.ciudad = 'DATO NO REGISTRADO';
  } else {
    copy.ciudad = copy.ciudad.trim().toUpperCase();
  }
  if (!copy.distrito || copy.distrito.trim() === '' || copy.distrito === '0') {
    copy.distrito = 'DATO NO REGISTRADO';
  } else {
    copy.distrito = copy.distrito.trim().toUpperCase();
  }
  if (!copy.barrio || copy.barrio.trim() === '' || copy.barrio === '0' || copy.barrio.toLowerCase() === 'sin barrio' || copy.barrio.toLowerCase() === 'no registrado' || copy.barrio.toLowerCase() === 'no asignado') {
    copy.barrio = 'DATO NO REGISTRADO';
  } else {
    copy.barrio = copy.barrio.trim().toUpperCase();
  }
  if (!copy.direccion || copy.direccion.trim() === '' || copy.direccion === '0' || copy.direccion.toLowerCase() === 'sin direccion' || copy.direccion.toLowerCase() === 'no registrada' || copy.direccion.toLowerCase() === 'no asignada') {
    copy.direccion = 'DATO NO REGISTRADO';
  } else {
    copy.direccion = copy.direccion.trim().toUpperCase();
  }
  return copy;
}

function parseSpintax(text: string): string {
  return text.replace(/{([^{}]+)}/g, (match, choices) => {
    const list = choices.split('|');
    return list[Math.floor(Math.random() * list.length)];
  });
}

export function addSubtleVariation(text: string): string {
  if (!text) return text;
  return parseSpintax(text);
}
