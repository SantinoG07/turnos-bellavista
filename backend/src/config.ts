import { config as loadDotenv } from 'dotenv';
import { resolve } from 'node:path';

// Permite ejecutar desde backend/ (npm workspace) o desde la raíz.
// Neon CLI escribe la conexión local en .env.local; tiene prioridad sobre .env
// y ambos archivos permanecen ignorados por Git. Las variables ya presentes en
// el entorno (por ejemplo, en CI o en Playwright) siempre tienen prioridad.
const explicitEnv = {
  NODE_ENV: process.env.NODE_ENV,
  PORT: process.env.PORT,
  DATABASE_URL: process.env.DATABASE_URL,
  JWT_SECRET: process.env.JWT_SECRET,
  CORS_ORIGIN: process.env.CORS_ORIGIN,
  TZ: process.env.TZ,
  SEED_ADMIN_EMAIL: process.env.SEED_ADMIN_EMAIL,
  SEED_ADMIN_PASSWORD: process.env.SEED_ADMIN_PASSWORD,
  SEED_ADMIN_NAME: process.env.SEED_ADMIN_NAME,
};

loadDotenv({ path: resolve(process.cwd(), '.env'), quiet: true });
loadDotenv({ path: resolve(process.cwd(), '..', '.env'), quiet: true });
loadDotenv({ path: resolve(process.cwd(), '.env.local'), override: true, quiet: true });
loadDotenv({ path: resolve(process.cwd(), '..', '.env.local'), override: true, quiet: true });

for (const [name, value] of Object.entries(explicitEnv)) {
  if (value !== undefined && value !== '') process.env[name] = value;
}

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
