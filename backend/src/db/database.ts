import { PGlite } from '@electric-sql/pglite';
import pg from 'pg';
import type { DbResult, Database, Queryable, QueryResultRow } from './types.js';

class PgliteDatabase implements Database {
  private queue: Promise<unknown> = Promise.resolve();

  constructor(private readonly client: PGlite) {}

  async query<T extends QueryResultRow = QueryResultRow>(
    sql: string,
    params: unknown[] = [],
  ): Promise<DbResult<T>> {
    const result = await this.client.query<T>(sql, params as never[]);
    return {
      rows: result.rows,
      rowCount: result.affectedRows ?? result.rows.length,
    };
  }

  async exec(sql: string): Promise<void> {
    await this.client.exec(sql);
  }

  transaction<T>(fn: (tx: Queryable) => Promise<T>): Promise<T> {
    const run = async (): Promise<T> => {
      await this.client.exec('BEGIN');
      try {
        const value = await fn(this);
        await this.client.exec('COMMIT');
        return value;
      } catch (error) {
        await this.client.exec('ROLLBACK');
        throw error;
      }
    };
    const next = this.queue.then(run, run);
    this.queue = next.then(
      () => undefined,
      () => undefined,
    );
    return next;
  }

  async close(): Promise<void> {
    await this.client.close();
  }
}

class PgDatabase implements Database {
  constructor(private readonly pool: pg.Pool) {}

  async query<T extends QueryResultRow = QueryResultRow>(
    sql: string,
    params: unknown[] = [],
  ): Promise<DbResult<T>> {
    const result = await this.pool.query<T>(sql, params);
    return { rows: result.rows, rowCount: result.rowCount ?? result.rows.length };
  }

  async exec(sql: string): Promise<void> {
    await this.pool.query(sql);
  }

  async transaction<T>(fn: (tx: Queryable) => Promise<T>): Promise<T> {
    const client = await this.pool.connect();
    const tx: Queryable = {
      async query<R extends QueryResultRow = QueryResultRow>(
        sql: string,
        params: unknown[] = [],
      ): Promise<DbResult<R>> {
        const result = await client.query<R>(sql, params);
        return { rows: result.rows, rowCount: result.rowCount ?? result.rows.length };
      },
      async exec(sql: string): Promise<void> {
        await client.query(sql);
      },
    };
    try {
      await client.query('BEGIN');
      const value = await fn(tx);
      await client.query('COMMIT');
      return value;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async close(): Promise<void> {
    await this.pool.end();
  }
}

export function createPgliteDatabase(path?: string): Database {
  const client = path ? new PGlite(path) : new PGlite();
  return new PgliteDatabase(client);
}

export function createPostgresDatabase(connectionString: string): Database {
  const needsSsl =
    /neon\.tech|sslmode=require|render\.com/i.test(connectionString) &&
    !/localhost|127\.0\.0\.1/.test(connectionString);
  const pool = new pg.Pool({
    connectionString,
    max: 10,
    ssl: needsSsl ? { rejectUnauthorized: false } : undefined,
  });
  return new PgDatabase(pool);
}

/**
 * `pglite://ruta` usa PGlite persistente; una URL postgres:// usa pg.
 * Sin URL se usa PGlite en memoria (útil para desarrollo y tests).
 */
export function createDatabase(databaseUrl: string | undefined): Database {
  if (!databaseUrl || databaseUrl.startsWith('pglite://')) {
    const path = databaseUrl ? databaseUrl.slice('pglite://'.length) : undefined;
    return createPgliteDatabase(path || undefined);
  }
  if (!/^postgres(ql)?:\/\//.test(databaseUrl)) {
    throw new Error('DATABASE_URL debe empezar con postgresql:// o pglite://');
  }
  return createPostgresDatabase(databaseUrl);
}
