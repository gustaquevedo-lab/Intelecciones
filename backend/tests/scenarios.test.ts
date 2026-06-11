import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';

// Force test DB (in-memory)
process.env.NODE_ENV = 'test';

// Dynamic import so NODE_ENV is set before db initializes
const getApp = async () => {
  const mod = await import('../src/server');
  return (mod as any).default ?? (mod as any).app;
};

const AUTH_HEADERS = {
  'x-user-role': 'SUPERUSUARIO',
  'x-user-id': '1',
};

describe('GET/POST/PUT/DELETE /api/tsje/scenarios', () => {
  let app: any;
  let createdId: number;

  beforeAll(async () => {
    app = await getApp();
  });

  it('GET retorna array (incluyendo seed)', async () => {
    const res = await request(app)
      .get('/api/tsje/scenarios?cod_eleccion=45')
      .set(AUTH_HEADERS);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    // Seed should exist
    const seed = res.body.find((s: any) => s.nombre === 'Hipotesis de referencia');
    expect(seed).toBeDefined();
    expect(seed.seats).toHaveProperty('2');
  });

  it('POST crea un nuevo escenario', async () => {
    const res = await request(app)
      .post('/api/tsje/scenarios')
      .set(AUTH_HEADERS)
      .send({ cod_eleccion: 45, nombre: 'Test Scenario', seats: { '2': 12, '4': 30 } });
    expect(res.status).toBe(201);
    expect(res.body.nombre).toBe('Test Scenario');
    expect(res.body.seats['2']).toBe(12);
    expect(res.body.seats['4']).toBe(30);
    createdId = res.body.id;
  });

  it('GET refleja el escenario creado', async () => {
    const res = await request(app)
      .get('/api/tsje/scenarios?cod_eleccion=45')
      .set(AUTH_HEADERS);
    const found = res.body.find((s: any) => s.id === createdId);
    expect(found).toBeDefined();
    expect(found.seats['2']).toBe(12);
  });

  it('PUT actualiza seats', async () => {
    const res = await request(app)
      .put(`/api/tsje/scenarios/${createdId}`)
      .set(AUTH_HEADERS)
      .send({ seats: { '2': 15, '4': 25 } });
    expect(res.status).toBe(200);
    expect(res.body.seats['2']).toBe(15);
    expect(res.body.seats['4']).toBe(25);
  });

  it('GET refleja el cambio de PUT', async () => {
    const res = await request(app)
      .get('/api/tsje/scenarios?cod_eleccion=45')
      .set(AUTH_HEADERS);
    const found = res.body.find((s: any) => s.id === createdId);
    expect(found?.seats?.['2']).toBe(15);
  });

  it('POST con seats fuera de rango retorna 400', async () => {
    const res = await request(app)
      .post('/api/tsje/scenarios')
      .set(AUTH_HEADERS)
      .send({ cod_eleccion: 45, nombre: 'Bad Seats', seats: { '2': 999 } });
    expect(res.status).toBe(400);
  });

  it('POST con nombre duplicado retorna 409', async () => {
    const res = await request(app)
      .post('/api/tsje/scenarios')
      .set(AUTH_HEADERS)
      .send({ cod_eleccion: 45, nombre: 'Test Scenario', seats: { '2': 5 } });
    expect(res.status).toBe(409);
  });

  it('DELETE elimina el escenario', async () => {
    const res = await request(app)
      .delete(`/api/tsje/scenarios/${createdId}`)
      .set(AUTH_HEADERS);
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });

  it('GET ya no incluye el escenario eliminado', async () => {
    const res = await request(app)
      .get('/api/tsje/scenarios?cod_eleccion=45')
      .set(AUTH_HEADERS);
    const found = res.body.find((s: any) => s.id === createdId);
    expect(found).toBeUndefined();
  });

  it('PUT en ID inexistente retorna 404', async () => {
    const res = await request(app)
      .put('/api/tsje/scenarios/999999')
      .set(AUTH_HEADERS)
      .send({ nombre: 'nope' });
    expect(res.status).toBe(404);
  });
});
