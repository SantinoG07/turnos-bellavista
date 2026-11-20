import { config as loadDotenv } from 'dotenv';
import { resolve } from 'node:path';

// Permite ejecutar desde backend/ (npm workspace) o desde la raíz.
loadDotenv({ path: resolve(process.cwd(), '.env'), quiet: true });
loadDotenv({ path: resolve(process.cwd(), '..', '.env'), quiet: true });

const isProduction = process.env.NODE_ENV === 'production';
const isTest = process.env.NODE_ENV === 'test' || process.env.VITEST === 'true';

function requiredInProduction(name: string, fallback: string): string {
  const value = process.env[name];
  if (value && value.trim().length > 0) return value;
  if (isProduction) throw new Error(`Falta la variable de entorno ${name}`);
  return fallback;
}

export const config = {
  nodeEnv: process.env.NODE_ENV ?? 'development',
  isProduction,
  port: Number(process.env.PORT ?? 3000),
  databaseUrl: process.env.DATABASE_URL,
  jwtSecret: requiredInProduction(
    'JWT_SECRET',
    isTest ? 'test-secret-solo-para-tests-1234567890' : 'dev-secret-cambiar-en-produccion-1234567890',
  ),
  jwtExpiresIn: '7d',
  corsOrigin: process.env.CORS_ORIGIN ?? 'http://localhost:5173',
  timezone: process.env.TZ ?? 'America/Argentina/Buenos_Aires',
  seed: {
    adminEmail: process.env.SEED_ADMIN_EMAIL ?? 'admin@bellavista.test',
    adminPassword: process.env.SEED_ADMIN_PASSWORD ?? 'Admin1234',
    adminName: process.env.SEED_ADMIN_NAME ?? 'Administración Bellavista',
  },
};
