import type { Queryable } from '../db/types.js';

export interface ClientRow {
  id: string;
  email: string;
  full_name: string;
  phone: string | null;
  blocked_until: string | Date | null;
  created_at: string | Date;
  no_show_count: number | string;
  upcoming_count: number | string;
}

export interface TimeOffDetailedRow {
  id: string;
  professional_id: string;
  professional_name: string;
  starts_at: string | Date;
  ends_at: string | Date;
  reason: string;
  created_at: string | Date;
}

export interface MetricsRow {
  total: number | string;
  confirmed: number | string;
  cancelled: number | string;
  completed: number | string;
  no_show: number | string;
}

export class AdminRepository {
  constructor(private readonly db: Queryable) {}

  async listClients(query: string, now: Date): Promise<ClientRow[]> {
    const pattern = `%${query.trim().toLowerCase()}%`;
    const since = new Date(now.getTime() - 180 * 24 * 60 * 60_000);
    const result = await this.db.query<ClientRow>(
      `SELECT u.id, u.email, u.full_name, u.phone, u.blocked_until, u.created_at,
         (SELECT count(*) FROM appointments a
          WHERE a.client_id = u.id AND a.status = 'no_show' AND a.starts_at >= $2) AS no_show_count,
         (SELECT count(*) FROM appointments a
          WHERE a.client_id = u.id AND a.status = 'confirmed' AND a.starts_at >= $1) AS upcoming_count
       FROM users u
       WHERE u.role = 'client'
         AND ($3 = '%%' OR lower(u.full_name) LIKE $3 OR lower(u.email) LIKE $3)
       ORDER BY u.full_name`,
      [now, since, pattern],
    );
    return result.rows;
  }

  async unblockClient(id: string): Promise<boolean> {
    const result = await this.db.query(
      `UPDATE users SET blocked_until = NULL
       WHERE id = $1 AND role = 'client' RETURNING id`,
      [id],
    );
    return result.rowCount > 0;
  }

  async listTimeOff(from: Date, to: Date): Promise<TimeOffDetailedRow[]> {
    const result = await this.db.query<TimeOffDetailedRow>(
      `SELECT t.id, t.professional_id, p.name AS professional_name,
              t.starts_at, t.ends_at, t.reason, t.created_at
       FROM time_off t
       JOIN professionals p ON p.id = t.professional_id
       WHERE t.starts_at < $2 AND t.ends_at > $1
       ORDER BY t.starts_at`,
      [from, to],
    );
    return result.rows;
  }

  async createTimeOff(input: {
    professionalId: string;
    startsAt: Date;
    endsAt: Date;
    reason: string;
    createdBy: string;
  }): Promise<TimeOffDetailedRow> {
    const result = await this.db.query<TimeOffDetailedRow>(
      `WITH inserted AS (
         INSERT INTO time_off (professional_id, starts_at, ends_at, reason, created_by)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING *
       )
       SELECT i.id, i.professional_id, p.name AS professional_name,
              i.starts_at, i.ends_at, i.reason, i.created_at
       FROM inserted i JOIN professionals p ON p.id = i.professional_id`,
      [input.professionalId, input.startsAt, input.endsAt, input.reason, input.createdBy],
    );
    return result.rows[0]!;
  }

  async deleteTimeOff(id: string): Promise<boolean> {
    const result = await this.db.query('DELETE FROM time_off WHERE id = $1 RETURNING id', [id]);
    return result.rowCount > 0;
  }

  async metricsForRange(from: Date, to: Date): Promise<MetricsRow> {
    const result = await this.db.query<MetricsRow>(
      `SELECT count(*) AS total,
         count(*) FILTER (WHERE status = 'confirmed') AS confirmed,
         count(*) FILTER (WHERE status = 'cancelled') AS cancelled,
         count(*) FILTER (WHERE status = 'completed') AS completed,
         count(*) FILTER (WHERE status = 'no_show') AS no_show
       FROM appointments
       WHERE starts_at >= $1 AND starts_at < $2`,
      [from, to],
    );
    return (
      result.rows[0] ?? {
        total: 0,
        confirmed: 0,
        cancelled: 0,
        completed: 0,
        no_show: 0,
      }
    );
  }

  async countUpcoming(from: Date, to: Date): Promise<number> {
    const result = await this.db.query<{ count: string }>(
      `SELECT count(*) FROM appointments
       WHERE status = 'confirmed' AND starts_at >= $1 AND starts_at < $2`,
      [from, to],
    );
    return Number(result.rows[0]?.count ?? 0);
  }

  async countAppointmentsInRange(
    professionalId: string,
    from: Date,
    to: Date,
  ): Promise<number> {
    const result = await this.db.query<{ count: string }>(
      `SELECT count(*) FROM appointments
       WHERE professional_id = $1 AND status = 'confirmed'
         AND starts_at < $3 AND ends_at > $2`,
      [professionalId, from, to],
    );
    return Number(result.rows[0]?.count ?? 0);
  }
}
