export type ErrorCode =
  | 'VALIDATION_ERROR'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'RULE_VIOLATION'
  | 'RATE_LIMITED'
  | 'INTERNAL_ERROR';

export class AppError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: ErrorCode,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export const badRequest = (message: string, details?: unknown) =>
  new AppError(400, 'VALIDATION_ERROR', message, details);

export const unauthorized = (message = 'Necesitás iniciar sesión.') =>
  new AppError(401, 'UNAUTHORIZED', message);

export const forbidden = (message = 'No tenés permiso para realizar esta acción.') =>
  new AppError(403, 'FORBIDDEN', message);

export const notFound = (message = 'No encontramos lo que buscabas.') =>
  new AppError(404, 'NOT_FOUND', message);

export const conflict = (message: string, details?: unknown) =>
  new AppError(409, 'CONFLICT', message, details);

export const ruleViolation = (message: string, details?: unknown) =>
  new AppError(422, 'RULE_VIOLATION', message, details);
