import { Router } from 'express';
import multer from 'multer';
import fs from 'fs';
import * as XLSX from 'xlsx';
import db from '../db';
import {
  getRole, getSecurityFilter, getListId, getDistrict,
  getCachedUserInfo, sanitizeElectorData
} from './helpers';
import {
  clearElectorsCache, invalidateAllReportsCaches, logAction
} from '../server';
import { normalizePhone } from '../utils/phone';

function hashCode(str: string) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0;
  }
  return hash;
}

export default function adminRoutes(upload: multer.Multer) {
  const router = Router();

  // ── GET /api/voting-locations ───────────────────────────────────────────────
  router.get('/voting-locations', (req, res) => {
    const sec = getSecurityFilter(req, 'loc');
    try {
      const locations = db.prepare(`SELECT * FROM voting_locations loc WHERE 1=1 ${sec.sql}`).all(...sec.params);
      res.json(locations);
    } catch (err: any) {
      console.error('[VOTING-LOCATIONS ERROR]', err);
      res.status(500).json({ error: err.message });
    }
  });

  // ── POST /api/voting-locations/:cod/geo ─────────────────────────────────────
  router.post('/voting-locations/:cod/geo', (req, res) => {
    const { lat, lng } = req.body;
    try {
      db.prepare('UPDATE voting_locations SET lat = ?, lng = ? WHERE cod_local = ?').run(lat, lng, req.params.cod);
      res.json({ success: true });
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  // ── POST /api/voting-locations/:cod/icon ────────────────────────────────────
  router.post('/voting-locations/:cod/icon', (req, res) => {
    const { icon } = req.body;
    try {
      db.prepare('UPDATE voting_locations SET icon = ? WHERE cod_local = ?').run(icon, req.params.cod);
      res.json({ success: true });
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  // ── POST /api/admin/locales/sync-from-padron ────────────────────────────────
  router.post('/admin/locales/sync-from-padron', (req, res) => {
    const { district } = req.body;
    try {
      let query = `
        SELECT DISTINCT
          UPPER(TRIM(local_votacion)) as nombre,
          UPPER(TRIM(COALESCE(NULLIF(ciudad, ''), NULLIF(distrito, ''), 'SIN ASIGNAR'))) as ciudad
        FROM electors
        WHERE local_votacion IS NOT NULL AND local_votacion != ''
      `;
      const params: any[] = [];
      if (district) {
        query += ` AND (UPPER(TRIM(distrito)) = UPPER(TRIM(?)) OR UPPER(TRIM(ciudad)) = UPPER(TRIM(?)))`;
        params.push(district, district);
      }
      const rawLocales = db.prepare(query).all(...params);

      let added = 0;
      const insertStmt = db.prepare(`INSERT OR IGNORE INTO voting_locations (cod_local, nombre, ciudad, distrito) VALUES (?, ?, ?, ?)`);
      const transaction = db.transaction((locales: any[]) => {
        for (const loc of locales) {
          const cod = loc.nombre.substring(0, 15).replace(/[^A-Z0-9]/g, '') + '_' + Math.abs(hashCode(loc.nombre)).toString(36).substring(0, 4);
          const result = insertStmt.run(cod, loc.nombre, loc.ciudad, loc.ciudad);
          if (result.changes > 0) added++;
        }
      });

      transaction(rawLocales);
      clearElectorsCache();
      invalidateAllReportsCaches();
      res.json({ success: true, added });
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  // ── GET /api/campaigns ──────────────────────────────────────────────────────
  router.get('/campaigns', (req, res) => {
    const sec = getSecurityFilter(req, 'c');
    const params = sec.params || [];
    try {
      const campaigns = db.prepare(`
        SELECT c.*,
          (SELECT COUNT(*) FROM users u WHERE u.assigned_campaign_id = c.id) as campUsers,
          (SELECT COUNT(*) FROM elector_captures ec WHERE ec.campaign_id = c.id) as campCaptures
        FROM campaigns c WHERE 1=1 ${sec.sql}
      `).all(...params);
      res.json(campaigns);
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  // ── POST /api/campaigns ─────────────────────────────────────────────────────
  router.post('/campaigns', (req, res) => {
    const { name, status, slogan, photo_url, enabled_modules, goal, distrito } = req.body;
    if (!name || name.toString().trim() === '') return res.status(400).json({ error: 'name es requerido y no puede estar vacío' });
    try {
      const modulesStr = Array.isArray(enabled_modules) ? enabled_modules.join(',') : (enabled_modules || 'COMMAND_CENTER,REGISTRY');
      const finalDist = distrito ? distrito.toString().toUpperCase().trim() : '';
      const finalName = name ? name.toString().toUpperCase().trim() : '';
      const finalSlogan = slogan ? slogan.toString().toUpperCase().trim() : '';
      const result = db.prepare(`INSERT INTO campaigns (name, status, slogan, photo_url, enabled_modules, goal, distrito) VALUES (?, ?, ?, ?, ?, ?, ?)`)
        .run(finalName, status || 'ACTIVE', finalSlogan, photo_url || null, modulesStr, goal || 1000, finalDist);
      logAction(1, 'CREATE', 'CAMPAIGN', Number(result.lastInsertRowid), `Created campaign ${name}`);
      res.json({ id: result.lastInsertRowid });
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  // ── PUT /api/campaigns/:id ──────────────────────────────────────────────────
  router.put('/campaigns/:id', (req, res) => {
    const { id } = req.params;
    const { name, status, slogan, photo_url, enabled_modules, goal, distrito } = req.body;
    try {
      const modulesStr = Array.isArray(enabled_modules) ? enabled_modules.join(',') : enabled_modules;
      const finalDist = distrito ? distrito.toString().toUpperCase().trim() : '';
      const finalName = name ? name.toString().toUpperCase().trim() : '';
      const finalSlogan = slogan ? slogan.toString().toUpperCase().trim() : '';
      db.prepare('UPDATE campaigns SET name = ?, status = ?, slogan = ?, photo_url = ?, enabled_modules = ?, goal = ?, distrito = ? WHERE id = ?')
        .run(finalName, status || 'ACTIVE', finalSlogan, photo_url || null, modulesStr || 'COMMAND_CENTER,REGISTRY', goal || 1000, finalDist, id);
      logAction(1, 'UPDATE', 'CAMPAIGN', id, `Updated campaign ${name}`);
      res.json({ success: true });
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  // ── DELETE /api/campaigns/:id ───────────────────────────────────────────────
  router.delete('/campaigns/:id', (req, res) => {
    const campaign_id = parseInt(req.params.id);
    if (isNaN(campaign_id)) return res.status(400).json({ error: "ID de campaña inválido" });
    try {
      db.transaction(() => {
        db.prepare(`UPDATE users SET assigned_list_id = NULL WHERE assigned_list_id IN (SELECT id FROM lists WHERE campaign_id = ?)`).run(campaign_id);
        db.prepare('DELETE FROM lists WHERE campaign_id = ?').run(campaign_id);
        db.prepare('DELETE FROM campaigns WHERE id = ?').run(campaign_id);
      })();
      logAction(1, 'DELETE', 'CAMPAIGN', campaign_id, `Deleted campaign ${campaign_id} and purged all associated lists`);
      res.json({ success: true });
    } catch (err: any) {
      console.error("Error deleting campaign:", err);
      res.status(500).json({ error: "No se pudo borrar la campaña: " + err.message });
    }
  });

  // ── GET /api/campaigns/:id/lists ────────────────────────────────────────────
  router.get('/campaigns/:id/lists', (req, res) => {
    const lists = db.prepare(`SELECT l.*, e.nombre as candidate_nombre, e.apellido as candidate_apellido FROM lists l LEFT JOIN electors e ON l.candidate_ci = e.ci WHERE campaign_id = ?`).all(req.params.id);
    res.json(lists);
  });

  // ── GET /api/lists ──────────────────────────────────────────────────────────
  router.get('/lists', (req, res) => {
    const sec = getSecurityFilter(req, 'l');
    const params = sec.params || [];
    try {
      const lists = db.prepare(`SELECT l.*, c.name as campaign_name, c.distrito as campaign_distrito FROM lists l JOIN campaigns c ON l.campaign_id = c.id WHERE 1=1 ${sec.sql}`).all(...params);
      res.json(lists);
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  // ── POST /api/lists ─────────────────────────────────────────────────────────
  router.post('/lists', (req, res) => {
    const { campaign_id, type, list_number, option_number, candidate_ci, photo_url, goal, candidate_nombre, candidate_alias, ciudad } = req.body;
    if (!campaign_id || !type || !list_number || !candidate_ci || !ciudad) {
      return res.status(400).json({ error: 'Faltan campos obligatorios para registrar la lista (incluyendo ciudad).' });
    }
    try {
      db.transaction(() => {
        const finalCiudad = ciudad.toString().toUpperCase().trim();
        const finalAlias = (candidate_alias || '').toString().toUpperCase().trim();
        const finalNombre = (candidate_nombre || '').toString().toUpperCase().trim();
        db.prepare(`INSERT INTO lists (campaign_id, type, list_number, option_number, candidate_ci, photo_url, goal, candidate_nombre, candidate_alias, ciudad) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
          .run(campaign_id, type, list_number, option_number, candidate_ci, photo_url, goal || 1000, finalNombre, finalAlias, finalCiudad);
        if (photo_url) db.prepare('UPDATE electors SET photo_url = ? WHERE ci = ?').run(photo_url, candidate_ci);
        logAction(1, 'CREATE', 'LIST', list_number, `Created list ${list_number} for campaign ${campaign_id} in ${finalCiudad}`);
      })();
      res.json({ success: true });
    } catch (err: any) {
      console.error("Error creating list:", err);
      res.status(500).json({ error: err.message });
    }
  });

  // ── PUT /api/lists/:id ──────────────────────────────────────────────────────
  router.put('/lists/:id', (req, res) => {
    const { id } = req.params;
    const { goal, photo_url, type, list_number, option_number, campaign_id, candidate_alias, candidate_nombre, ciudad } = req.body;
    try {
      const finalCiudad = ciudad ? ciudad.toString().toUpperCase().trim() : '';
      const finalAlias = candidate_alias ? candidate_alias.toString().toUpperCase().trim() : '';
      const finalNombre = candidate_nombre ? candidate_nombre.toString().toUpperCase().trim() : '';
      db.prepare(`UPDATE lists SET goal = ?, photo_url = ?, type = ?, list_number = ?, option_number = ?, campaign_id = ?, candidate_alias = ?, candidate_nombre = ?, ciudad = ? WHERE id = ?`)
        .run(goal || 1000, photo_url || null, type || 'INTENDENTE', list_number || '', option_number || null, campaign_id || null, finalAlias, finalNombre, finalCiudad, id);
      if (photo_url) {
        const list = db.prepare('SELECT candidate_ci FROM lists WHERE id = ?').get(id) as any;
        if (list) db.prepare('UPDATE electors SET photo_url = ? WHERE ci = ?').run(photo_url, list.candidate_ci);
      }
      logAction(1, 'UPDATE', 'LIST', id, `Updated list ${id} goals/photo`);
      res.json({ success: true });
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  // ── DELETE /api/lists/:id ───────────────────────────────────────────────────
  router.delete('/lists/:id', (req, res) => {
    try {
      db.prepare('DELETE FROM lists WHERE id = ?').run(req.params.id);
      logAction(1, 'DELETE', 'LIST', req.params.id, `Deleted list with ID ${req.params.id}`);
      res.json({ success: true });
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  // ── GET /api/locales ────────────────────────────────────────────────────────
  router.get('/locales', (req, res) => {
    const sec = getSecurityFilter(req, 'loc');
    const params = sec.params || [];
    try {
      const locales = db.prepare(`SELECT * FROM voting_locations loc WHERE 1=1 ${sec.sql}`).all(...params);
      res.json(locales);
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  // ── POST /api/locales ───────────────────────────────────────────────────────
  router.post('/locales', (req, res) => {
    const { cod_local, nombre, lat, lng, icon, direccion, distrito, ciudad } = req.body;
    if (!cod_local) return res.status(400).json({ error: 'cod_local es requerido' });
    if (!nombre) return res.status(400).json({ error: 'nombre es requerido' });
    if (!distrito) return res.status(400).json({ error: 'distrito es requerido' });
    if (!ciudad) return res.status(400).json({ error: 'ciudad es requerida' });
    if (!direccion) return res.status(400).json({ error: 'direccion es requerida' });
    try {
      db.prepare(`INSERT INTO voting_locations (cod_local, nombre, lat, lng, icon, direccion, distrito, ciudad) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
        .run(cod_local, nombre, lat, lng, icon || 'Landmark', direccion || '', distrito || ciudad || '', ciudad || distrito || '');
      logAction(1, 'CREATE', 'LOCALE', cod_local, `Created locale ${nombre} (${cod_local})`);
      res.json({ success: true });
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  // ── PUT /api/locales/:cod ───────────────────────────────────────────────────
  router.put('/locales/:cod', (req, res) => {
    const { cod_local, nombre, lat, lng, icon, direccion, distrito, ciudad } = req.body;
    const { cod } = req.params;
    try {
      const result = db.prepare(`UPDATE voting_locations SET cod_local = ?, nombre = ?, lat = ?, lng = ?, icon = ?, direccion = ?, distrito = ?, ciudad = ? WHERE cod_local = ?`)
        .run(cod_local || cod, nombre, lat, lng, icon, direccion || '', distrito || ciudad || '', ciudad || distrito || '', cod);
      if (result.changes === 0) {
        const retry = db.prepare('UPDATE voting_locations SET nombre=? WHERE TRIM(cod_local)=TRIM(?)').run(nombre, cod);
        if (retry.changes === 0) throw new Error(`No se encontró ningún local con el código ${cod} para actualizar.`);
      }
      logAction(1, 'UPDATE', 'LOCALE', cod, `Updated locale ${nombre}`);
      res.json({ success: true });
    } catch (err: any) {
      console.error('[DB UPDATE LOCALE ERROR]', err.message);
      res.status(500).json({ error: err.message });
    }
  });

  // ── DELETE /api/locales/:cod ────────────────────────────────────────────────
  router.delete('/locales/:cod', (req, res) => {
    try {
      db.prepare('DELETE FROM voting_locations WHERE cod_local = ?').run(req.params.cod);
      logAction(1, 'DELETE', 'LOCALE', req.params.cod, `Deleted locale ${req.params.cod}`);
      res.json({ success: true });
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  // ── GET /api/settings ───────────────────────────────────────────────────────
  router.get('/settings', (req, res) => {
    try {
      const settings = db.prepare('SELECT * FROM settings').all() as any[];
      const formatted = settings.reduce((acc, curr) => { acc[curr.key] = curr.value; return acc; }, {} as any);
      res.json(formatted);
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  // ── POST /api/settings ──────────────────────────────────────────────────────
  router.post('/settings', (req, res) => {
    const settings = req.body;
    try {
      const stmt = db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)');
      db.transaction(() => {
        for (const [key, value] of Object.entries(settings)) {
          stmt.run(key, value);
        }
        logAction(1, 'UPDATE', 'SETTINGS', null, 'Updated global settings');
      })();
      res.json({ success: true });
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  // ── GET /api/admin/electors/search ─────────────────────────────────────────
  router.get('/admin/electors/search', (req, res) => {
    const { q } = req.query;
    const user_id = req.headers['x-user-id'];
    const role = getRole(req);
    try {
      let cityFilter = '';
      if (role !== 'SUPERUSUARIO' && user_id) {
        const user = db.prepare(`SELECT c.distrito FROM users u JOIN lists l ON u.assigned_list_id = l.id JOIN campaigns c ON l.campaign_id = c.id WHERE u.id = ?`).get(user_id) as any;
        if (user?.distrito) {
          const safeDistrito = user.distrito.replace(/'/g, "''");
          cityFilter = `AND (e.distrito = '${safeDistrito}' OR e.ciudad = '${safeDistrito}')`;
        }
      }

      const queryStr = q ? q.toString().trim() : '';
      const isNumber = /^\d+$/.test(queryStr);
      let electors;

      if (isNumber) {
        electors = db.prepare(`
          SELECT e.*, ec.traffic_light, ec.id as capture_id, ec.telefono, ec.needs_transport, ec.lat, ec.lng, ec.coordinator_id, u.nombre as coordinator_name, u.role as coordinator_role
          FROM electors e
          LEFT JOIN elector_captures ec ON e.ci = ec.elector_ci AND ec.is_disputed = 0
          LEFT JOIN users u ON ec.coordinator_id = u.id
          WHERE e.ci = ? ${cityFilter} LIMIT 100
        `).all(queryStr);
      } else {
        const parts = queryStr.split(/\s+/).filter(Boolean);
        if (parts.length >= 2) {
          const p1 = `%${parts[0]}%`, p2 = `%${parts[1]}%`;
          electors = db.prepare(`
            SELECT e.*, ec.traffic_light, ec.id as capture_id, ec.telefono, ec.needs_transport, ec.lat, ec.lng, ec.coordinator_id, u.nombre as coordinator_name, u.role as coordinator_role
            FROM electors e
            LEFT JOIN elector_captures ec ON e.ci = ec.elector_ci AND ec.is_disputed = 0
            LEFT JOIN users u ON ec.coordinator_id = u.id
            WHERE ((e.nombre LIKE ? AND e.apellido LIKE ?) OR (e.nombre LIKE ? AND e.apellido LIKE ?)) ${cityFilter} LIMIT 100
          `).all(p1, p2, p2, p1);
        } else {
          const term = `%${queryStr}%`;
          electors = db.prepare(`
            SELECT e.*, ec.traffic_light, ec.id as capture_id, ec.telefono, ec.needs_transport, ec.lat, ec.lng, ec.coordinator_id, u.nombre as coordinator_name, u.role as coordinator_role
            FROM electors e
            LEFT JOIN elector_captures ec ON e.ci = ec.elector_ci AND ec.is_disputed = 0
            LEFT JOIN users u ON ec.coordinator_id = u.id
            WHERE (e.nombre LIKE ? OR e.apellido LIKE ? OR e.ci LIKE ?) ${cityFilter} LIMIT 100
          `).all(term, term, term);
        }
      }
      res.json((electors as any[]).map(sanitizeElectorData));
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  // ── GET /api/admin/verify-phone/:phone ─────────────────────────────────────
  router.get('/admin/verify-phone/:phone', (req, res) => {
    try {
      const rawPhone = req.params.phone;
      const cleanPhone = rawPhone.includes('@') ? rawPhone.split('@')[0] : rawPhone;
      const hash = normalizePhone(cleanPhone);
      if (!hash) return res.status(400).json({ error: 'Teléfono inválido' });

      const elector = db.prepare(`
        SELECT e.*, ec.traffic_light, ec.needs_transport, ec.lat, ec.lng,
               u.nombre as coordinator_name, u.role as coordinator_role, u.telefono as coordinator_phone,
               p.nombre as parent_name, p.role as parent_role, p.telefono as parent_phone,
               gp.nombre as grandparent_name, gp.role as grandparent_role, gp.telefono as grandparent_phone,
               l.list_number, l.candidate_nombre as candidate_name
        FROM electors e
        JOIN elector_captures ec ON e.ci = ec.elector_ci
        LEFT JOIN users u ON ec.coordinator_id = u.id
        LEFT JOIN users p ON u.parent_id = p.id
        LEFT JOIN users gp ON p.parent_id = gp.id
        LEFT JOIN lists l ON ec.list_id = l.id
        WHERE ec.phone_hash = ? LIMIT 1
      `).get(hash) as any;

      if (elector) return res.json({ type: 'ELECTOR', data: sanitizeElectorData(elector) });

      const user = db.prepare(`
        SELECT u.id, u.username, u.role, u.nombre, u.ci, u.telefono, u.distrito,
               p.nombre as parent_name, p.role as parent_role, p.telefono as parent_phone,
               gp.nombre as grandparent_name, gp.role as grandparent_role, gp.telefono as grandparent_phone
        FROM users u
        LEFT JOIN users p ON u.parent_id = p.id
        LEFT JOIN users gp ON p.parent_id = gp.id
        WHERE u.phone_hash = ? LIMIT 1
      `).get(hash) as any;

      if (user) return res.json({ type: 'USER', data: user });
      res.status(404).json({ error: 'Contacto no identificado' });
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  // ── POST /api/admin/import-padron ───────────────────────────────────────────
  router.post('/admin/import-padron', upload.single('file'), (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'No se subió ningún archivo' });
    const requesterRole = (req.headers['x-user-role'] as string || '').toUpperCase().trim();
    const requesterId = req.headers['x-user-id'] as string;

    if (!['SUPERUSUARIO', 'JEFE_CAMPANA'].includes(requesterRole)) {
      if (req.file) try { fs.unlinkSync(req.file.path); } catch {}
      return res.status(403).json({ error: 'Solo el Superusuario o Jefe de Campaña puede importar padrones.' });
    }

    const { distrito, ciudad } = req.body;
    const finalDistrito = distrito || ciudad;
    if (!finalDistrito) return res.status(400).json({ error: 'Debe especificar el distrito para este padrón' });

    let effectiveCampaignId: number | null = parseInt(req.body.campaign_id) || null;
    if (requesterRole === 'JEFE_CAMPANA' && requesterId) {
      const info = getCachedUserInfo(requesterId);
      effectiveCampaignId = info?.campaign_id ?? null;
    }

    try {
      const workbook = XLSX.readFile(req.file.path);
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as any[][];

      let headerRowIndex = 0;
      for (let r = 0; r < Math.min(rows.length, 20); r++) {
        const row = rows[r];
        if (!row) continue;
        const isHeader = row.some(cell => {
          if (cell === null || cell === undefined) return false;
          const s = cell.toString().toUpperCase().trim().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[º°]/g, "");
          return ['CEDULA', 'CI', 'DOCUMENTO', 'APELLIDO', 'NOMBRE', 'MESA'].includes(s);
        });
        if (isHeader) { headerRowIndex = r; break; }
      }

      const data: any[] = XLSX.utils.sheet_to_json(sheet, { range: headerRowIndex });
      if (data.length === 0) return res.status(400).json({ error: 'El archivo está vacío o tiene un formato incorrecto' });

      const normalizeRow = (row: any) => {
        const n: any = {};
        for (const key in row) {
          const cleanKey = key.toUpperCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[º°]/g, "").trim().replace(/\s+/g, "_").replace(/\./g, "");
          n[cleanKey] = row[key];
        }
        return n;
      };

      const getMesa = (n: any) => parseInt((n['MESA'] || n['NRO_MESA'] || n['NUMERO_MESA'] || n['MESA_NRO'] || n['MESANRO'] || n['MESA_NUM'] || n['MESAS'] || n['NRO_DE_MESA'] || n['NUMERO_DE_MESA'] || n['MESA_DE_VOTACION'] || n['MESAS_NRO'] || n['N_MESA'] || n['N_DE_MESA'] || 0).toString().trim()) || 0;
      const getOrden = (n: any) => parseInt((n['ORD_MESA'] || n['ORDEN'] || n['ORDEN_MESA'] || n['NRO_ORDEN'] || n['ORD'] || n['NROORDEN'] || n['ORDMESA'] || n['NUMERO_ORDEN'] || n['NUM_ORDEN'] || n['NRO_ORD'] || n['N_ORD'] || n['N_ORDEN'] || n['ORD_LOC'] || n['ORD_NAC'] || n['ORDEN_LOCAL'] || n['ORDEN_NACIONAL'] || n['NRO'] || n['N'] || n['LINEA'] || n['POSICION'] || n['POS'] || n['NRO_DE_ORDEN'] || n['ORDEN_DE_MESA'] || n['ORD_DE_MESA'] || n['NROORD'] || n['ORD_MESA_NRO'] || n['ORDEN_MESA_NRO'] || 0).toString().trim()) || 0;

      const insertStmt = db.prepare(`INSERT OR REPLACE INTO electors (ci, nombre, apellido, local_votacion, mesa, orden, distrito, ciudad, campaign_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`);
      db.transaction((rows: any[]) => {
        for (const row of rows) {
          const n = normalizeRow(row);
          const ci = n['CEDULA'] || n['CI'] || n['DOCUMENTO'] || n['NRO_CEDULA'] || n['CEDULA_DE_IDENTIDAD'];
          const nombre = n['NOMBRE'] || n['NOMBRES'];
          const apellido = n['APELLIDO'] || n['APELLIDOS'];
          const local = n['LOCAL'] || n['LOCAL_VOTACION'] || n['LOCAL_DE_VOTACION'] || n['RECINTO'] || n['COLEGIO'];
          if (ci && (nombre || apellido)) {
            insertStmt.run(ci.toString().trim(), nombre || '', apellido || '', local || 'DESCONOCIDO', getMesa(n), getOrden(n), finalDistrito, finalDistrito, effectiveCampaignId);
          }
        }
      })(data);

      db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('padron_last_updated', ?)").run(Date.now().toString());
      clearElectorsCache();
      fs.unlinkSync(req.file.path);

      const actorId = requesterId ? parseInt(requesterId) : 1;
      logAction(actorId, 'IMPORT', 'PADRON', null, `Importados ${data.length} electores para ${finalDistrito} (campaign_id: ${effectiveCampaignId ?? 'global'})`);

      const sample = data.slice(0, 5).map(row => {
        const n = normalizeRow(row);
        return {
          ci: n['CEDULA'] || n['CI'] || n['DOCUMENTO'],
          nombre: n['NOMBRE'] || n['NOMBRES'],
          apellido: n['APELLIDO'] || n['APELLIDOS'],
          mesa: getMesa(n), orden: getOrden(n)
        };
      });

      res.json({ success: true, count: data.length, campaign_id: effectiveCampaignId, sample });
    } catch (err: any) {
      if (req.file) try { fs.unlinkSync(req.file.path); } catch {}
      res.status(500).json({ error: err.message });
    }
  });

  // ── GET /api/admin/disputes/global ─────────────────────────────────────────
  router.get('/admin/disputes/global', (req, res) => {
    const role = getRole(req);
    if (role !== 'SUPERUSUARIO') return res.status(403).json({ error: 'Acceso denegado' });
    try {
      const sec = getSecurityFilter(req, 'e');
      const disputes = db.prepare(`
        SELECT
          COALESCE(e.ci, ec.elector_ci) as ci,
          COALESCE(e.nombre, 'ELECTOR') as nombre,
          COALESCE(e.apellido, 'NO REGISTRADO') as apellido,
          COALESCE(e.local_votacion, 'REGISTRO DE CAMPO') as local_votacion,
          GROUP_CONCAT('Lista ' || l.list_number || ' (' || u.nombre || ')|' || ec.lat || '|' || ec.lng) as details,
          COUNT(DISTINCT ec.list_id) as list_count
        FROM elector_captures ec
        LEFT JOIN electors e ON ec.elector_ci = e.ci
        JOIN lists l ON ec.list_id = l.id
        JOIN users u ON ec.coordinator_id = u.id
        WHERE 1=1 ${sec.sql}
        GROUP BY COALESCE(e.ci, ec.elector_ci)
        HAVING list_count > 1
      `).all(...sec.params);
      res.json(disputes);
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  // ── POST /api/admin/system/wipe-captures ───────────────────────────────────
  router.post('/admin/system/wipe-captures', (req, res) => {
    const { key, distrito } = req.body;
    const masterKeyFromDb = db.prepare("SELECT value FROM settings WHERE key = 'master_key'").get() as any;
    if (key !== masterKeyFromDb?.value) return res.status(401).json({ error: 'Llave Maestra inválida' });

    try {
      db.transaction(() => {
        if (!distrito || distrito === 'ALL') {
          db.prepare('DELETE FROM elector_captures').run();
          db.prepare('DELETE FROM capture_conflicts').run();
          db.prepare('DELETE FROM field_requests').run();
          db.prepare('DELETE FROM participation_logs').run();
          db.prepare('DELETE FROM acta_results').run();
          db.prepare('DELETE FROM results').run();
          logAction(1, 'SYSTEM_WIPE', 'GLOBAL', null, 'Performed a master wipe of all system data');
        } else {
          const electorsInDistrito = db.prepare('SELECT ci FROM electors WHERE ciudad = ? OR distrito = ?').all(distrito, distrito) as any[];
          if (electorsInDistrito.length > 0) {
            const ciList = electorsInDistrito.map((e: any) => e.ci);
            const ph = ciList.map(() => '?').join(',');
            db.prepare(`DELETE FROM elector_captures WHERE elector_ci IN (${ph})`).run(...ciList);
            db.prepare(`DELETE FROM capture_conflicts WHERE elector_ci IN (${ph})`).run(...ciList);
          }
          const locationsInDistrito = db.prepare('SELECT nombre FROM voting_locations WHERE distrito = ?').all(distrito) as any[];
          if (locationsInDistrito.length > 0) {
            const locList = locationsInDistrito.map((l: any) => l.nombre);
            const phL = locList.map(() => '?').join(',');
            db.prepare(`DELETE FROM participation_logs WHERE local_votacion IN (${phL})`).run(...locList);
            db.prepare(`DELETE FROM results WHERE local_votacion IN (${phL})`).run(...locList);
            db.prepare(`DELETE FROM acta_results WHERE acta_id NOT IN (SELECT id FROM results)`).run();
          }
          logAction(1, 'SYSTEM_WIPE', 'DISTRICT', null, `Performed a wipe for district: ${distrito}`);
        }
      })();

      clearElectorsCache();
      invalidateAllReportsCaches();
      res.json({ success: true, message: distrito && distrito !== 'ALL' ? `Datos del distrito ${distrito} purgados` : 'Sistema purgado globalmente' });
    } catch (err: any) {
      console.error('[WIPE ERROR]', err);
      res.status(500).json({ error: err.message });
    }
  });

  router.post('/admin/users/:id/reset-password', (req, res) => {
    const requesterRole = (req.headers['x-user-role'] as string || '').toUpperCase().trim();
    if (requesterRole !== 'SUPERUSUARIO' && requesterRole !== 'SUPER_ADMIN') {
      return res.status(403).json({ error: 'No tienes permisos para resetear contraseñas.' });
    }
    try {
      const user = db.prepare('SELECT username FROM users WHERE id = ?').get(req.params.id) as any;
      if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });
      db.prepare('UPDATE users SET password = ?, needs_password_change = 1 WHERE id = ?').run(user.username, req.params.id);
      res.json({ success: true, message: `Contraseña reseteada. El usuario debe ingresar con su nombre de usuario (${user.username}) y cambiarla.` });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  return router;
}
