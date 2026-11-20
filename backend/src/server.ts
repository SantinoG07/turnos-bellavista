import { createServer } from 'node:http';
import { createApp } from './app.js';
import { config } from './config.js';
import { createDatabase } from './db/database.js';

const db = createDatabase(config.databaseUrl);
const app = createApp({
  db,
  jwtSecret: config.jwtSecret,
  corsOrigin: config.corsOrigin,
});

const server = createServer(app);

server.listen(config.port, () => {
  console.log(`API Turnos Bellavista escuchando en http://localhost:${config.port}`);
  if (!config.databaseUrl || config.databaseUrl.startsWith('pglite://')) {
    console.log('Base de datos: PGlite (desarrollo local)');
  } else {
    console.log('Base de datos: PostgreSQL');
  }
});

async function shutdown(signal: string): Promise<void> {
  console.log(`Recibido ${signal}, cerrando...`);
  server.close(async () => {
    await db.close();
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10_000).unref();
}

process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));
