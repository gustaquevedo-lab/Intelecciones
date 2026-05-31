import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import db from '../../src/db';

process.env.NODE_ENV = 'test';

import { app, setupTestDB, seedTestData } from './helpers';

describe('Users CRUD Endpoints Integration Tests', () => {
  beforeEach(() => {
    setupTestDB();
    seedTestData();
  });

  it('debería retornar el listado de usuarios para administradores', async () => {
    const res = await request(app)
      .get('/api/users')
      .set('x-user-role', 'SUPERUSUARIO')
      .set('x-user-id', '1')
      .set('x-district', 'TEST_DISTRICT');

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThanOrEqual(3); // admin, padrino, coord
  });

  it('debería crear un nuevo usuario si el rol solicitante tiene permisos', async () => {
    const payload = {
      username: 'nuevo_coord',
      password: 'password123',
      role: 'COORDINADOR',
      nombre: 'Nuevo Coordinador',
      ci: '9999999',
      assigned_list_id: 1,
      assigned_campaign_id: 1,
      parent_id: 2 // Bajo Padrino
    };

    const res = await request(app)
      .post('/api/users')
      .set('x-user-role', 'SUPERUSUARIO')
      .set('x-user-id', '1')
      .send(payload);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('id');
    expect(res.body).toHaveProperty('success', true);

    // Verificar en base de datos
    const userInDb = db.prepare('SELECT * FROM users WHERE username = ?').get('nuevo_coord') as any;
    expect(userInDb).toBeDefined();
    expect(userInDb.role).toBe('COORDINADOR');
  });

  it('debería denegar la creación de usuarios con rol no permitido para el solicitante', async () => {
    const payload = {
      username: 'intento_admin',
      password: 'password123',
      role: 'SUPERUSUARIO', // Coordinadores no pueden crear Superusuarios
      nombre: 'Intento Hacker',
      ci: '8888888'
    };

    const res = await request(app)
      .post('/api/users')
      .set('x-user-role', 'COORDINADOR')
      .set('x-user-id', '3')
      .send(payload);

    expect(res.status).toBe(403);
  });
});
