import { DateTime } from 'luxon';
import { badRequest, conflict, notFound } from '../domain/errors.js';
import { localDateKey, localSlotToDate } from '../domain/time.js';
import type { Database } from '../db/types.js';
import type { AppointmentStatus } from '../domain/constants.js';
import { AdminRepository, type ClientRow, type TimeOffDetailedRow } from '../repositories/admin.repository.js';
import { AppointmentRepository } from '../repositories/appointment.repository.js';
import { CatalogRepository } from '../repositories/catalog.repository.js';
import type { PublicAppointment } from '../http/appointment.mapper.js';
import { toPublicAppointment } from '../http/appointment.mapper.js';

export interface PublicClient {
  id: string;
  email: string;
  fullName: string;
  phone: string | null;
  blockedUntil: string | null;
  noShowCount: number;
  upcomingCount: number;
  createdAt: string;
}

export interface PublicTimeOff {
  id: string;
  professionalId: string;
  professionalName: string;
  startsAt: string;
  endsAt: string;
  reason: string;
}

export interface Metrics {
  date: string;
  total: number;
  confirmed: number;
  cancelled: number;
  completed: number;
  noShow: number;
  upcoming7Days: number;
}

function mapClient(row: ClientRow): PublicClient {
  return {
    id: row.id,
    email: row.email,
    fullName: row.full_name,
    phone: row.phone,
    blockedUntil: row.blocked_until
      ? new Date(row.blocked_until as string | Date).toISOString()
      : null,
    noShowCount: Number(row.no_show_count),
    upcomingCount: Number(row.upcoming_count),
    createdAt: new Date(row.created_at as string | Date).toISOString(),
  };
}

function mapTimeOff(row: TimeOffDetailedRow): PublicTimeOff {
  return {
    id: row.id,
    professionalId: row.professional_id,
    professionalName: row.professional_name,
    startsAt: new Date(row.starts_at as string | Date).toISOString(),
    endsAt: new Date(row.ends_at as string | Date).toISOString(),
    reason: row.reason,
  };
}

export class AdminService {
  constructor(
    private readonly db: Database,
    private readonly admin: AdminRepository,
    private readonly appointments: AppointmentRepository,
    private readonly catalog: CatalogRepository,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async listAppointments(
    date: string | undefined,
    status?: AppointmentStatus,
  ): Promise<PublicAppointment[]> {
    const day = date ?? localDateKey(this.now());
    this.assertDate(day);
    const from = localSlotToDate(day, 0);
    const to = localSlotToDate(day, 24 * 60);
    const rows = await this.appointments.listByDate(from, to, status);
    return rows.map((row) => toPublicAppointment(row, { includeClient: true }));
  }

  async getMetrics(date: string | undefined): Promise<Metrics> {
    const day = date ?? localDateKey(this.now());
    this.assertDate(day);
    const from = localSlotToDate(day, 0);
    const to = localSlotToDate(day, 24 * 60);
    const now = this.now();
    const [metrics, upcoming] = await Promise.all([
      this.admin.metricsForRange(from, to),
      this.admin.countUpcoming(now, new Date(now.getTime() + 7 * 24 * 60 * 60_000)),
    ]);
    return {
      date: day,
      total: Number(metrics.total),
      confirmed: Number(metrics.confirmed),
      cancelled: Number(metrics.cancelled),
      completed: Number(metrics.completed),
      noShow: Number(metrics.no_show),
      upcoming7Days: upcoming,
    };
  }

  async listClients(query = ''): Promise<PublicClient[]> {
    return (await this.admin.listClients(query, this.now())).map(mapClient);
  }

  async unblockClient(id: string): Promise<void> {
    if (!(await this.admin.unblockClient(id))) {
      throw notFound('No encontramos ese cliente.');
    }
  }

  async listTimeOff(from?: string, to?: string): Promise<PublicTimeOff[]> {
    const now = this.now();
    const fromDate = from ?? localDateKey(now);
    const toDate = to ?? localDateKey(new Date(now.getTime() + 60 * 24 * 60 * 60_000));
    this.assertDate(fromDate);
    this.assertDate(toDate);
    return (await this.admin.listTimeOff(localSlotToDate(fromDate, 0), localSlotToDate(toDate, 24 * 60))).map(
      mapTimeOff,
    );
  }

  async createTimeOff(
    actorId: string,
    input: {
      professionalId: string;
      startsAt: string;
      endsAt: string;
      reason: string;
    },
  ): Promise<PublicTimeOff> {
    const startsAt = new Date(input.startsAt);
    const endsAt = new Date(input.endsAt);
    if (Number.isNaN(startsAt.getTime()) || Number.isNaN(endsAt.getTime())) {
      throw badRequest('Las fechas del bloqueo no son válidas.');
    }
    if (endsAt.getTime() <= startsAt.getTime()) {
      throw badRequest('El bloqueo debe terminar después de empezar.');
    }
    if (input.reason.trim().length < 3) {
      throw badRequest('Indicá un motivo de al menos 3 caracteres.');
    }
    const professional = await this.catalog.findProfessional(input.professionalId);
    if (!professional || !professional.active) {
      throw badRequest('El profesional no existe o no está activo.');
    }

    const row = await this.db.transaction(async (tx) => {
      await tx.query('SELECT id FROM professionals WHERE id = $1 FOR UPDATE', [
        input.professionalId,
      ]);
      const existing = await tx.query<{ count: string }>(
        `SELECT count(*) FROM appointments
         WHERE professional_id = $1 AND status = 'confirmed'
           AND starts_at < $3 AND ends_at > $2`,
        [input.professionalId, startsAt, endsAt],
      );
      if (Number(existing.rows[0]?.count ?? 0) > 0) {
        throw conflict(
          'El bloqueo se superpone con turnos confirmados. Cancelalos primero.',
        );
      }
      const repo = new AdminRepository(tx);
      return repo.createTimeOff({
        professionalId: input.professionalId,
        startsAt,
        endsAt,
        reason: input.reason.trim(),
        createdBy: actorId,
      });
    });
    return mapTimeOff(row);
  }

  async deleteTimeOff(id: string): Promise<void> {
    if (!(await this.admin.deleteTimeOff(id))) {
      throw notFound('El bloqueo no existe.');
    }
  }

  private assertDate(value: string): void {
    if (!DateTime.fromISO(value).isValid || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      throw badRequest('La fecha debe tener formato YYYY-MM-DD.');
    }
  }
}
