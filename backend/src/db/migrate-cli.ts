import { config } from '../config.js';
import { createDatabase } from './database.js';
import { runMigrations } from './migrate.js';

async function main(): Promise<void> {
  const db = createDatabase(config.databaseUrl);
  try {
    const executed = await runMigrations(db);
    if (executed.length === 0) {
      console.log('No hay migraciones pendientes.');
    } else {
      console.log(`Migraciones aplicadas: ${executed.join(', ')}`);
    }
  } finally {
    await db.close();
  }
}

main().catch((error) => {
  console.error('Error al migrar:', error);
  process.exit(1);
});
