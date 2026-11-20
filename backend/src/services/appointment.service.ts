import { DateTime } from 'luxon';
import { RULES } from '../domain/constants.js';
import { badRequest, ruleViolation } from '../domain/errors.js';
import { isAlignedToSlotGrid, localDateKey } from '../domain/time.js';
import type { Database } from '../db/types.js';
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

export class AppointmentService {
  constructor(
    private readonly db: Database,
    private readonly appointments: AppointmentRepository,
    private readonly catalogService: CatalogService,
    private readonly availabilityService: AvailabilityService,
    private readonly authService: AuthService,
    private readonly now: () => Date = () => new Date(),
  ) {}

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

    const created = await this.db.transaction(async (tx) => {
      const txRepo = new AppointmentRepository(tx);
      // Serializa reservas del mismo profesional y del mismo cliente.
      await txRepo.lockProfessional(input.professionalId);
      await txRepo.lockClient(clientId);

      if (
        (await txRepo.countProfessionalOverlap(input.professionalId, startsAt, endsAt)) > 0
      ) {
        throw ruleViolation('El profesional ya tiene un turno en ese horario.');
      }
      if ((await txRepo.countClientOverlap(clientId, startsAt, endsAt)) > 0) {
        throw ruleViolation('Ya tenés otro turno en ese horario.');
      }
      if (
        (await txRepo.countUpcomingConfirmed(clientId, now)) >=
        RULES.maxUpcomingAppointments
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
    return toPublicAppointment(detailed ?? created);
  }
}
