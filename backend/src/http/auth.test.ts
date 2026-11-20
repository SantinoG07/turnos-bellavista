import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import jwt from 'jsonwebtoken';
import { createApp } from '../app.js';
import { createPgliteDatabase } from '../db/database.js';
import { runMigrations } from '../db/migrate.js';
import { hashPassword, verifyPassword } from '../auth/password.js';
import type { Database } from '../db/types.js';

const JWT_SECRET = 'test-secret-para-auth-1234567890';

describe('T04 · autenticación y seguridad', () => {
  let db: Database;
  let app: ReturnType<typeof createApp>;

  beforeAll(async () => {
    db = createPgliteDatabase();
    await runMigrations(db);
    app = createApp({ db, jwtSecret: JWT_SECRET, corsOrigin: '*' });
  });

  afterAll(async () => {
    await db.close();
  });

  it('RN-01: registra y normaliza el email', async () => {
    const response = await request(app).post('/api/auth/register').send({
      fullName: 'Ana Pérez',
      email: '  ANA.Perez@Example.COM ',
      password: 'Secreta123',
      phone: '11 5555-1234',
    });
    expect(response.status).toBe(201);
    expect(response.body.user.email).toBe('ana.perez@example.com');
    expect(response.body.user.role).toBe('client');
    expect(response.body.user.password).toBeUndefined();
    expect(response.body.user.passwordHash).toBeUndefined();
    expect(typeof response.body.token).toBe('string');
  });

  it('RN-01: rechaza un email duplicado sin importar mayúsculas', async () => {
    const response = await request(app).post('/api/auth/register').send({
      fullName: 'Otra Ana',
      email: 'ANA.PEREZ@example.com',
      password: 'Secreta123',
    });
    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe('CONFLICT');
  });

  it('RN-02: rechaza contraseñas débiles', async () => {
    const cases = [
      { password: 'corta1', label: 'menos de 8' },
      { password: 'sololetras', label: 'sin número' },
      { password: '12345678', label: 'sin letra' },
    ];
    for (const item of cases) {
      const response = await request(app).post('/api/auth/register').send({
        fullName: 'Test Débil',
        email: `debil-${item.label.replaceAll(' ', '-')}@test.com`,
        password: item.password,
      });
      expect(response.status, item.label).toBe(400);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    }
  });

  it('RN-02: valida email y nombre', async () => {
    const response = await request(app).post('/api/auth/register').send({
      fullName: 'A',
      email: 'no-es-email',
      password: 'Secreta123',
    });
    expect(response.status).toBe(400);
    expect(response.body.error.details).toHaveProperty('email');
    expect(response.body.error.details).toHaveProperty('fullName');
  });

  it('RN-03: guarda scrypt con salt y nunca texto plano', async () => {
    const row = await db.query<{ password_hash: string }>(
      `SELECT password_hash FROM users WHERE email = 'ana.perez@example.com'`,
    );
    expect(row.rows[0]!.password_hash).toMatch(/^scrypt\$[0-9a-f]{32}\$[0-9a-f]{128}$/);
    expect(row.rows[0]!.password_hash).not.toContain('Secreta123');
    expect(await verifyPassword('Secreta123', row.rows[0]!.password_hash)).toBe(true);
    expect(await verifyPassword('OtraClave123', row.rows[0]!.password_hash)).toBe(false);
  });

  it('RN-03: dos hashes de la misma clave son distintos por el salt', async () => {
    const one = await hashPassword('Secreta123');
    const two = await hashPassword('Secreta123');
    expect(one).not.toBe(two);
  });

  it('permite iniciar sesión y devuelve el usuario público', async () => {
    const response = await request(app)
      .post('/api/auth/login')
      .send({ email: 'ana.perez@example.com', password: 'Secreta123' });
    expect(response.status).toBe(200);
    expect(response.body.user.fullName).toBe('Ana Pérez');
    expect(response.body.user.blockedUntil).toBeNull();
  });

  it('rechaza credenciales inválidas con el mismo mensaje', async () => {
    const wrong = await request(app)
      .post('/api/auth/login')
      .send({ email: 'ana.perez@example.com', password: 'Incorrecta123' });
    const unknown = await request(app)
      .post('/api/auth/login')
      .send({ email: 'nadie@example.com', password: 'Incorrecta123' });
    expect(wrong.status).toBe(401);
    expect(unknown.status).toBe(401);
    expect(wrong.body.error.message).toBe(unknown.body.error.message);
  });

  it('RN-04: el JWT dura exactamente 7 días y usa HS256', async () => {
    const response = await request(app)
      .post('/api/auth/login')
      .send({ email: 'ana.perez@example.com', password: 'Secreta123' });
    const decoded = jwt.decode(response.body.token, { complete: true });
    expect(decoded?.header.alg).toBe('HS256');
    const payload = decoded?.payload as { sub: string; role: string; iat: number; exp: number };
    expect(payload.role).toBe('client');
    expect(payload.exp - payload.iat).toBe(7 * 24 * 60 * 60);
    expect(payload.sub).toBe(response.body.user.id);
  });

  it('RN-05: /me exige un token válido', async () => {
    const without = await request(app).get('/api/auth/me');
    expect(without.status).toBe(401);
    const invalid = await request(app).get('/api/auth/me').set('Authorization', 'Bearer roto');
    expect(invalid.status).toBe(401);
  });

  it('RN-05: /me devuelve la sesión actual', async () => {
    const login = await request(app)
      .post('/api/auth/login')
      .send({ email: 'ana.perez@example.com', password: 'Secreta123' });
    const me = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${login.body.token}`);
    expect(me.status).toBe(200);
    expect(me.body.user.email).toBe('ana.perez@example.com');
  });

  it('RN-06: bloquea el intento 11 de login por IP en 15 minutos', async () => {
    const limitedApp = createApp({
      db,
      jwtSecret: JWT_SECRET,
      corsOrigin: '*',
      rateLimit: { max: 10, windowMs: 15 * 60_000 },
    });
    for (let attempt = 1; attempt <= 10; attempt += 1) {
      const response = await request(limitedApp)
        .post('/api/auth/login')
        .send({ email: 'nadie@example.com', password: 'Incorrecta123' });
      expect(response.status, `intento ${attempt}`).toBe(401);
    }
    const blocked = await request(limitedApp)
      .post('/api/auth/login')
      .send({ email: 'nadie@example.com', password: 'Incorrecta123' });
    expect(blocked.status).toBe(429);
    expect(blocked.body.error.code).toBe('RATE_LIMITED');
  });

  it('RN-07: detecta el bloqueo vigente y su expiración', async () => {
    const row = await db.query<{ id: string }>(
      `SELECT id FROM users WHERE email = 'ana.perez@example.com'`,
    );
    const future = new Date(Date.now() + 60_000);
    await db.query('UPDATE users SET blocked_until = $2 WHERE id = $1', [row.rows[0]!.id, future]);
    const login = await request(app)
      .post('/api/auth/login')
      .send({ email: 'ana.perez@example.com', password: 'Secreta123' });
    const me = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${login.body.token}`);
    expect(me.body.user.blockedUntil).toBe(future.toISOString());

    await db.query('UPDATE users SET blocked_until = NULL WHERE id = $1', [row.rows[0]!.id]);
    const after = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${login.body.token}`);
    expect(after.body.user.blockedUntil).toBeNull();
  });
});
