import { DateTime } from 'luxon';
import { RULES } from '../domain/constants.js';
import { ruleViolation } from '../domain/errors.js';
import {
  localDateKey,
  localSlotToDate,
  localTimeLabel,
  rangesOverlap,
  weekdayOfDateKey,
} from '../domain/time.js';
import type { CatalogRepository } from '../repositories/catalog.repository.js';
import type { CatalogService } from './catalog.service.js';

export interface Slot {
  startsAt: string;
  label: string;
}

export interface AvailabilityResult {
  date: string;
  timezone: string;
  slots: Slot[];
}

export class AvailabilityService {
  constructor(
    private readonly catalog: CatalogRepository,
    private readonly catalogService: CatalogService,
    private readonly now: () => Date = () => new Date(),
  ) {}

  /** RN-13 a RN-21: calcula los horarios reservables de un día local. */
  async getSlots(input: {
    professionalId: string;
    serviceId: string;
    date: string;
  }): Promise<AvailabilityResult> {
    const { service } = await this.catalogService.ensureBookable(
      input.serviceId,
      input.professionalId,
    );

    const now = this.now();
    const todayKey = localDateKey(now);
    const requested = DateTime.fromISO(input.date, { zone: 'America/Argentina/Buenos_Aires' });
    if (!requested.isValid) throw ruleViolation('La fecha solicitada no es válida.');

    const diffDays = Math.floor(
      DateTime.fromISO(input.date)
        .startOf('day')
        .diff(DateTime.fromISO(todayKey).startOf('day'), 'days').days,
    );
    if (diffDays < 0) throw ruleViolation('No se pueden reservar turnos en el pasado.');
    if (diffDays > RULES.maxAdvanceDays) {
      throw ruleViolation(
        `Solo se pueden reservar turnos con hasta ${RULES.maxAdvanceDays} días de anticipación.`,
      );
    }

    const weekday = weekdayOfDateKey(input.date);
    const rules = (await this.catalog.listAvailabilityRules(input.professionalId)).filter(
      (rule) => rule.weekday === weekday,
    );
    if (rules.length === 0) {
      return {
        date: input.date,
        timezone: 'America/Argentina/Buenos_Aires',
        slots: [],
      };
    }

    const dayStart = localSlotToDate(input.date, 0);
    const dayEnd = localSlotToDate(input.date, 24 * 60);
    const [timeOff, busy] = await Promise.all([
      this.catalog.listTimeOffOverlapping(input.professionalId, dayStart, dayEnd),
      this.catalog.listBusyAppointments(input.professionalId, dayStart, dayEnd),
    ]);

    const earliest = new Date(now.getTime() + RULES.minNoticeMinutes * 60_000);
    const slots: Slot[] = [];

    for (const rule of rules) {
      for (
        let minute = rule.start_minute;
        minute + service.duration_min <= rule.end_minute;
        minute += RULES.slotGridMinutes
      ) {
        const startsAt = localSlotToDate(input.date, minute);
        const endsAt = new Date(startsAt.getTime() + service.duration_min * 60_000);

        if (startsAt.getTime() < earliest.getTime()) continue;
        if (timeOff.some((block) => rangesOverlap(startsAt, endsAt, block.starts_at, block.ends_at))) {
          continue;
        }
        if (busy.some((item) => rangesOverlap(startsAt, endsAt, item.starts_at, item.ends_at))) {
          continue;
        }
        slots.push({
          startsAt: startsAt.toISOString(),
          label: localTimeLabel(startsAt),
        });
      }
    }

    slots.sort((a, b) => a.startsAt.localeCompare(b.startsAt));
    return {
      date: input.date,
      timezone: 'America/Argentina/Buenos_Aires',
      slots,
    };
  }
}
