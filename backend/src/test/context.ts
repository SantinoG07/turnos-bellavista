import { createApp } from '../app.js';
import { createPgliteDatabase } from '../db/database.js';
import { runMigrations } from '../db/migrate.js';
import { seedDatabase } from '../db/seed.js';
import type { Database } from '../db/types.js';
import type { Express } from 'express';

export const TEST_JWT_SECRET = 'test-secret-integracion-1234567890';
export const DEFAULT_NOW = new Date('2026-11-20T12:00:00.000Z'); // viernes 09:00 en Buenos Aires

export interface TestContext {
  db: Database;
  app: Express;
  now: () => Date;
  setNow: (value: Date) => void;
  close: () => Promise<void>;
}

export async function createTestContext(options?: {
  now?: Date;
  seed?: boolean;
  rateLimit?: { max?: number; windowMs?: number };
}): Promise<TestContext> {
  const db = createPgliteDatabase();
  await runMigrations(db);
  let current = new Date(options?.now ?? DEFAULT_NOW);
  const now = () => current;

  if (options?.seed !== false) {
    await seedDatabase(db, {
      adminEmail: 'admin@test.com',
      adminPassword: 'Admin1234',
      adminName: 'Admin Test',
      withDemoClient: true,
    });
  }

  const app = createApp({
    db,
    jwtSecret: TEST_JWT_SECRET,
    now,
    corsOrigin: '*',
    rateLimit: options?.rateLimit,
  });

  return {
    db,
    app,
    now,
    setNow: (value: Date) => {
      current = value;
    },
    close: () => db.close(),
  };
}
