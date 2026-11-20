import { describe, expect, it } from 'vitest';
import {
  addMinutes,
  isAlignedToSlotGrid,
  localDateKey,
  localSlotToDate,
  localTimeLabel,
  rangesOverlap,
  weekdayOfDateKey,
} from './time.js';

describe('T03 · utilidades de fecha y zona horaria', () => {
  it('RN-34: convierte 10:00 de Buenos Aires a 13:00Z', () => {
    const date = localSlotToDate('2026-01-15', 10 * 60);
    expect(date.toISOString()).toBe('2026-01-15T13:00:00.000Z');
  });

  it('RN-34: mantiene el offset de invierno (sin DST en Argentina)', () => {
    const date = localSlotToDate('2026-07-15', 10 * 60);
    expect(date.toISOString()).toBe('2026-07-15T13:00:00.000Z');
  });

  it('RN-34: obtiene la fecha local de un instante UTC', () => {
    expect(localDateKey('2026-01-16T02:30:00.000Z')).toBe('2026-01-15');
    expect(localTimeLabel('2026-01-16T02:30:00.000Z')).toBe('23:30');
  });

  it('RN-13: calcula el weekday con domingo=0', () => {
    expect(weekdayOfDateKey('2026-11-22')).toBe(0); // domingo
    expect(weekdayOfDateKey('2026-11-24')).toBe(2); // martes
    expect(weekdayOfDateKey('2026-11-28')).toBe(6); // sábado
  });

  it('RN-14: valida la grilla de 15 minutos', () => {
    expect(isAlignedToSlotGrid('2026-11-24T13:00:00.000Z')).toBe(true);
    expect(isAlignedToSlotGrid('2026-11-24T13:15:00.000Z')).toBe(true);
    expect(isAlignedToSlotGrid('2026-11-24T13:07:00.000Z')).toBe(false);
    expect(isAlignedToSlotGrid('2026-11-24T13:15:30.000Z')).toBe(false);
  });

  it('detecta superposición de intervalos semiabiertos', () => {
    const start = new Date('2026-11-24T13:00:00.000Z');
    expect(rangesOverlap(start, addMinutes(start, 30), start, addMinutes(start, 30))).toBe(true);
    expect(
      rangesOverlap(start, addMinutes(start, 30), addMinutes(start, 30), addMinutes(start, 60)),
    ).toBe(false);
  });
});
