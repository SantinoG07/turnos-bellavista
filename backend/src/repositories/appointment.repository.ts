import type { Queryable } from '../db/types.js';
import type { AppointmentRow } from '../domain/types.js';
import type { AppointmentStatus } from '../domain/constants.js';

const detailedSelect = `
  SELECT a.*, s.name AS service_name, s.duration_min AS service_duration_min,
         p.name AS professional_name, u.full_name AS client_name,
         u.email AS client_email, u.phone AS client_phone
  FROM appointments a
  JOIN services s ON s.id = a.service_id
  JOIN professionals p ON p.id = a.professional_id
  JOIN users u ON u.id = a.client_id
`;

export class AppointmentRepository {
  constructor(private readonly db: Queryable) {}

  async findByIdDetailed(id: string): Promise<AppointmentRow | null> {
    const result = await this.db.query<AppointmentRow>(`${detailedSelect} WHERE a.id = $1`, [id]);
    return result.rows[0] ?? null;
  }

  async listMine(
    clientId: string,
    scope: 'upcoming' | 'past' | 'all',
    now: Date,
  ): Promise<AppointmentRow[]> {
    const filter =
      scope === 'upcoming'
        ? `AND a.starts_at >= $2 AND a.status = 'confirmed'`
        : scope === 'past'
          ? `AND (a.starts_at < $2 OR a.status <> 'confirmed')`
          : '';
    const result = await this.db.query<AppointmentRow>(
      `${detailedSelect}
       WHERE a.client_id = $1 ${filter}
       ORDER BY a.starts_at ${scope === 'past' ? 'DESC' : 'ASC'}`,
      scope === 'all' ? [clientId] : [clientId, now],
    );
    return result.rows;
  }

  async listByDate(from: Date, to: Date, status?: AppointmentStatus): Promise<AppointmentRow[]> {
    const filter = status ? `AND a.status = $3` : '';
    const params: unknown[] = [from, to];
    if (status) params.push(status);
    const result = await this.db.query<AppointmentRow>(
      `${detailedSelect}
       WHERE a.starts_at >= $1 AND a.starts_at < $2 ${filter}
       ORDER BY a.starts_at`,
      params,
    );
    return result.rows;
  }

  async countProfessionalOverlap(
    professionalId: string,
    startsAt: Date,
    endsAt: Date,
    excludeId?: string,
  ): Promise<number> {
    const result = await this.db.query<{ count: string }>(
      `SELECT count(*) FROM appointments
       WHERE professional_id = $1 AND status = 'confirmed'
         AND starts_at < $3 AND ends_at > $2
         ${excludeId ? 'AND id <> $4' : ''}`,
      excludeId
        ? [professionalId, startsAt, endsAt, excludeId]
        : [professionalId, startsAt, endsAt],
    );
    return Number(result.rows[0]?.count ?? 0);
  }

  async countClientOverlap(
    clientId: string,
    startsAt: Date,
    endsAt: Date,
    excludeId?: string,
  ): Promise<number> {
    const result = await this.db.query<{ count: string }>(
      `SELECT count(*) FROM appointments
       WHERE client_id = $1 AND status = 'confirmed'
         AND starts_at < $3 AND ends_at > $2
         ${excludeId ? 'AND id <> $4' : ''}`,
      excludeId ? [clientId, startsAt, endsAt, excludeId] : [clientId, startsAt, endsAt],
    );
    return Number(result.rows[0]?.count ?? 0);
  }

  async countUpcomingConfirmed(clientId: string, now: Date, excludeId?: string): Promise<number> {
    const result = await this.db.query<{ count: string }>(
      `SELECT count(*) FROM appointments
       WHERE client_id = $1 AND status = 'confirmed' AND starts_at >= $2
         ${excludeId ? 'AND id <> $3' : ''}`,
      excludeId ? [clientId, now, excludeId] : [clientId, now],
    );
    return Number(result.rows[0]?.count ?? 0);
  }

  async hasTimeOffOverlap(
    professionalId: string,
    startsAt: Date,
    endsAt: Date,
  ): Promise<boolean> {
    const result = await this.db.query<{ exists: boolean }>(
      `SELECT EXISTS(
         SELECT 1 FROM time_off
         WHERE professional_id = $1 AND starts_at < $3 AND ends_at > $2
       ) AS exists`,
      [professionalId, startsAt, endsAt],
    );
    return result.rows[0]?.exists === true;
  }

  async lockProfessional(professionalId: string): Promise<void> {
    await this.db.query('SELECT id FROM professionals WHERE id = $1 FOR UPDATE', [professionalId]);
  }

  async lockClient(clientId: string): Promise<void> {
    await this.db.query('SELECT id FROM users WHERE id = $1 FOR UPDATE', [clientId]);
  }

  async insert(input: {
    clientId: string;
    professionalId: string;
    serviceId: string;
    startsAt: Date;
    endsAt: Date;
    priceCents: number;
    notes: string | null;
  }): Promise<AppointmentRow> {
    const result = await this.db.query<AppointmentRow>(
      `INSERT INTO appointments
        (client_id, professional_id, service_id, starts_at, ends_at, status, price_cents, notes)
       VALUES ($1, $2, $3, $4, $5, 'confirmed', $6, $7)
       RETURNING *`,
      [
        input.clientId,
        input.professionalId,
        input.serviceId,
        input.startsAt,
        input.endsAt,
        input.priceCents,
        input.notes,
      ],
    );
    return result.rows[0]!;
  }

  async addEvent(
    appointmentId: string,
    type: string,
    actorId: string | null,
    metadata: Record<string, unknown> = {},
  ): Promise<void> {
    await this.db.query(
      `INSERT INTO appointment_events (appointment_id, type, actor_id, metadata)
       VALUES ($1, $2, $3, $4::jsonb)`,
      [appointmentId, type, actorId, JSON.stringify(metadata)],
    );
  }

  async lockAppointment(id: string): Promise<void> {
    await this.db.query('SELECT id FROM appointments WHERE id = $1 FOR UPDATE', [id]);
  }

  async cancelAppointment(
    id: string,
    input: { cancelledBy: string; reason: string | null; now: Date },
  ): Promise<AppointmentRow> {
    const result = await this.db.query<AppointmentRow>(
      `UPDATE appointments
       SET status = 'cancelled', cancelled_at = $2, cancelled_by = $3,
           cancellation_reason = $4, updated_at = $2
       WHERE id = $1
       RETURNING *`,
      [id, input.now, input.cancelledBy, input.reason],
    );
    return result.rows[0]!;
  }

  async rescheduleAppointment(
    id: string,
    startsAt: Date,
    endsAt: Date,
    now: Date,
  ): Promise<AppointmentRow> {
    const result = await this.db.query<AppointmentRow>(
      `UPDATE appointments
       SET starts_at = $2, ends_at = $3,
           reschedule_count = reschedule_count + 1, updated_at = $4
       WHERE id = $1
       RETURNING *`,
      [id, startsAt, endsAt, now],
    );
    return result.rows[0]!;
  }

  async setStatus(id: string, status: AppointmentStatus): Promise<AppointmentRow> {
    const result = await this.db.query<AppointmentRow>(
      `UPDATE appointments SET status = $2, updated_at = now() WHERE id = $1 RETURNING *`,
      [id, status],
    );
    return result.rows[0]!;
  }

  async countNoShowsSince(clientId: string, since: Date): Promise<number> {
    const result = await this.db.query<{ count: string }>(
      `SELECT count(*) FROM appointments
       WHERE client_id = $1 AND status = 'no_show' AND starts_at >= $2`,
      [clientId, since],
    );
    return Number(result.rows[0]?.count ?? 0);
  }

  async blockClient(clientId: string, blockedUntil: Date): Promise<void> {
    await this.db.query(
      `UPDATE users
       SET blocked_until = GREATEST(COALESCE(blocked_until, $2), $2)
       WHERE id = $1`,
      [clientId, blockedUntil],
    );
  }
}
