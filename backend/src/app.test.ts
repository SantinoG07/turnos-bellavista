import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from './app.js';
import { createPgliteDatabase } from './db/database.js';
import { runMigrations } from './db/migrate.js';
import type { Database } from './db/types.js';

describe('T03 · esqueleto HTTP', () => {
  let db: Database;
  let app: ReturnType<typeof createApp>;

  beforeAll(async () => {
    db = createPgliteDatabase();
    await runMigrations(db);
    app = createApp({ db, jwtSecret: 'test-secret', corsOrigin: '*' });
  });

  afterAll(async () => {
    await db.close();
  });

  it('responde el healthcheck con estado de la base', async () => {
    const response = await request(app).get('/api/health');
    expect(response.status).toBe(200);
    expect(response.body.status).toBe('ok');
    expect(response.body.database).toBe('ok');
    expect(typeof response.body.timestamp).toBe('string');
  });

  it('devuelve 404 con el formato de error de la API', async () => {
    const response = await request(app).get('/api/no-existe');
    expect(response.status).toBe(404);
    expect(response.body).toEqual({
      error: { code: 'NOT_FOUND', message: 'Endpoint no encontrado.' },
    });
  });

  it('rechaza JSON inválido con 400', async () => {
    const response = await request(app)
      .post('/api/health')
      .set('Content-Type', 'application/json')
      .send('{ roto');
    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('incluye cabeceras de seguridad', async () => {
    const response = await request(app).get('/api/health');
    expect(response.headers['x-content-type-options']).toBe('nosniff');
    expect(response.headers['x-powered-by']).toBeUndefined();
  });
});
