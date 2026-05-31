import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import db from '../../src/db';

process.env.NODE_ENV = 'test';

import { app, setupTestDB, seedTestData } from './helpers';

describe('Captures Endpoints Integration Tests', () => {
  beforeEach(() => {
    setupTestDB();
    seedTestData();
  });

  it('debería registrar una captura de elector exitosamente', async () => {
    const payload = {
      elector_ci: '4444444',
      coordinator_id: 3, // Coordinador Test
      lat: -25.2867,
      lng: -57.647,
      traffic_light: 'GREEN',
      needs_transport: false,
      telefono: '0981123456',
      elector_nombre: 'Elector Prueba'
    };

    const res = await request(app)
      .post('/api/captures')
      .set('x-user-role', 'SUPERUSUARIO')
      .set('x-user-id', '1')
      .send(payload);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('success', true);

    // Verificar en DB
    const capture = db.prepare('SELECT * FROM elector_captures WHERE elector_ci = ?').get('4444444') as any;
    expect(capture).toBeDefined();
    expect(capture.traffic_light).toBe('GREEN');
    expect(capture.coordinator_id).toBe(3);
  });

  it('debería rechazar coordenadas fuera de rango en la captura', async () => {
    const payload = {
      elector_ci: '4444444',
      coordinator_id: 3,
      lat: 120.0, // Inválido (>90)
      lng: -57.647,
      traffic_light: 'GREEN',
      telefono: '0981123456'
    };

    const res = await request(app)
      .post('/api/captures')
      .set('x-user-role', 'SUPERUSUARIO')
      .set('x-user-id', '1')
      .send(payload);

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error');
  });

  it('debería rechazar un formato de CI inválido', async () => {
    const payload = {
      elector_ci: 'abc1234', // Inválido (contiene letras)
      coordinator_id: 3,
      lat: -25.2867,
      lng: -57.647,
      traffic_light: 'GREEN',
      telefono: '0981123456'
    };

    const res = await request(app)
      .post('/api/captures')
      .set('x-user-role', 'SUPERUSUARIO')
      .set('x-user-id', '1')
      .send(payload);

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error');
    expect(res.body.error).toContain('C.I.');
  });

  it('debería crear un conflicto de captura y marcar is_disputed si un elector es captado dos veces', async () => {
    // Primera captura por Coordinador (id: 3, list_id: 1)
    const payload1 = {
      elector_ci: '4444444',
      coordinator_id: 3,
      lat: -25.2867,
      lng: -57.647,
      traffic_light: 'GREEN',
      telefono: '0981123456'
    };

    let res = await request(app)
      .post('/api/captures')
      .set('x-user-role', 'SUPERUSUARIO')
      .set('x-user-id', '1')
      .send(payload1);
    expect(res.status).toBe(200);

    // Segunda captura por otro Coordinador (creamos uno nuevo bajo otra lista)
    db.prepare(`
      INSERT INTO lists (id, campaign_id, type, list_number, option_number, goal, is_adversary)
      VALUES (2, 1, 'CONCEJALES', '4', '2', 50, 0)
    `).run();
    db.prepare(`
      INSERT INTO users (id, username, password, role, assigned_list_id, assigned_campaign_id, nombre, CI, status)
      VALUES (4, 'coord2', 'coord123', 'COORDINADOR', 2, 1, 'Coordinador B', '4444445', 'ACTIVE')
    `).run();

    const payload2 = {
      elector_ci: '4444444',
      coordinator_id: 4,
      lat: -25.2868,
      lng: -57.648,
      traffic_light: 'YELLOW',
      telefono: '0982654321'
    };

    res = await request(app)
      .post('/api/captures')
      .set('x-user-role', 'SUPERUSUARIO')
      .set('x-user-id', '1')
      .send(payload2);
    expect(res.status).toBe(200);

    // Verificar que is_disputed esté en 1
    const capture = db.prepare('SELECT is_disputed FROM elector_captures WHERE elector_ci = ? LIMIT 1').get('4444444') as any;
    expect(capture.is_disputed).toBe(1);

    // Verificar que exista el conflicto registrado
    const conflict = db.prepare('SELECT * FROM capture_conflicts WHERE elector_ci = ?').get('4444444') as any;
    expect(conflict).toBeDefined();
    expect(conflict.status).toBe('PENDING');
  });
});
