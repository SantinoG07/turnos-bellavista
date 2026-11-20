import cors from 'cors';
import express, { type Express, type NextFunction, type Request, type Response } from 'express';
import helmet from 'helmet';
import { ZodError } from 'zod';
import type { Database } from './db/types.js';
import { AppError, badRequest } from './domain/errors.js';
import { flattenZod } from './http/validation.js';
import { createApiRouter } from './http/routes/index.js';

export interface AppDependencies {
  db: Database;
  jwtSecret?: string;
  now?: () => Date;
  corsOrigin?: string;
  rateLimit?: {
    max?: number;
    windowMs?: number;
  };
}

export function createCorsOrigin(origin: string | undefined) {
  if (!origin || origin === '*') return true;
  const allowed = origin
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
  return (requestOrigin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
    if (!requestOrigin || allowed.includes(requestOrigin)) {
      callback(null, true);
      return;
    }
    callback(new Error('Origen no permitido por CORS'));
  };
}

export function createApp(deps: AppDependencies): Express {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', 1);

  app.use(helmet());
  app.use(
    cors({
      origin: createCorsOrigin(deps.corsOrigin ?? process.env.CORS_ORIGIN),
      credentials: false,
    }),
  );
  app.use(express.json({ limit: '200kb' }));

  app.get('/api/health', async (_req, res, next) => {
    try {
      await deps.db.query('SELECT 1');
      res.json({ status: 'ok', database: 'ok', timestamp: new Date().toISOString() });
    } catch (error) {
      next(error);
    }
  });

  app.use('/api', createApiRouter(deps));

  app.use('/api', (_req, _res, next) => {
    next(new AppError(404, 'NOT_FOUND', 'Endpoint no encontrado.'));
  });

  app.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
    if (error instanceof AppError) {
      res.status(error.status).json({
        error: { code: error.code, message: error.message, details: error.details },
      });
      return;
    }
    if (error instanceof ZodError) {
      res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Revisá los datos enviados.',
          details: flattenZod(error),
        },
      });
      return;
    }
    if (error instanceof SyntaxError && 'body' in error) {
      const invalid = badRequest('El cuerpo JSON no es válido.');
      res.status(invalid.status).json({
        error: { code: invalid.code, message: invalid.message },
      });
      return;
    }
    console.error('Error inesperado:', error);
    res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: 'Ocurrió un error inesperado.' },
    });
  });

  return app;
}
