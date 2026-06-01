import { Router } from 'express';
import * as XLSX from 'xlsx';
import db from '../db';
import { dbGetAsync, dbQueryAsync } from '../db-async';
import { cacheService } from '../services/cache';
import {
  getRole, getSecurityFilter, getListId, getDistrict, getTenant, requireRole
} from './helpers';
import { commandStatsCache, logAction } from '../server';

let _districtsCache: { data: string[], ts: number } | null = null;
const DISTRICTS_CACHE_TTL = 600_000;

export default function statsRoutes() {
  const router = Router();

  // ── GET /api/stats/neighborhoods ───────────────────────────────────────────
  router.get('/stats/neighborhoods', (req, res) => {
    const tenant_id = getTenant(req);
    const stats = db.prepare(`
      SELECT
        e.barrio,
        e.local_votacion,
        COUNT(e.ci) as total,
        SUM(CASE WHEN te.status = 'Visitado' THEN 1 ELSE 0 END) as visited,
        SUM(CASE WHEN te.needs_transport = 1 THEN 1 ELSE 0 END) as transport_needed
      FROM electors e
      LEFT JOIN tenant_electors te ON e.ci = te.elector_ci AND te.tenant_id = ?
      GROUP BY e.barrio, e.local_votacion
    `).all(tenant_id);
    res.json(stats);
  });

  // ── GET /api/stats/results ──────────────────────────────────────────────────
  router.get('/stats/results', (req, res) => {
    const tenant_id = getTenant(req);
    const totals = db.prepare(`
      SELECT
        SUM(votos_nuestro) as nuestro,
        SUM(votos_oponente_1) as oponente_1,
        SUM(votos_oponente_2) as oponente_2,
        SUM(votos_otros) as otros,
        SUM(votos_nulos) as nulos,
        SUM(votos_blancos) as blancos,
        COUNT(id) as mesas_escrutadas
      FROM results WHERE tenant_id = ?
    `).get(tenant_id);
    res.json(totals);
  });

  // ── GET /api/stats/summary ──────────────────────────────────────────────────
  router.get('/stats/summary', async (req, res) => {
    try {
      const secU = getSecurityFilter(req, 'u');
      const secC = getSecurityFilter(req, 'c');
      const secL = getSecurityFilter(req, 'l');
      const secE = getSecurityFilter(req, 'e');
      const secEC = getSecurityFilter(req, 'ec');

      const campId = req.query.campaign_id;
      const cid = campId && !isNaN(parseInt(campId as string)) ? parseInt(campId as string) : null;

      let campFilterU = '', campFilterC = '', campFilterL = '', campFilterE = '', campFilterEC = '';
      const paramsU = [...(secU.params || [])];
      const paramsC = [...(secC.params || [])];
      const paramsL = [...(secL.params || [])];
      const paramsE = [...(secE.params || [])];
      const paramsEC = [...(secEC.params || [])];

      if (cid !== null) {
        campFilterU = ' AND u.assigned_campaign_id = ?'; paramsU.push(cid);
        campFilterC = ' AND c.id = ?'; paramsC.push(cid);
        campFilterL = ' AND l.campaign_id = ?'; paramsL.push(cid);
        campFilterE = ' AND e.campaign_id = ?'; paramsE.push(cid);
        campFilterEC = ' AND ec.campaign_id = ?'; paramsEC.push(cid);
      }

      const usersCount = db.prepare(`SELECT COUNT(*) as count FROM users u WHERE 1=1 ${secU.sql}${campFilterU}`).get(...paramsU) as any;
      const campaignsCount = db.prepare(`SELECT COUNT(*) as count FROM campaigns c WHERE 1=1 ${secC.sql}${campFilterC}`).get(...paramsC) as any;
      const listsCount = db.prepare(`SELECT COUNT(*) as count FROM lists l WHERE 1=1 ${secL.sql}${campFilterL}`).get(...paramsL) as any;

      const cacheKey = JSON.stringify({ sql: secE.sql + campFilterE, params: paramsE });
      const cachedE = await cacheService.get<number>(`electors:count:${cacheKey}`);
      let electorsCountVal = 0;
      if (cachedE !== null) {
        electorsCountVal = cachedE;
      } else {
        const r = db.prepare(`SELECT COUNT(*) as count FROM electors e WHERE 1=1 ${secE.sql}${campFilterE}`).get(...paramsE) as any;
        electorsCountVal = r?.count || 0;
        await cacheService.set(`electors:count:${cacheKey}`, electorsCountVal, 300);
      }

      let query = `
        SELECT
          COUNT(*) as captures,
          SUM(CASE WHEN ec.needs_transport = 1 THEN 1 ELSE 0 END) as transportNeeded,
          SUM(CASE WHEN ec.needs_transport = 1 AND ec.assigned_vehicle_id IS NOT NULL THEN 1 ELSE 0 END) as transportAssigned,
          SUM(CASE WHEN ec.traffic_light = 'GREEN' THEN 1 ELSE 0 END) as green,
          SUM(CASE WHEN ec.traffic_light = 'YELLOW' THEN 1 ELSE 0 END) as yellow,
          SUM(CASE WHEN ec.traffic_light = 'RED' THEN 1 ELSE 0 END) as red,
          SUM(CASE WHEN ec.traffic_light = 'PURPLE' THEN 1 ELSE 0 END) as purple
        FROM elector_captures ec
      `;

      if (secEC.sql.includes('e.ciudad') || secEC.sql.includes('e.distrito') || secEC.sql.includes('e.ci')) {
        query += ` LEFT JOIN electors e ON ec.elector_ci = e.ci WHERE 1=1 ${secEC.sql}`;
      } else {
        query += ` WHERE 1=1 ${secEC.sql.replace(/\be\./g, 'ec.')}`;
      }
      query += campFilterEC;

      const capturesStats = db.prepare(query).get(...paramsEC) as any;

      res.json({
        users: usersCount.count, campaigns: campaignsCount.count, lists: listsCount.count,
        electors: electorsCountVal,
        captures: capturesStats?.captures || 0,
        transportNeeded: capturesStats?.transportNeeded || 0,
        transportAssigned: capturesStats?.transportAssigned || 0,
        green: capturesStats?.green || 0, yellow: capturesStats?.yellow || 0,
        red: capturesStats?.red || 0, purple: capturesStats?.purple || 0
      });
    } catch (err: any) {
      console.error('[STATS ERROR]', err);
      res.status(500).json({ error: err.message });
    }
  });

  // ── GET /api/stats/predictions ─────────────────────────────────────────────
  router.get('/stats/predictions', (req, res) => {
    try {
      const totalCaptures = db.prepare('SELECT COUNT(*) as count FROM elector_captures').get() as any;
      const lastHour = db.prepare("SELECT COUNT(*) as count FROM elector_captures WHERE timestamp >= datetime('now', '-1 hour')").get() as any;
      const prevHour = db.prepare("SELECT COUNT(*) as count FROM elector_captures WHERE timestamp >= datetime('now', '-2 hour') AND timestamp < datetime('now', '-1 hour')").get() as any;
      const velocity = lastHour.count || 0;
      const trend = velocity >= (prevHour.count || 0) ? 'up' : 'down';
      const settings = db.prepare("SELECT value FROM settings WHERE key = 'election_end_time'").get() as any;
      const endTime = settings?.value || '17:00';
      const [hours, minutes] = endTime.split(':').map(Number);
      const now = new Date();
      const close = new Date();
      close.setHours(hours, minutes, 0, 0);
      const remainingHours = Math.max(0, (close.getTime() - now.getTime()) / (1000 * 60 * 60));
      const projectedTotal = Math.round((totalCaptures.count || 0) + (velocity * remainingHours));
      res.json({ velocity, trend, projected_total: projectedTotal });
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  // ── GET /api/stats/command ──────────────────────────────────────────────────
  router.get('/stats/command', async (req, res) => {
    const list_id = getListId(req);
    const local_id = (req.query.localId as string) || '';
    const role = getRole(req);
    const isPadrino = role === 'PADRINO';
    const requesterId = req.headers['x-user-id'];
    const sec = getSecurityFilter(req, 'e');
    const secL = getSecurityFilter(req, 'l');
    const secLoc = getSecurityFilter(req, 'loc');
    const district = getDistrict(req);
    const cacheKey = `${requesterId || 'global'}_${list_id || ''}_${local_id || ''}_${district || 'all'}`;
    const cached = await commandStatsCache.get(cacheKey);
    if (cached) return res.json(cached);

    let globalGoal = 1000;
    if (list_id && !isNaN(list_id)) {
      const listGoalRow = await dbGetAsync<any>(`SELECT goal FROM lists WHERE id = ?`, [list_id]);
      globalGoal = listGoalRow?.goal || 1000;
    } else {
      const listsGoal = await dbGetAsync<any>(`SELECT SUM(goal) as total FROM lists l WHERE 1=1 ${secL.sql}`, secL.params);
      const dbGoalSetting = await dbGetAsync<any>("SELECT value FROM settings WHERE key = 'goal'", []);
      globalGoal = Math.max(1, parseInt(listsGoal?.total || '0') || parseInt(dbGoalSetting?.value || '1000'));
    }

    console.time(`STATS_COMMAND_${requesterId}`);
    try {
      let listFilterSql = ''; const listFilterParams: any[] = [];
      if (list_id && !isNaN(list_id) && role !== 'JEFE_CAMPANA') {
        listFilterSql = 'AND ec.list_id = ?'; listFilterParams.push(list_id);
      }

      let localFilterSql = ''; const localFilterParams: any[] = [];
      if (local_id && local_id !== 'null' && local_id !== 'undefined') {
        localFilterSql = 'AND e.local_votacion = (SELECT nombre FROM voting_locations WHERE cod_local = ?)';
        localFilterParams.push(local_id);
      }

      let hierarchyFilterSql = ''; const hierarchyFilterParams: any[] = [];
      if (isPadrino) {
        const userId = parseInt(req.headers['x-user-id'] as string);
        if (!isNaN(userId)) { hierarchyFilterSql = 'AND (u.parent_id = ? OR u.id = ?)'; hierarchyFilterParams.push(userId, userId); }
      } else if (role === 'COORDINADOR') {
        const userId = parseInt(req.headers['x-user-id'] as string);
        if (!isNaN(userId)) { hierarchyFilterSql = 'AND ec.coordinator_id = ?'; hierarchyFilterParams.push(userId); }
      }

      const captureParams = [...(sec.params || []), ...listFilterParams, ...localFilterParams, ...hierarchyFilterParams];
      const captureJoins = `
        FROM elector_captures ec
        LEFT JOIN electors e ON ec.elector_ci = e.ci
        LEFT JOIN users u ON ec.coordinator_id = u.id
        LEFT JOIN lists l ON ec.list_id = l.id
        LEFT JOIN campaigns c ON l.campaign_id = c.id
      `;
      const captureWhere = `WHERE ec.is_disputed = 0 ${sec.sql} ${listFilterSql} ${localFilterSql} ${hierarchyFilterSql}`;

      const stats = await dbQueryAsync<any>(`SELECT traffic_light, COUNT(*) as count ${captureJoins} ${captureWhere} GROUP BY traffic_light`, captureParams);
      const totalCaptures = await dbGetAsync<any>(`SELECT COUNT(*) as count ${captureJoins} ${captureWhere}`, captureParams);

      const secElectors = getSecurityFilter(req, 'e');
      const electorParams = [...(secElectors.params || []), ...localFilterParams];

      const cacheKeyTotal = JSON.stringify({ sql: secElectors.sql, params: secElectors.params, localFilterSql, localFilterParams });
      let totalEl = 0;
      const cachedTotal = await cacheService.get<number>(`electors:total:${cacheKeyTotal}`);
      if (cachedTotal !== null) {
        totalEl = cachedTotal;
      } else {
        const elRes = await dbGetAsync<any>(`SELECT COUNT(*) as count FROM electors e WHERE 1=1 ${localFilterSql} ${secElectors.sql}`, electorParams);
        totalEl = elRes?.count || 0;
        await cacheService.set(`electors:total:${cacheKeyTotal}`, totalEl, 300);
      }

      const cacheKeyByLocal = JSON.stringify({ sql: secElectors.sql, params: secElectors.params });
      let electorCountsMap = new Map<string, number>();
      const cachedByLocal = await cacheService.get<Record<string, number>>(`electors:local:${cacheKeyByLocal}`);
      if (cachedByLocal !== null) {
        electorCountsMap = new Map(Object.entries(cachedByLocal));
      } else {
        const rows = await dbQueryAsync<{ local_votacion: string; total: number }>(
          `SELECT local_votacion, COUNT(*) as total FROM electors e WHERE 1=1 ${secElectors.sql} GROUP BY local_votacion`,
          secElectors.params
        );
        const newMap = new Map<string, number>();
        rows.forEach(r => { if (r.local_votacion) newMap.set(r.local_votacion.toUpperCase().trim(), r.total); });
        electorCountsMap = newMap;
        await cacheService.set(`electors:local:${cacheKeyByLocal}`, Object.fromEntries(newMap), 300);
      }

      const capturesQuery = `
        SELECT COALESCE(e.local_votacion, 'REGISTRO DE CAMPO') as local_votacion,
          COUNT(ec.id) as total,
          SUM(CASE WHEN ec.traffic_light = 'GREEN' THEN 1 ELSE 0 END) as green
        FROM elector_captures ec
        LEFT JOIN electors e ON ec.elector_ci = e.ci
        LEFT JOIN users u ON ec.coordinator_id = u.id
        LEFT JOIN lists l ON ec.list_id = l.id
        LEFT JOIN campaigns c ON l.campaign_id = c.id
        WHERE ec.is_disputed = 0 ${sec.sql} ${listFilterSql} ${hierarchyFilterSql}
        GROUP BY COALESCE(e.local_votacion, 'REGISTRO DE CAMPO')
      `;
      const liveCapturesList = await dbQueryAsync<any>(capturesQuery, [...(sec.params || []), ...listFilterParams, ...hierarchyFilterParams]);

      const capturesMap = new Map<string, { total: number; green: number }>();
      liveCapturesList.forEach(c => {
        if (c.local_votacion) capturesMap.set(c.local_votacion.toUpperCase().trim(), { total: c.total, green: c.green || 0 });
      });

      const locations = await dbQueryAsync<any>(`SELECT cod_local, nombre FROM voting_locations loc WHERE 1=1 ${secLoc.sql}`, secLoc.params || []);
      const locationStats = locations.map(loc => {
        const nameKey = (loc.nombre || '').toUpperCase().trim();
        const total_electors = electorCountsMap.get(nameKey) || 0;
        const capInfo = capturesMap.get(nameKey) || { total: 0, green: 0 };
        return { cod_local: loc.cod_local, nombre: loc.nombre, total_electors, total_captures: capInfo.total, green_captures: capInfo.green };
      });

      const transportNeeded = await dbGetAsync<any>(`SELECT COUNT(*) as count ${captureJoins} ${captureWhere} AND ec.needs_transport = 1`, captureParams);
      const totalCap = totalCaptures?.count || 0;

      const responseData = {
        green:   stats.find(s => s.traffic_light === 'GREEN')?.count  || 0,
        yellow:  stats.find(s => s.traffic_light === 'YELLOW')?.count || 0,
        red:     stats.find(s => s.traffic_light === 'RED')?.count    || 0,
        purple:  stats.find(s => s.traffic_light === 'PURPLE')?.count || 0,
        transport_needed: transportNeeded?.count || 0,
        total_captures: totalCap, total_electors: totalEl,
        campaign_goal: globalGoal,
        percentage: totalEl > 0 ? ((totalCap / totalEl) * 100).toFixed(1) : '0',
        locations: locationStats.map(loc => ({
          ...loc,
          percentage: loc.total_electors > 0 ? ((loc.total_captures / loc.total_electors) * 100).toFixed(1) : '0',
        })),
      };

      await commandStatsCache.set(cacheKey, responseData);
      res.json(responseData);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    } finally {
      console.timeEnd(`STATS_COMMAND_${requesterId}`);
    }
  });

  // ── GET /api/audit/logs ─────────────────────────────────────────────────────
  router.get('/audit/logs', (req, res) => {
    const { action, user_id, start_date, end_date } = req.query;
    try {
      const sec = getSecurityFilter(req, 'u');
      let query = `SELECT a.*, u.username, u.distrito as user_district FROM audit_logs a LEFT JOIN users u ON a.user_id = u.id WHERE 1=1 ${sec.sql}`;
      const params: any[] = [...sec.params];
      if (action) { query += ` AND a.action = ?`; params.push(action); }
      if (user_id) { query += ` AND a.user_id = ?`; params.push(user_id); }
      if (start_date) { query += ` AND a.timestamp >= ?`; params.push(`${start_date} 00:00:00`); }
      if (end_date) { query += ` AND a.timestamp <= ?`; params.push(`${end_date} 23:59:59`); }
      query += ` ORDER BY a.timestamp DESC LIMIT 100`;
      res.json(db.prepare(query).all(...params));
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  // ── GET /api/audit/stats ────────────────────────────────────────────────────
  router.get('/audit/stats', (req, res) => {
    try {
      const totalActions = db.prepare('SELECT COUNT(*) as count FROM audit_logs').get() as any;
      const topUsers = db.prepare(`SELECT u.username, COUNT(a.id) as actions FROM audit_logs a JOIN users u ON a.user_id = u.id GROUP BY u.id ORDER BY actions DESC LIMIT 5`).all();
      const actionTypes = db.prepare(`SELECT action, COUNT(*) as count FROM audit_logs a GROUP BY action`).all();
      res.json({ total: totalActions.count, topUsers, actionTypes });
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  // ── GET /api/audit/export ───────────────────────────────────────────────────
  router.get('/audit/export', (req, res) => {
    const page = parseInt(req.query.page as string);
    if (isNaN(page) || page < 1) return res.status(400).json({ error: 'La paginación es obligatoria. Especifique el parámetro "page".' });
    const perPage = Math.min(parseInt(req.query.perPage as string) || 1000, 5000);
    const offset = (page - 1) * perPage;
    try {
      const logs = db.prepare(`SELECT a.timestamp, u.username, a.action, a.details FROM audit_logs a LEFT JOIN users u ON a.user_id = u.id ORDER BY a.timestamp DESC LIMIT ? OFFSET ?`).all(perPage, offset) as any[];
      let csv = '﻿Date,User,Action,Details\n';
      logs.forEach(log => {
        csv += `"${log.timestamp}","${log.username || 'System'}","${log.action}","${log.details?.replace(/"/g, '""')}"\n`;
      });
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename=auditoria_pagina_${page}.csv`);
      res.status(200).send(csv);
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  // ── GET /api/reports/export/xlsx ───────────────────────────────────────────
  router.get('/reports/export/xlsx', requireRole('SUPERUSUARIO', 'JEFE_CAMPANA', 'PADRINO', 'SUBJEFE'), (req, res) => {
    const columnsParam = req.query.columns as string;
    const districtParam = req.query.district as string;
    const trafficLightParam = req.query.traffic_light as string;
    const idsParam = req.query.ids as string;
    const listNumParam = req.query.list_number as string;
    const sec = getSecurityFilter(req, 'u');
    let whereClauses = ['1=1'];
    let params: any[] = [];

    if (sec.sql) { whereClauses.push(sec.sql.replace(' AND ', '')); params.push(...sec.params); }
    if (districtParam && districtParam !== 'ALL' && districtParam !== 'GLOBAL') {
      whereClauses.push('(UPPER(e.distrito) = UPPER(?) OR UPPER(u.distrito) = UPPER(?))');
      params.push(districtParam, districtParam);
    }
    if (trafficLightParam && trafficLightParam !== 'ALL') { whereClauses.push('ec.traffic_light = ?'); params.push(trafficLightParam); }
    if (listNumParam && listNumParam !== 'ALL') { whereClauses.push('l.list_number = ?'); params.push(listNumParam); }
    if (idsParam) {
      const ids = idsParam.split(',').map(id => parseInt(id)).filter(id => !isNaN(id));
      if (ids.length > 0) { whereClauses.push(`ec.id IN (${ids.map(() => '?').join(',')})`); params.push(...ids); }
    }

    try {
      const rows = db.prepare(`
        SELECT
          ec.id, COALESCE(e.nombre, 'ELECTOR') as nombre, COALESCE(e.apellido, 'NO REGISTRADO') as apellido,
          ec.elector_ci as ci, ec.telefono, ec.traffic_light as semaforo,
          (CASE WHEN ec.needs_transport = 1 THEN 'SI' ELSE 'NO' END) as transporte,
          COALESCE(u.nombre, '—') as coordinador, COALESCE(p.nombre, '—') as referente,
          COALESCE(e.local_votacion, 'REGISTRO DE CAMPO') as local,
          COALESCE(e.mesa, 0) as mesa, COALESCE(e.orden, 0) as orden,
          COALESCE(e.ciudad, '—') as ciudad, COALESCE(e.distrito, '—') as distrito
        FROM elector_captures ec
        LEFT JOIN electors e ON ec.elector_ci = e.ci
        LEFT JOIN users u ON ec.coordinator_id = u.id
        LEFT JOIN users p ON u.parent_id = p.id
        LEFT JOIN lists l ON ec.list_id = l.id
        WHERE ${whereClauses.join(' AND ')}
        ORDER BY ec.timestamp DESC
      `).all(...params) as any[];

      const defaultColumns = [
        { key: 'nombre', header: 'Nombre' }, { key: 'apellido', header: 'Apellido' },
        { key: 'ci', header: 'C.I.' }, { key: 'telefono', header: 'Teléfono' },
        { key: 'semaforo', header: 'Semáforo' }, { key: 'transporte', header: '¿Transporte?' },
        { key: 'coordinador', header: 'Coordinador' }, { key: 'referente', header: 'Referente/Padrino' },
        { key: 'local', header: 'Local de Votación' }, { key: 'mesa', header: 'Mesa' },
        { key: 'orden', header: 'Orden' }, { key: 'ciudad', header: 'Ciudad' }, { key: 'distrito', header: 'Distrito' }
      ];

      let columnsToExport = defaultColumns;
      if (columnsParam) {
        const selectedKeys = columnsParam.split(',');
        columnsToExport = defaultColumns.filter(c => selectedKeys.includes(c.key));
      }

      const sheetData = rows.map(row => {
        const formatted: any = {};
        columnsToExport.forEach(col => { formatted[col.header] = row[col.key]; });
        return formatted;
      });

      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet(sheetData);
      XLSX.utils.book_append_sheet(wb, ws, 'Capturas');
      const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', 'attachment; filename=reporte_capturas.xlsx');
      res.end(buffer);
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  // ── GET /api/admin/electors/stats ──────────────────────────────────────────
  router.get('/admin/electors/stats', (req, res) => {
    try {
      const stats = db.prepare(`
        SELECT UPPER(TRIM(COALESCE(NULLIF(ciudad, ''), NULLIF(distrito, ''), 'Sin Asignar'))) as ciudad, COUNT(*) as count
        FROM electors GROUP BY 1 ORDER BY 2 DESC
      `).all();
      res.json(stats);
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  // ── GET /api/districts/global ───────────────────────────────────────────────
  router.get('/districts/global', (req, res) => {
    const now = Date.now();
    if (_districtsCache && (now - _districtsCache.ts < DISTRICTS_CACHE_TTL)) {
      return res.json(_districtsCache.data);
    }
    try {
      const districts = db.prepare(`
        SELECT DISTINCT UPPER(TRIM(distrito)) as name FROM campaigns WHERE distrito IS NOT NULL AND distrito != ''
        UNION SELECT DISTINCT UPPER(TRIM(ciudad)) as name FROM lists WHERE ciudad IS NOT NULL AND ciudad != ''
        UNION SELECT DISTINCT UPPER(TRIM(distrito)) as name FROM voting_locations WHERE distrito IS NOT NULL AND distrito != ''
        UNION SELECT DISTINCT UPPER(TRIM(ciudad)) as name FROM electors WHERE ciudad IS NOT NULL AND ciudad != ''
        UNION SELECT DISTINCT UPPER(TRIM(distrito)) as name FROM electors WHERE distrito IS NOT NULL AND distrito != ''
      `).all() as any[];
      const data = districts.map((d: any) => d.name).sort();
      _districtsCache = { data, ts: now };
      res.json(data);
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  return router;
}
