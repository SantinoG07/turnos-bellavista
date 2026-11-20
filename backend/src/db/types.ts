import type { QueryResult, QueryResultRow } from 'pg';

export interface DbResult<T extends QueryResultRow = QueryResultRow> {
  rows: T[];
  rowCount: number;
}

/** Interfaz mínima que comparten PostgreSQL (pg) y PGlite. */
export interface Queryable {
  query<T extends QueryResultRow = QueryResultRow>(
    sql: string,
    params?: unknown[],
  ): Promise<DbResult<T>>;
  exec(sql: string): Promise<void>;
}

export interface Database extends Queryable {
  transaction<T>(fn: (tx: Queryable) => Promise<T>): Promise<T>;
  close(): Promise<void>;
}

export function emptyResult<T extends QueryResultRow>(): DbResult<T> {
  return { rows: [], rowCount: 0 };
}

export type { QueryResult, QueryResultRow };
