import { Router } from 'express';
import db from '../db';
import { getListId, getDistrict, getSecurityFilter, sanitizeElectorData, requireRole } from './helpers';
import { logAction } from '../server';

export default function logisticsRoutes() {
  const router = Router();

  // ── GET /api/logistics/stats ────────────────────────────────────────────────
  router.get('/stats', (req, res) => {
    const list_id = getListId(req);
    try {
      const filterSql = list_id && !isNaN(list_id) ? 'AND ec.list_id = ?' : '';
      const filterParams = list_id && !isNaN(list_id) ? [list_id] : [];
      const district = getDistrict(req);

      const statsParams = [...filterParams, ...(district ? [district, district] : [])];
      const stats = db.prepare(`
        SELECT
          COUNT(*) as total_requests,
          SUM(CASE WHEN ec.assigned_vehicle_id IS NOT NULL THEN 1 ELSE 0 END) as assigned,
          SUM(CASE WHEN COALESCE(e.is_priority, 0) = 1 THEN 1 ELSE 0 END) as priority
        FROM elector_captures ec
        LEFT JOIN electors e ON ec.elector_ci = e.ci
        WHERE ec.needs_transport = 1 ${filterSql} ${district ? "AND (UPPER(COALESCE(e.ciudad, '')) = UPPER(?) OR UPPER(COALESCE(e.distrito, '')) = UPPER(?))" : ''}
      `).get(statsParams) as any;

      const fleetParams = [...filterParams, ...(district ? [district, district] : [])];
      const fleet = db.prepare(`
        SELECT
          COUNT(*) as total_vehicles,
          SUM(CASE WHEN status = 'AVAILABLE' THEN 1 ELSE 0 END) as available
        FROM vehicles WHERE 1=1
        ${list_id && !isNaN(list_id) ? ' AND assigned_list_id = ?' : ''}
        ${district ? ' AND (UPPER(COALESCE(distrito, \'\')) = UPPER(?) OR UPPER(COALESCE(ciudad, \'\')) = UPPER(?))' : ''}
      `).get(fleetParams) as any;

      res.json({ ...stats, ...fleet });
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  // ── GET /api/logistics/clusters ─────────────────────────────────────────────
  router.get('/clusters', (req, res) => {
    const list_id = getListId(req);
    const filterSql = list_id && !isNaN(list_id) ? 'AND ec.list_id = ?' : '';
    const filterParams = list_id && !isNaN(list_id) ? [list_id] : [];
    try {
      const clusters = db.prepare(`
        SELECT
          COALESCE(NULLIF(e.barrio, ''), e.local_votacion, 'Sin Barrio') as barrio,
          COUNT(ec.id) as count,
          AVG(ec.lat) as lat,
          AVG(ec.lng) as lng
        FROM elector_captures ec
        LEFT JOIN electors e ON ec.elector_ci = e.ci
        WHERE ec.needs_transport = 1 AND ec.assigned_vehicle_id IS NULL ${filterSql}
        GROUP BY COALESCE(NULLIF(e.barrio, ''), e.local_votacion, 'Sin Barrio')
      `).all(...filterParams);
      res.json(clusters);
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  // ── GET /api/logistics/pending ──────────────────────────────────────────────
  router.get('/pending', (req, res) => {
    const sec = getSecurityFilter(req, 'ec');
    try {
      const pending = db.prepare(`
        SELECT ec.*,
          COALESCE(e.nombre, 'ELECTOR') as nombre,
          COALESCE(e.apellido, 'NO REGISTRADO') as apellido,
          COALESCE(e.local_votacion, 'REGISTRO DE CAMPO') as local_votacion,
          COALESCE(NULLIF(e.barrio, ''), 'REGISTRO DE CAMPO') as barrio,
          COALESCE(e.is_priority, 0) as is_priority,
          u.nombre as coordinator_name
        FROM elector_captures ec
        LEFT JOIN electors e ON ec.elector_ci = e.ci
        LEFT JOIN users u ON ec.coordinator_id = u.id
        WHERE ec.needs_transport = 1
          AND ec.assigned_vehicle_id IS NULL
          AND ec.transport_status != 'COMPLETED'
          ${sec.sql}
        ORDER BY COALESCE(e.is_priority, 0) DESC, ec.timestamp ASC
      `).all(...sec.params);
      res.json(pending);
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  // ── POST /api/logistics/assign ──────────────────────────────────────────────
  router.post('/assign', (req, res) => {
    const { capture_id, vehicle_id } = req.body;
    if (capture_id === undefined || capture_id === null || isNaN(Number(capture_id))) return res.status(400).json({ error: 'capture_id debe ser un número' });
    if (vehicle_id === undefined || vehicle_id === null || isNaN(Number(vehicle_id))) return res.status(400).json({ error: 'vehicle_id debe ser un número' });
    try {
      db.prepare("UPDATE elector_captures SET assigned_vehicle_id = ?, transport_status = 'PENDING' WHERE id = ?").run(vehicle_id, capture_id);
      logAction(1, 'ASSIGN_TRANSPORT', 'CAPTURE', capture_id, `Assigned vehicle ${vehicle_id} to capture ${capture_id}`);
      res.json({ success: true });
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  // ── POST /api/logistics/complete-trip ──────────────────────────────────────
  router.post('/complete-trip', (req, res) => {
    const { vehicle_id } = req.body;
    try {
      db.prepare("UPDATE elector_captures SET transport_status = 'COMPLETED' WHERE assigned_vehicle_id = ? AND transport_status = 'IN_TRANSIT'").run(vehicle_id);
      logAction(1, 'COMPLETE_TRIP', 'VEHICLE', vehicle_id, `Marked trip completed for vehicle ${vehicle_id}`);
      res.json({ success: true });
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  // ── PUT /api/logistics/passenger/:capture_id/status ────────────────────────
  router.put('/passenger/:capture_id/status', (req, res) => {
    const { capture_id } = req.params;
    const { status } = req.body;
    try {
      db.prepare("UPDATE elector_captures SET transport_status = ? WHERE id = ?").run(status, capture_id);
      logAction(1, 'UPDATE_PASSENGER_TRANSPORT', 'CAPTURE', capture_id, `Updated passenger ${capture_id} transport status to ${status}`);
      res.json({ success: true });
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  return router;
}

export function vehiclesRoutes() {
  const router = Router();

  // ── GET /api/vehicles ───────────────────────────────────────────────────────
  router.get('/', (req, res) => {
    try {
      const vehicles = db.prepare(`
        SELECT v.*, u.nombre as coordinator_name, u.photo_url as coordinator_photo,
               u.telefono as coordinator_phone, u.distrito as coordinator_distrito, l.list_number,
               (SELECT COUNT(*) FROM elector_captures WHERE assigned_vehicle_id = v.id AND transport_status != 'COMPLETED') as current_passengers,
               (SELECT GROUP_CONCAT(COALESCE(e.nombre, 'ELECTOR') || ' ' || COALESCE(e.apellido, 'NO REGISTRADO'), ', ')
                FROM elector_captures ec LEFT JOIN electors e ON ec.elector_ci = e.ci
                WHERE ec.assigned_vehicle_id = v.id AND ec.transport_status = 'IN_TRANSIT') as passengers_in_transit,
               (SELECT GROUP_CONCAT(COALESCE(e.nombre, 'ELECTOR') || ' ' || COALESCE(e.apellido, 'NO REGISTRADO'), ', ')
                FROM elector_captures ec LEFT JOIN electors e ON ec.elector_ci = e.ci
                WHERE ec.assigned_vehicle_id = v.id AND ec.transport_status = 'PENDING') as passengers_pending
        FROM vehicles v
        LEFT JOIN users u ON v.assigned_user_id = u.id
        LEFT JOIN lists l ON u.assigned_list_id = l.id
      `).all();
      res.json(vehicles);
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  // ── POST /api/vehicles ──────────────────────────────────────────────────────
  router.post('/', (req, res) => {
    const { description, driver_name, driver_phone, assigned_user_id, driver_ci, capacity, status, type, plate } = req.body;
    if (!plate) return res.status(400).json({ error: 'plate es requerido' });
    if (!driver_name) return res.status(400).json({ error: 'driver_name es requerido' });
    if (!driver_phone) return res.status(400).json({ error: 'driver_phone es requerido' });
    if (capacity === undefined || capacity === null || isNaN(Number(capacity))) return res.status(400).json({ error: 'capacity debe ser un número' });
    try {
      const result = db.prepare(`
        INSERT INTO vehicles (description, driver_name, driver_phone, assigned_user_id, driver_ci, capacity, status, type, plate)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(description, driver_name, driver_phone, assigned_user_id || null, driver_ci, capacity || 4, status || 'AVAILABLE', type, plate);
      res.json({ id: Number(result.lastInsertRowid) });
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  // ── DELETE /api/vehicles/:id ────────────────────────────────────────────────
  router.delete('/:id', (req, res) => {
    try {
      db.prepare('DELETE FROM vehicles WHERE id = ?').run(req.params.id);
      res.json({ success: true });
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  // ── PUT /api/vehicles/:id/status ────────────────────────────────────────────
  router.put('/:id/status', (req, res) => {
    const { status } = req.body;
    const vehicleId = req.params.id;
    try {
      db.prepare('UPDATE vehicles SET status = ? WHERE id = ?').run(status, vehicleId);
      
      // SSE Broadcast status change
      try {
        const { sseClients } = require('../server');
        const payload = {
          type: 'VEHICLE_STATUS_UPDATE',
          data: { id: vehicleId, status }
        };
        sseClients.forEach((client: any) => {
          try { client.write(`data: ${JSON.stringify(payload)}\n\n`); } catch {}
        });
      } catch (e) {}

      res.json({ success: true });
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  // ── POST /api/vehicles/:id/location ─────────────────────────────────────────
  router.post('/:id/location', (req, res) => {
    const { lat, lng } = req.body;
    const vehicleId = req.params.id;
    try {
      db.prepare('UPDATE vehicles SET lat = ?, lng = ?, last_update = CURRENT_TIMESTAMP WHERE id = ?').run(lat, lng, vehicleId);
      
      // SSE Broadcast location update
      try {
        const { sseClients } = require('../server');
        const payload = {
          type: 'VEHICLE_LOCATION_UPDATE',
          data: { id: vehicleId, lat, lng }
        };
        sseClients.forEach((client: any) => {
          try { client.write(`data: ${JSON.stringify(payload)}\n\n`); } catch {}
        });
      } catch (e) {}

      res.json({ success: true });
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  // ── POST /api/vehicles/login ─────────────────────────────────────────────────
  router.post('/login', (req, res) => {
    const { plate, driver_ci } = req.body;
    try {
      let vehicle = null;
      if (plate) {
        vehicle = db.prepare(`
          SELECT v.*, u.nombre as coordinator_name, u.telefono as coordinator_phone, u.photo_url as coordinator_photo
          FROM vehicles v LEFT JOIN users u ON v.assigned_user_id = u.id
          WHERE UPPER(REPLACE(v.plate, '-', '')) = UPPER(REPLACE(?, '-', ''))
        `).get(plate) as any;
      } else if (driver_ci) {
        vehicle = db.prepare(`
          SELECT v.*, u.nombre as coordinator_name, u.telefono as coordinator_phone, u.photo_url as coordinator_photo
          FROM vehicles v LEFT JOIN users u ON v.assigned_user_id = u.id
          WHERE REPLACE(v.driver_ci, '.', '') = REPLACE(?, '.', '')
        `).get(driver_ci) as any;
      }
      if (!vehicle) return res.status(404).json({ error: 'Vehículo o chofer no registrado en el sistema' });
      res.json(vehicle);
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  // ── GET /api/vehicles/:id/passengers ────────────────────────────────────────
  router.get('/:id/passengers', requireRole('SUPERUSUARIO','JEFE_CAMPANA','SUBJEFE','PADRINO','COORDINADOR'), (req, res) => {
    try {
      const passengers = db.prepare(`
        SELECT ec.id as capture_id, ec.transport_status, ec.telefono as contact_phone,
               COALESCE(e.ci, ec.elector_ci) as ci,
               COALESCE(e.nombre, 'ELECTOR') as nombre,
               COALESCE(e.apellido, 'NO REGISTRADO') as apellido,
               COALESCE(e.local_votacion, 'REGISTRO DE CAMPO') as local_votacion,
               COALESCE(e.mesa, 0) as mesa,
               COALESCE(e.orden, 0) as orden,
               COALESCE(e.barrio, 'REGISTRO DE CAMPO') as barrio,
               ec.lat, ec.lng, COALESCE(e.is_priority, 0) as is_priority
        FROM elector_captures ec
        LEFT JOIN electors e ON ec.elector_ci = e.ci
        WHERE ec.assigned_vehicle_id = ?
        ORDER BY COALESCE(e.is_priority, 0) DESC, ec.timestamp ASC
      `).all(req.params.id);
      res.json((passengers as any[]).map(sanitizeElectorData));
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  return router;
}
