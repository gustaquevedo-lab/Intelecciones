import { Router } from 'express';
import { requireRole } from './helpers';
import {
  syncDistrito,
  listCargos,
  getResultados,
  getLastSync,
  TSJE_PLRA_CARGOS,
} from '../services/tsjeSync';
import db from '../db';

// Estado del último sync en proceso (in-memory). Evita que dos requests
// disparen sincronizaciones concurrentes contra el TSJE.
let syncInFlight: Promise<any> | null = null;

const PLRA_2026 = 45;
const AMAMBAY = 13;
const PJC = 0;

function parseIntDefault(v: any, def: number): number {
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? n : def;
}

export default function tsjeRoutes() {
  const router = Router();

  // Catálogo estático de cargos conocidos (no requiere haber corrido sync)
  router.get('/cargos-catalogo', (_req, res) => {
    res.json({
      codEleccion: PLRA_2026,
      cargos: TSJE_PLRA_CARGOS.map(c => ({
        cod_cargo: c.cod,
        des_cargo: c.des,
        tip_cargo: c.tip,
        niv_cargo: c.niv,
      })),
    });
  });

  // Cargos persistidos en la DB (tras sync)
  router.get('/cargos', (req, res) => {
    const codEleccion = parseIntDefault(req.query.cod_eleccion, PLRA_2026);
    res.json({ codEleccion, cargos: listCargos(codEleccion) });
  });

  // Resultados consolidados por (eleccion, dpto, distrito)
  router.get('/resultados', (req, res) => {
    const codEleccion = parseIntDefault(req.query.cod_eleccion, PLRA_2026);
    const codDpto     = parseIntDefault(req.query.cod_dpto, AMAMBAY);
    const codDistrito = parseIntDefault(req.query.cod_distrito, PJC);
    res.json(getResultados(codEleccion, codDpto, codDistrito));
  });

  // Estado del último sync para una jurisdicción
  router.get('/sync/status', (req, res) => {
    const codEleccion = parseIntDefault(req.query.cod_eleccion, PLRA_2026);
    const codDpto     = parseIntDefault(req.query.cod_dpto, AMAMBAY);
    const codDistrito = parseIntDefault(req.query.cod_distrito, PJC);
    res.json({
      lastSync: getLastSync(codEleccion, codDpto, codDistrito) ?? null,
      inFlight: syncInFlight !== null,
    });
  });

  // Dispara una sincronización. Solo superusuario/jefe.
  router.post(
    '/sync',
    requireRole('SUPERUSUARIO', 'SUPER_ADMIN', 'JEFE_CAMPANA'),
    async (req, res) => {
      const codEleccion = parseIntDefault(req.body?.cod_eleccion ?? req.query.cod_eleccion, PLRA_2026);
      const codDpto     = parseIntDefault(req.body?.cod_dpto ?? req.query.cod_dpto, AMAMBAY);
      const codDistrito = parseIntDefault(req.body?.cod_distrito ?? req.query.cod_distrito, PJC);

      if (syncInFlight) {
        return res.status(409).json({ error: 'Ya hay un sync en curso.' });
      }

      try {
        syncInFlight = syncDistrito(codEleccion, codDpto, codDistrito);
        const result = await syncInFlight;
        res.json(result);
      } catch (e: any) {
        res.status(500).json({ error: e?.message ?? 'Error desconocido durante sync' });
      } finally {
        syncInFlight = null;
      }
    },
  );

  // ── D'Hondt Scenarios CRUD ────────────────────────────────────────────────

  function rowToScenario(row: any) {
    return {
      id: row.id,
      nombre: row.nombre,
      descripcion: row.descripcion ?? null,
      seats: JSON.parse(row.seats_json ?? '{}'),
      created_at: row.created_at,
    };
  }

  function validateSeats(seats: unknown): { valid: boolean; error?: string } {
    if (!seats || typeof seats !== 'object' || Array.isArray(seats)) {
      return { valid: false, error: 'seats debe ser un objeto {cargo:bancas}.' };
    }
    for (const [k, v] of Object.entries(seats as Record<string, unknown>)) {
      const cod = parseInt(k, 10);
      if (!Number.isFinite(cod)) return { valid: false, error: `Clave invalida: ${k}` };
      if (typeof v !== 'number' || !Number.isInteger(v) || v < 0 || v > 100) {
        return { valid: false, error: `Valor invalido para cargo ${k}: debe ser entero entre 0 y 100.` };
      }
    }
    return { valid: true };
  }

  router.get('/scenarios', (req, res) => {
    const codEleccion = parseIntDefault(req.query.cod_eleccion, PLRA_2026);
    const rows = db.prepare(`
      SELECT id, cod_eleccion, nombre, descripcion, seats_json, created_at
      FROM tsje_dhondt_scenarios WHERE cod_eleccion = ? ORDER BY id ASC
    `).all(codEleccion) as any[];
    res.json(rows.map(rowToScenario));
  });

  router.post(
    '/scenarios',
    requireRole('SUPERUSUARIO', 'SUPER_ADMIN', 'JEFE_CAMPANA'),
    (req, res) => {
      const { cod_eleccion, nombre, descripcion, seats } = req.body ?? {};
      const codEleccion = parseIntDefault(cod_eleccion, PLRA_2026);
      if (!nombre || typeof nombre !== 'string' || !nombre.trim()) {
        return res.status(400).json({ error: 'nombre es requerido.' });
      }
      const sv = validateSeats(seats);
      if (!sv.valid) return res.status(400).json({ error: sv.error });

      const userId = parseInt(req.headers['x-user-id'] as string, 10) || null;
      try {
        const result = db.prepare(`
          INSERT INTO tsje_dhondt_scenarios (cod_eleccion, nombre, descripcion, seats_json, created_by, created_at)
          VALUES (?, ?, ?, ?, ?, datetime('now'))
        `).run(codEleccion, nombre.trim(), descripcion ?? null, JSON.stringify(seats), userId);
        const row = db.prepare(`SELECT * FROM tsje_dhondt_scenarios WHERE id = ?`).get(result.lastInsertRowid) as any;
        res.status(201).json(rowToScenario(row));
      } catch (e: any) {
        if (e.message?.includes('UNIQUE')) {
          return res.status(409).json({ error: 'Ya existe un escenario con ese nombre para esta eleccion.' });
        }
        res.status(500).json({ error: 'Error interno.' });
      }
    },
  );

  router.put(
    '/scenarios/:id',
    requireRole('SUPERUSUARIO', 'SUPER_ADMIN', 'JEFE_CAMPANA'),
    (req, res) => {
      const id = parseIntDefault(req.params.id, 0);
      if (!id) return res.status(400).json({ error: 'ID invalido.' });

      const existing = db.prepare(`SELECT * FROM tsje_dhondt_scenarios WHERE id = ?`).get(id) as any;
      if (!existing) return res.status(404).json({ error: 'Escenario no encontrado.' });

      const { nombre, descripcion, seats } = req.body ?? {};

      if (seats !== undefined) {
        const sv = validateSeats(seats);
        if (!sv.valid) return res.status(400).json({ error: sv.error });
      }

      const newNombre = (nombre && typeof nombre === 'string') ? nombre.trim() : existing.nombre;
      const newDesc = descripcion !== undefined ? descripcion : existing.descripcion;
      const newSeats = seats !== undefined ? JSON.stringify(seats) : existing.seats_json;

      try {
        db.prepare(`
          UPDATE tsje_dhondt_scenarios
          SET nombre = ?, descripcion = ?, seats_json = ?, updated_at = datetime('now')
          WHERE id = ?
        `).run(newNombre, newDesc, newSeats, id);
        const row = db.prepare(`SELECT * FROM tsje_dhondt_scenarios WHERE id = ?`).get(id) as any;
        res.json(rowToScenario(row));
      } catch (e: any) {
        if (e.message?.includes('UNIQUE')) {
          return res.status(409).json({ error: 'Ya existe un escenario con ese nombre.' });
        }
        res.status(500).json({ error: 'Error interno.' });
      }
    },
  );

  router.delete(
    '/scenarios/:id',
    requireRole('SUPERUSUARIO', 'SUPER_ADMIN', 'JEFE_CAMPANA'),
    (req, res) => {
      const id = parseIntDefault(req.params.id, 0);
      if (!id) return res.status(400).json({ error: 'ID invalido.' });

      const existing = db.prepare(`SELECT id FROM tsje_dhondt_scenarios WHERE id = ?`).get(id);
      if (!existing) return res.status(404).json({ error: 'Escenario no encontrado.' });

      db.prepare(`DELETE FROM tsje_dhondt_scenarios WHERE id = ?`).run(id);
      res.json({ ok: true });
    },
  );

  return router;
}
