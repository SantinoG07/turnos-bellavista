import { badRequest, conflict, forbidden, unauthorized } from '../domain/errors.js';
import { isStrongEnough, hashPassword, verifyPassword } from '../auth/password.js';
import { signToken } from '../auth/jwt.js';
import type { PublicUser } from '../domain/types.js';
import { toPublicUser, type UserRepository } from '../repositories/user.repository.js';

export interface RegisterInput {
  email: string;
  password: string;
  fullName: string;
  phone?: string | null;
}

export interface LoginInput {
  email: string;
  password: string;
}

export interface AuthResult {
  token: string;
  user: PublicUser;
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function isBlocked(user: PublicUser, now: Date): boolean {
  return user.blockedUntil !== null && new Date(user.blockedUntil).getTime() > now.getTime();
}

export class AuthService {
  constructor(
    private readonly users: UserRepository,
    private readonly jwtSecret: string,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async register(input: RegisterInput): Promise<AuthResult> {
    const email = normalizeEmail(input.email);
    const fullName = input.fullName.trim();
    if (!isStrongEnough(input.password)) {
      throw badRequest(
        'La contraseña debe tener al menos 8 caracteres, una letra y un número.',
        { password: ['Mínimo 8 caracteres, con al menos una letra y un número.'] },
      );
    }
    const existing = await this.users.findByEmail(email);
    if (existing) throw conflict('Ya existe una cuenta con ese email.');

    const passwordHash = await hashPassword(input.password);
    let row;
    try {
      row = await this.users.create({
        email,
        passwordHash,
        fullName,
        phone: input.phone?.trim() || null,
      });
    } catch (error) {
      if (isUniqueViolation(error)) throw conflict('Ya existe una cuenta con ese email.');
      throw error;
    }
    const user = toPublicUser(row);
    return { token: signToken({ id: user.id, role: user.role }, this.jwtSecret), user };
  }

  async login(input: LoginInput): Promise<AuthResult> {
    const email = normalizeEmail(input.email);
    const row = await this.users.findByEmail(email);
    if (!row) throw unauthorized('Email o contraseña incorrectos.');
    const valid = await verifyPassword(input.password, row.password_hash);
    if (!valid) throw unauthorized('Email o contraseña incorrectos.');
    const user = toPublicUser(row);
    return { token: signToken({ id: user.id, role: user.role }, this.jwtSecret), user };
  }

  async me(userId: string): Promise<PublicUser> {
    const row = await this.users.findById(userId);
    if (!row) throw unauthorized('La cuenta ya no existe.');
    return toPublicUser(row);
  }

  async requireBookingAllowed(userId: string): Promise<PublicUser> {
    const user = await this.me(userId);
    if (isBlocked(user, this.now())) {
      throw forbidden(
        `Tu cuenta está bloqueada hasta ${new Date(user.blockedUntil!).toISOString()} por ausencias reiteradas.`,
      );
    }
    return user;
  }
}

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: string }).code === '23505'
  );
}
