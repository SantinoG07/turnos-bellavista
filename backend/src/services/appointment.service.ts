import { DateTime } from 'luxon';
import { RULES, type AppointmentStatus, type UserRole } from '../domain/constants.js';
import { badRequest, conflict, forbidden, notFound, ruleViolation } from '../domain/errors.js';
import { isAlignedToSlotGrid, localDateKey } from '../domain/time.js';
import type { Database } from '../db/types.js';
import type { AppointmentRow } from '../domain/types.js';
import { AppointmentRepository } from '../repositories/appointment.repository.js';
import type { AvailabilityService } from './availability.service.js';
import type { AuthService } from './auth.service.js';
import type { CatalogService } from './catalog.service.js';
import { toPublicAppointment, type PublicAppointment } from '../http/appointment.mapper.js';

export interface CreateAppointmentInput {
  serviceId: string;
  professionalId: string;
  startsAt: string;
  notes?: string | null;
}

export interface Actor {
  id: string;
  role: UserRole;
}

const TERMINAL: AppointmentStatus[] = ['cancelled', 'completed', 'no_show'];

export class AppointmentService {
  constructor(
    private readonly db: Database,
    private readonly appointments: AppointmentRepository,
    private readonly catalogService: CatalogService,
    private readonly availabilityService: AvailabilityService,
    private readonly authService: AuthService,
    private readonly now: () => Date = () => new Date(),
  ) {}

  private map(row: AppointmentRow, includeClient = false): PublicAppointment {
    return toPublicAppointment(row, { includeClient });
  }

  async create(clientId: string, input: CreateAppointmentInput): Promise<PublicAppointment> {
    await this.authService.requireBookingAllowed(clientId);
    const { service } = await this.catalogService.ensureBookable(
      input.serviceId,
      input.professionalId,
    );

    const startsAt = new Date(input.startsAt);
    if (Number.isNaN(startsAt.getTime())) {
      throw badRequest('La fecha y hora del turno no es válida.');
    }
    // RN-14: grilla de 15 minutos, sin segundos.
    if (!isAlignedToSlotGrid(startsAt)) {
      throw ruleViolation('El horario debe estar en la grilla de 15 minutos.');
    }

    const now = this.now();
    // RN-18: no en el pasado y con 2 horas de anticipación.
    if (startsAt.getTime() < now.getTime() + RULES.minNoticeMinutes * 60_000) {
      throw ruleViolation('Necesitás al menos 2 horas de anticipación para reservar.');
    }

    // RN-19: hasta 60 días corridos.
    const today = DateTime.fromISO(localDateKey(now)).startOf('day');
    const target = DateTime.fromISO(localDateKey(startsAt)).startOf('day');
    if (target.diff(today, 'days').days > RULES.maxAdvanceDays) {
      throw ruleViolation(
        `Solo se pueden reservar turnos con hasta ${RULES.maxAdvanceDays} días de anticipación.`,
      );
    }

    const endsAt = new Date(startsAt.getTime() + service.duration_min * 60_000);

    // RN-13/15/16/20: el horario debe existir en la disponibilidad calculada.
    const availability = await this.availabilityService.getSlots({
      professionalId: input.professionalId,
      serviceId: input.serviceId,
      date: localDateKey(startsAt),
    });
    if (!availability.slots.some((slot) => slot.startsAt === startsAt.toISOString())) {
      throw ruleViolation('Ese horario ya no está disponible. Elegí otro.');
    }

    const created = await this.withRepoTransaction(async (txRepo) => {
      // Serializa reservas del mismo profesional y del mismo cliente.
      await txRepo.lockProfessional(input.professionalId);
      await txRepo.lockClient(clientId);

      if ((await txRepo.countProfessionalOverlap(input.professionalId, startsAt, endsAt)) > 0) {
        throw ruleViolation('El profesional ya tiene un turno en ese horario.');
      }
      if ((await txRepo.countClientOverlap(clientId, startsAt, endsAt)) > 0) {
        throw ruleViolation('Ya tenés otro turno en ese horario.');
      }
      if (
        (await txRepo.countUpcomingConfirmed(clientId, now)) >= RULES.maxUpcomingAppointments
      ) {
        throw ruleViolation(
          `Podés tener como máximo ${RULES.maxUpcomingAppointments} turnos futuros. Cancelá uno antes de reservar otro.`,
        );
      }
      if (await txRepo.hasTimeOffOverlap(input.professionalId, startsAt, endsAt)) {
        throw ruleViolation('El profesional bloqueó ese horario.');
      }

      const row = await txRepo.insert({
        clientId,
        professionalId: input.professionalId,
        serviceId: input.serviceId,
        startsAt,
        endsAt,
        priceCents: service.price_cents,
        notes: input.notes?.trim() || null,
      });
      await txRepo.addEvent(row.id, 'created', clientId, {
        startsAt: startsAt.toISOString(),
        professionalId: input.professionalId,
        serviceId: input.serviceId,
      });
      return row;
    });

    const detailed = await this.appointments.findByIdDetailed(created.id);
    return this.map(detailed ?? created);
  }

  async getById(actor: Actor, id: string): Promise<PublicAppointment> {
    const row = await this.appointments.findByIdDetailed(id);
    if (!row) throw notFound('El turno no existe.');
    if (actor.role !== 'admin' && row.client_id !== actor.id) {
      throw notFound('El turno no existe.');
    }
    return this.map(row, actor.role === 'admin');
  }

  async listMine(
    actor: Actor,
    scope: 'upcoming' | 'past' | 'all',
  ): Promise<PublicAppointment[]> {
    const rows = await this.appointments.listMine(actor.id, scope, this.now());
    return rows.map((row) => this.map(row));
  }

  /** RN-23, RN-24, RN-25, RN-26 y RN-32. */
  async cancel(actor: Actor, id: string, reason?: string | null): Promise<PublicAppointment> {
    const now = this.now();
    const detail = reason?.trim() ?? '';
    if (actor.role === 'admin' && detail.length < 5) {
      throw badRequest('Indicá un motivo de cancelación de al menos 5 caracteres.');
    }

    const updated = await this.withRepoTransaction(async (txRepo) => {
      const row = await this.lockAppointment(txRepo, id);
      this.assertOwnerOrAdmin(actor, row);
      this.assertNotTerminal(row);

      if (actor.role === 'client') {
        const limit = new Date(new Date(row.starts_at).getTime() - RULES.cancellationWindowMinutes * 60_000);
        if (now.getTime() > limit.getTime()) {
          throw ruleViolation(
            'Faltan menos de 2 horas para el turno. No se puede cancelar desde la web; llamá a la barbería.',
          );
        }
      }

      const updated = await txRepo.cancelAppointment(id, {
        cancelledBy: actor.id,
        reason: detail || null,
        now,
      });
      await txRepo.addEvent(id, 'cancelled', actor.id, {
        reason: detail || null,
        by: actor.role,
      });
      return updated;
    });

    const detailed = await this.appointments.findByIdDetailed(updated.id);
    return this.map(detailed ?? updated, actor.role === 'admin');
  }

  /** RN-27, RN-28 y RN-32. */
  async reschedule(actor: Actor, id: string, startsAtInput: string): Promise<PublicAppointment> {
    const now = this.now();
    if (actor.role === 'client') {
      await this.authService.requireBookingAllowed(actor.id);
    }

    const current = await this.appointments.findByIdDetailed(id);
    if (!current) throw notFound('El turno no existe.');
    this.assertOwnerOrAdmin(actor, current);
    this.assertNotTerminal(current);

    if (current.reschedule_count >= RULES.maxReschedules) {
      throw ruleViolation(
        `Este turno ya se reprogramó ${RULES.maxReschedules} veces. Reservá un turno nuevo.`,
      );
    }
    const currentStart = new Date(current.starts_at);
    if (now.getTime() > currentStart.getTime() - RULES.cancellationWindowMinutes * 60_000) {
      throw ruleViolation('Solo se puede reprogramar hasta 2 horas antes del turno.');
    }

    const startsAt = new Date(startsAtInput);
    if (Number.isNaN(startsAt.getTime())) {
      throw badRequest('La fecha y hora del turno no es válida.');
    }
    if (!isAlignedToSlotGrid(startsAt)) {
      throw ruleViolation('El horario debe estar en la grilla de 15 minutos.');
    }
    if (startsAt.getTime() < now.getTime() + RULES.minNoticeMinutes * 60_000) {
      throw ruleViolation('Necesitás al menos 2 horas de anticipación para reprogramar.');
    }

    const service = await this.catalogService.getServiceOrFail(current.service_id);
    const endsAt = new Date(startsAt.getTime() + service.duration_min * 60_000);
    const availability = await this.availabilityService.getSlots({
      professionalId: current.professional_id,
      serviceId: current.service_id,
      date: localDateKey(startsAt),
    });
    if (!availability.slots.some((slot) => slot.startsAt === startsAt.toISOString())) {
      throw ruleViolation('Ese horario ya no está disponible. Elegí otro.');
    }

    const updated = await this.withRepoTransaction(async (txRepo) => {
      await txRepo.lockProfessional(current.professional_id);
      await txRepo.lockClient(current.client_id);
      const row = await this.lockAppointment(txRepo, id);
      this.assertNotTerminal(row);

      if (
        (await txRepo.countProfessionalOverlap(
          current.professional_id,
          startsAt,
          endsAt,
          id,
        )) > 0
      ) {
        throw ruleViolation('El profesional ya tiene un turno en ese horario.');
      }
      if ((await txRepo.countClientOverlap(current.client_id, startsAt, endsAt, id)) > 0) {
        throw ruleViolation('Ya tenés otro turno en ese horario.');
      }
      if (await txRepo.hasTimeOffOverlap(current.professional_id, startsAt, endsAt)) {
        throw ruleViolation('El profesional bloqueó ese horario.');
      }

      const result = await txRepo.rescheduleAppointment(id, startsAt, endsAt, now);
      await txRepo.addEvent(id, 'rescheduled', actor.id, {
        from: new Date(row.starts_at).toISOString(),
        to: startsAt.toISOString(),
        rescheduleCount: result.reschedule_count,
      });
      return result;
    });

    const detailed = await this.appointments.findByIdDetailed(updated.id);
    return this.map(detailed ?? updated, actor.role === 'admin');
  }

  /** RN-29 y RN-32. */
  async complete(actor: Actor, id: string): Promise<PublicAppointment> {
    const now = this.now();
    const updated = await this.withRepoTransaction(async (txRepo) => {
      const row = await this.lockAppointment(txRepo, id);
      this.assertNotTerminal(row);
      if (now.getTime() < new Date(row.starts_at).getTime()) {
        throw ruleViolation('Todavía no comenzó el turno.');
      }
      const result = await txRepo.setStatus(id, 'completed');
      await txRepo.addEvent(id, 'completed', actor.id, {});
      return result;
    });
    const detailed = await this.appointments.findByIdDetailed(updated.id);
    return this.map(detailed ?? updated, true);
  }

  /** RN-30, RN-31 y RN-32. */
  async markNoShow(actor: Actor, id: string): Promise<PublicAppointment> {
    const now = this.now();
    const updated = await this.withRepoTransaction(async (txRepo) => {
      const row = await this.lockAppointment(txRepo, id);
      this.assertNotTerminal(row);
      const grace = new Date(new Date(row.starts_at).getTime() + RULES.noShowGraceMinutes * 60_000);
      if (now.getTime() < grace.getTime()) {
        throw ruleViolation(
          `Podés marcar la ausencia recién ${RULES.noShowGraceMinutes} minutos después del inicio.`,
        );
      }
      const result = await txRepo.setStatus(id, 'no_show');
      await txRepo.addEvent(id, 'no_show', actor.id, {});

      const since = new Date(now.getTime() - RULES.noShowWindowDays * 24 * 60 * 60_000);
      const count = await txRepo.countNoShowsSince(row.client_id, since);
      if (count >= RULES.noShowThreshold) {
        const blockedUntil = new Date(
          now.getTime() + RULES.noShowBlockDays * 24 * 60 * 60_000,
        );
        await txRepo.blockClient(row.client_id, blockedUntil);
        await txRepo.addEvent(id, 'client_blocked', actor.id, {
          noShows: count,
          blockedUntil: blockedUntil.toISOString(),
        });
      }
      return result;
    });
    const detailed = await this.appointments.findByIdDetailed(updated.id);
    return this.map(detailed ?? updated, true);
  }

  private assertOwnerOrAdmin(actor: Actor, row: AppointmentRow): void {
    if (actor.role !== 'admin' && row.client_id !== actor.id) {
      throw notFound('El turno no existe.');
    }
  }

  private assertNotTerminal(row: AppointmentRow): void {
    if (TERMINAL.includes(row.status)) {
      throw conflict('El turno ya está cerrado y no se puede modificar.');
    }
    if (row.status !== 'confirmed') {
      throw conflict('El turno no está confirmado.');
    }
  }

  private async lockAppointment(
    repo: AppointmentRepository,
    id: string,
  ): Promise<AppointmentRow> {
    await repo.lockAppointment(id);
    const row = await repo.findByIdDetailed(id);
    if (!row) throw notFound('El turno no existe.');
    return row;
  }

  private withRepoTransaction<T>(
    fn: (repo: AppointmentRepository) => Promise<T>,
  ): Promise<T> {
    return this.db.transaction((tx) => fn(new AppointmentRepository(tx)));
  }
}
