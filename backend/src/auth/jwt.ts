import jwt from 'jsonwebtoken';
import { unauthorized } from '../domain/errors.js';
import { RULES } from '../domain/constants.js';
import type { UserRole } from '../domain/constants.js';

export interface TokenPayload {
  sub: string;
  role: UserRole;
}

export function signToken(
  user: { id: string; role: UserRole },
  secret: string,
  expiresIn: string = RULES.jwtExpiresIn,
): string {
  return jwt.sign({ role: user.role }, secret, {
    subject: user.id,
    expiresIn: expiresIn as jwt.SignOptions['expiresIn'],
    algorithm: 'HS256',
  });
}

export function verifyToken(token: string, secret: string): TokenPayload {
  try {
    const decoded = jwt.verify(token, secret, { algorithms: ['HS256'] });
    if (typeof decoded === 'string' || !decoded.sub || !decoded.role) {
      throw new Error('payload inválido');
    }
    return { sub: decoded.sub, role: decoded.role as UserRole };
  } catch {
    throw unauthorized('La sesión es inválida o venció. Volvé a iniciar sesión.');
  }
}
