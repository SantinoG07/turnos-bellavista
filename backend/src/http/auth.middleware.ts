import type { NextFunction, Request, Response } from 'express';
import { forbidden, unauthorized } from '../domain/errors.js';
import { verifyToken } from '../auth/jwt.js';
import { toPublicUser, type UserRepository } from '../repositories/user.repository.js';
import type { PublicUser } from '../domain/types.js';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: PublicUser;
    }
  }
}

export function authenticate(users: UserRepository, jwtSecret: string) {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    try {
      const header = req.header('authorization') ?? '';
      const [scheme, token] = header.split(' ');
      if (scheme?.toLowerCase() !== 'bearer' || !token) {
        throw unauthorized();
      }
      const payload = verifyToken(token, jwtSecret);
      const row = await users.findById(payload.sub);
      if (!row) throw unauthorized('La cuenta ya no existe.');
      req.user = toPublicUser(row);
      next();
    } catch (error) {
      next(error);
    }
  };
}

export function requireAdmin(req: Request, _res: Response, next: NextFunction): void {
  if (!req.user) {
    next(unauthorized());
    return;
  }
  if (req.user.role !== 'admin') {
    next(forbidden('Esta sección es solo para administración.'));
    return;
  }
  next();
}
