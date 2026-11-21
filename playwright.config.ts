import { defineConfig, devices } from '@playwright/test';

const e2eDb = 'pglite://./.e2e-pgdata';
const env = `DATABASE_URL=${e2eDb} JWT_SECRET=prueba-e2e-no-usar-en-produccion-123456 CORS_ORIGIN=http://127.0.0.1:5173`;

export default defineConfig({
  testDir: './e2e',
  timeout: 45_000,
  expect: { timeout: 8_000 },
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: 'http://127.0.0.1:5173',
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'firefox', use: { ...devices['Desktop Firefox'] } }],
  webServer: [
    {
      command: `rm -rf backend/.e2e-pgdata && ${env} npm run seed -w backend && ${env} npm run dev -w backend`,
      url: 'http://127.0.0.1:3000/api/health',
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
    {
      command: 'npm run dev -w frontend -- --host 127.0.0.1',
      url: 'http://127.0.0.1:5173',
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
  ],
});
