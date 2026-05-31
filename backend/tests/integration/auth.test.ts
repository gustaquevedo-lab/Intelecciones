import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';

// Forzar entorno de test para habilitar la DB :memory: y deshabilitar listen()
process.env.NODE_ENV = 'test';

import { app, setupTestDB, seedTestData } from './helpers';

describe('Auth Endpoints Integration Tests', () => {
  beforeEach(() => {
    setupTestDB();
    seedTestData();
  });

  it('debería autenticar exitosamente con credenciales válidas', async () => {
    const res = await request(app)
      .post('/api/login')
      .send({ username: 'admin', password: 'admin123' });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('id');
    expect(res.body).toHaveProperty('username', 'admin');
    expect(res.body).toHaveProperty('role', 'SUPERUSUARIO');
  });

  it('debería fallar la autenticación con credenciales inválidas', async () => {
    const res = await request(app)
      .post('/api/login')
      .send({ username: 'admin', password: 'wrongpassword' });

    expect(res.status).toBe(401);
    expect(res.body).toHaveProperty('error');
  });

  it('debería validar campos obligatorios al iniciar sesión', async () => {
    const res = await request(app)
      .post('/api/login')
      .send({ username: '' });

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error', 'Usuario y contraseña requeridos');
  });

  it('debería bloquear con 429 tras demasiados intentos de login fallidos', async () => {
    // Intentar ingresar 5 veces (límite máximo configurado)
    for (let i = 0; i < 5; i++) {
      await request(app)
        .post('/api/login')
        .send({ username: 'admin', password: 'bad-password' });
    }

    // El 6to intento debería fallar por Rate Limit
    const res = await request(app)
      .post('/api/login')
      .send({ username: 'admin', password: 'bad-password' });

    expect(res.status).toBe(429);
    expect(res.body.error).toContain('Demasiados intentos');
  });
});
