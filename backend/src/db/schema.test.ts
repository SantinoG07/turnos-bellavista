import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createPgliteDatabase } from './database.js';
import { runMigrations } from './migrate.js';
import { seedDatabase } from './seed.js';
import type { Database } from './types.js';

describe('T02 · esquema, migraciones y seed', () => {
  let db: Database;

  beforeAll(async () => {
    db = createPgliteDatabase();
    await runMigrations(db);
  });

  afterAll(async () => {
    await db.close();
  });

  it('crea las tablas del modelo', async () => {
    const result = await db.query<{ table_name: string }>(
      `SELECT table_name FROM information_schema.tables
       WHERE table_schema = 'public' ORDER BY table_name`,
    );
    const names = result.rows.map((row) => row.table_name);
    expect(names).toEqual([
      'appointment_events',
      'appointments',
      'availability_rules',
      'professional_services',
      'professionals',
      'schema_migrations',
      'services',
      'time_off',
      'users',
    ]);
  });

  it('registra la migración aplicada y no la repite', async () => {
    const again = await runMigrations(db);
    expect(again).toEqual([]);
    const applied = await db.query<{ name: string }>('SELECT name FROM schema_migrations');
    expect(applied.rows).toEqual([{ name: '001_init.sql' }]);
  });

  it('RN-01: no permite emails duplicados', async () => {
    const insert = () =>
      db.query(
        `INSERT INTO users (email, password_hash, full_name)
         VALUES ('duplicado@test.com', 'hash', 'Duplicado')`,
      );
    await insert();
    await expect(insert()).rejects.toThrow();
  });

  it('RN-09: valida duración múltiplo de 15, rango y precio', async () => {
    await expect(
      db.query(
        `INSERT INTO services (name, duration_min, price_cents)
         VALUES ('Inválido 20', 20, 100)`,
      ),
    ).rejects.toThrow();
    await expect(
      db.query(
        `INSERT INTO services (name, duration_min, price_cents)
         VALUES ('Inválido 135', 135, 100)`,
      ),
    ).rejects.toThrow();
    await expect(
      db.query(
        `INSERT INTO services (name, duration_min, price_cents)
         VALUES ('Precio negativo', 30, -1)`,
      ),
    ).rejects.toThrow();
  });

  it('RN-09: el nombre de servicio es único sin distinguir mayúsculas', async () => {
    await db.query(
      `INSERT INTO services (name, duration_min, price_cents) VALUES ('Corte Test', 30, 100)`,
    );
    await expect(
      db.query(
        `INSERT INTO services (name, duration_min, price_cents) VALUES ('corte test', 30, 100)`,
      ),
    ).rejects.toThrow();
  });

  it('RN-13: una franja no puede terminar antes de empezar', async () => {
    const professional = await db.query<{ id: string }>(
      `INSERT INTO professionals (name) VALUES ('Test Franja') RETURNING id`,
    );
    await expect(
      db.query(
        `INSERT INTO availability_rules (professional_id, weekday, start_minute, end_minute)
         VALUES ($1, 2, 600, 500)`,
        [professional.rows[0]!.id],
      ),
    ).rejects.toThrow();
  });

  it('RN-32: el estado del turno está restringido', async () => {
    const service = await db.query<{ id: string }>(
      `INSERT INTO services (name, duration_min, price_cents) VALUES ('Servicio Estado', 30, 1) RETURNING id`,
    );
    const professional = await db.query<{ id: string }>(
      `INSERT INTO professionals (name) VALUES ('Profesional Estado') RETURNING id`,
    );
    const client = await db.query<{ id: string }>(
      `INSERT INTO users (email, password_hash, full_name) VALUES ('estado@test.com', 'h', 'E') RETURNING id`,
    );
    await expect(
      db.query(
        `INSERT INTO appointments
          (client_id, professional_id, service_id, starts_at, ends_at, status, price_cents)
         VALUES ($1, $2, $3, now(), now() + interval '30 minutes', 'inventado', 1)`,
        [client.rows[0]!.id, professional.rows[0]!.id, service.rows[0]!.id],
      ),
    ).rejects.toThrow();
  });

  it('el seed es idempotente y carga catálogo y usuarios demo', async () => {
    const options = {
      adminEmail: 'admin@test.com',
      adminPassword: 'Admin1234',
      adminName: 'Admin Test',
    };
    await seedDatabase(db, options);
    await seedDatabase(db, options);

    const services = await db.query<{ count: string }>('SELECT count(*) FROM services');
    const professionals = await db.query<{ count: string }>('SELECT count(*) FROM professionals');
    const users = await db.query<{ count: string }>('SELECT count(*) FROM users');
    const rules = await db.query<{ count: string }>('SELECT count(*) FROM availability_rules');

    expect(Number(services.rows[0]!.count)).toBeGreaterThanOrEqual(4);
    expect(Number(professionals.rows[0]!.count)).toBeGreaterThanOrEqual(3);
    expect(Number(users.rows[0]!.count)).toBeGreaterThanOrEqual(2);
    expect(Number(rules.rows[0]!.count)).toBe(26);
  });
});
