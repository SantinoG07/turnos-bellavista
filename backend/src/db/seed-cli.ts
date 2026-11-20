import { config } from '../config.js';
import { createDatabase } from './database.js';
import { runMigrations } from './migrate.js';
import { seedDatabase } from './seed.js';

async function main(): Promise<void> {
  const db = createDatabase(config.databaseUrl);
  try {
    await runMigrations(db);
    await seedDatabase(db, config.seed);
    console.log('Datos demo cargados (idempotente).');
    console.log(`Admin: ${config.seed.adminEmail}`);
    console.log('Cliente demo: cliente@bellavista.test / Cliente1234');
  } finally {
    await db.close();
  }
}

main().catch((error) => {
  console.error('Error al cargar datos demo:', error);
  process.exit(1);
});
