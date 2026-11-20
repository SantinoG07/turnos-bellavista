import { ZodError, type ZodType } from 'zod';
import { badRequest } from '../domain/errors.js';

export function parseBody<T>(schema: ZodType<T>, value: unknown): T {
  const parsed = schema.safeParse(value);
  if (!parsed.success) {
    throw badRequest('Revisá los datos enviados.', flattenZod(parsed.error));
  }
  return parsed.data;
}

export function parseQuery<T>(schema: ZodType<T>, value: unknown): T {
  return parseBody(schema, value);
}

export function flattenZod(error: ZodError): Record<string, string[]> {
  const fields: Record<string, string[]> = {};
  for (const issue of error.issues) {
    const key = issue.path.join('.') || 'general';
    fields[key] ??= [];
    fields[key].push(issue.message);
  }
  return fields;
}
