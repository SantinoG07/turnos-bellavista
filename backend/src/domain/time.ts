import { DateTime } from 'luxon';
import { BUSINESS_TIMEZONE, RULES } from './constants.js';

export function toDateTime(value: Date | string): DateTime {
  return DateTime.fromJSDate(value instanceof Date ? value : new Date(value), {
    zone: 'utc',
  });
}

export function toUtcDate(value: Date | string): Date {
  return value instanceof Date ? value : new Date(value);
}

export function localDateTime(value: Date | string): DateTime {
  return DateTime.fromJSDate(toUtcDate(value), { zone: BUSINESS_TIMEZONE });
}

export function localDateKey(value: Date | string): string {
  return localDateTime(value).toISODate() ?? '';
}

export function localTimeLabel(value: Date | string): string {
  return localDateTime(value).toFormat('HH:mm');
}

/** Convierte una fecha local (YYYY-MM-DD) y minutos desde medianoche a un Date UTC. */
export function localSlotToDate(dateKey: string, minute: number): Date {
  const local = DateTime.fromISO(dateKey, { zone: BUSINESS_TIMEZONE });
  if (!local.isValid) throw new Error(`Fecha inválida: ${dateKey}`);
  return local.startOf('day').plus({ minutes: minute }).toUTC().toJSDate();
}

export function isDateKey(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && DateTime.fromISO(value).isValid;
}

export function weekdayOfDateKey(dateKey: string): number {
  const local = DateTime.fromISO(dateKey, { zone: BUSINESS_TIMEZONE });
  return local.weekday % 7; // Luxon: 1=lunes … 7=domingo; regla: 0=domingo
}

export function rangesOverlap(
  aStart: Date | string,
  aEnd: Date | string,
  bStart: Date | string,
  bEnd: Date | string,
): boolean {
  return (
    toUtcDate(aStart).getTime() < toUtcDate(bEnd).getTime() &&
    toUtcDate(bStart).getTime() < toUtcDate(aEnd).getTime()
  );
}

export function addMinutes(value: Date, minutes: number): Date {
  return new Date(value.getTime() + minutes * 60_000);
}

export function addDays(value: Date, days: number): Date {
  return new Date(value.getTime() + days * 24 * 60 * 60_000);
}

/** RN-14: el inicio debe caer en la grilla de 15 minutos en hora local. */
export function isAlignedToSlotGrid(value: Date | string): boolean {
  const local = localDateTime(value);
  return (
    local.second === 0 &&
    local.millisecond === 0 &&
    local.minute % RULES.slotGridMinutes === 0
  );
}

export function startOfLocalDay(value: Date | string): Date {
  return localDateTime(value).startOf('day').toUTC().toJSDate();
}

export function endOfLocalDay(value: Date | string): Date {
  return localDateTime(value).endOf('day').toUTC().toJSDate();
}

export function daysBetween(from: Date, to: Date): number {
  return Math.floor((to.getTime() - from.getTime()) / (24 * 60 * 60_000));
}

export function formatLocalDateTime(value: Date | string): string {
  return localDateTime(value).setLocale('es-AR').toFormat("cccc d 'de' LLLL, HH:mm");
}
