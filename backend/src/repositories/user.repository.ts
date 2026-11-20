import type { Queryable } from '../db/types.js';
import type { PublicUser, UserRow } from '../domain/types.js';

const columns = `id, email, password_hash, full_name, phone, role, blocked_until, created_at`;

export function toPublicUser(row: UserRow): PublicUser {
  return {
    id: row.id,
    email: row.email,
    fullName: row.full_name,
    phone: row.phone,
    role: row.role,
    blockedUntil: row.blocked_until
      ? new Date(row.blocked_until as string | Date).toISOString()
      : null,
  };
}

export class UserRepository {
  constructor(private readonly db: Queryable) {}

  async findByEmail(email: string): Promise<UserRow | null> {
    const result = await this.db.query<UserRow>(
      `SELECT ${columns} FROM users WHERE email = $1`,
      [email],
    );
    return result.rows[0] ?? null;
  }

  async findById(id: string): Promise<UserRow | null> {
    const result = await this.db.query<UserRow>(`SELECT ${columns} FROM users WHERE id = $1`, [id]);
    return result.rows[0] ?? null;
  }

  async create(input: {
    email: string;
    passwordHash: string;
    fullName: string;
    phone: string | null;
    role?: 'client' | 'admin';
  }): Promise<UserRow> {
    const result = await this.db.query<UserRow>(
      `INSERT INTO users (email, password_hash, full_name, phone, role)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING ${columns}`,
      [input.email, input.passwordHash, input.fullName, input.phone, input.role ?? 'client'],
    );
    return result.rows[0]!;
  }

  async setBlockedUntil(userId: string, blockedUntil: Date | null): Promise<void> {
    await this.db.query('UPDATE users SET blocked_until = $2 WHERE id = $1', [
      userId,
      blockedUntil,
    ]);
  }
}
