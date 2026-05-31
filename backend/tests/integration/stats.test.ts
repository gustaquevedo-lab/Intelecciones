import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import db from '../../src/db';

process.env.NODE_ENV = 'test';

import { app, setupTestDB, seedTestData } from './helpers';

describe('Stats and Reports Endpoints Integration Tests', () => {
  beforeEach(() => {
    setupTestDB();
    seedTestData();

    // Agregar algunas capturas para tener estadísticas calculables
    db.prepare(`
      INSERT INTO elector_captures (elector_ci, coordinator_id, list_id, campaign_id, lat, lng, traffic_light, needs_transport)
      VALUES ('4444444', 3, 1, 1, -25.2867, -57.647, 'GREEN', 1)
    `).run();
  });

  it('debería responder con éxito al endpoint /api/stats/command', async () => {
    const res = await request(app)
      .get('/api/stats/command')
      .set('x-user-role', 'SUPERUSUARIO')
      .set('x-user-id', '1')
      .set('x-district', 'TEST_DISTRICT');

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('total_captures', 1);
    expect(res.body).toHaveProperty('green', 1);
    expect(res.body).toHaveProperty('transport_needed', 1);
  });

  it('debería retornar el reporte de equipo en /api/my-team/reports', async () => {
    const res = await request(app)
      .get('/api/my-team/reports?report_type=padrinos')
      .set('x-user-role', 'SUPERUSUARIO')
      .set('x-user-id', '1')
      .set('x-district', 'TEST_DISTRICT')
      .set('x-list-id', '1');

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('padrinos');
    expect(res.body).toHaveProperty('coordinators');
    expect(res.body.padrinos.length).toBeGreaterThanOrEqual(1);
  });

  it('debería responder con éxito al reporte de cobertura de día D en /api/diad/coverage', async () => {
    // Insertar un veedor y un local de votación
    db.prepare(`
      INSERT INTO voting_locations (cod_local, nombre, lat, lng, distrito, ciudad)
      VALUES ('LOC_1', 'Colegio Nacional Test', -25.28, -57.64, 'TEST_DISTRICT', 'TEST_CITY')
    `).run();

    const res = await request(app)
      .get('/api/diad/coverage')
      .set('x-user-role', 'SUPERUSUARIO')
      .set('x-user-id', '1')
      .set('x-district', 'TEST_DISTRICT');

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('mesas');
    expect(res.body).toHaveProperty('total_mesas');
    expect(res.body).toHaveProperty('mesas_operativas');
    expect(res.body).toHaveProperty('mesas_reportadas');
  });

  it('debería responder con éxito a la exportación Excel en /api/reports/export/xlsx', async () => {
    const res = await request(app)
      .get('/api/reports/export/xlsx')
      .set('x-user-role', 'SUPERUSUARIO')
      .set('x-user-id', '1')
      .set('x-district', 'TEST_DISTRICT');

    expect(res.status).toBe(200);
    expect(res.header['content-type']).toContain('spreadsheetml.sheet');
  });
});
