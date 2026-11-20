import { describe, expect, it } from 'vitest';
import {
  addDaysToInput,
  canCancel,
  canComplete,
  canMarkNoShow,
  dateInputValue,
  formatDuration,
  formatMoney,
  formatTime,
  initials,
  inputToLocalLabel,
  localInputToIso,
  statusClass,
  statusLabel,
} from './format';

describe('T09 · formato de fechas y dinero', () => {
  it('formatea centavos como pesos argentinos', () => {
    const value = formatMoney(1_200_000);
    expect(value).toContain('12.000');
    expect(value).toContain('$');
  });

  it('formatea duraciones en minutos y horas', () => {
    expect(formatDuration(30)).toBe('30 min');
    expect(formatDuration(60)).toBe('1 h');
    expect(formatDuration(90)).toBe('1 h 30 min');
  });

  it('RN-34: calcula la fecha local de Buenos Aires, no UTC', () => {
    expect(dateInputValue(new Date('2026-11-21T02:30:00.000Z'))).toBe('2026-11-20');
    expect(dateInputValue(new Date('2026-11-21T03:30:00.000Z'))).toBe('2026-11-21');
  });

  it('suma días sin desfasajes de zona horaria', () => {
    expect(addDaysToInput('2026-11-30', 1)).toBe('2026-12-01');
    expect(addDaysToInput('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDaysToInput('2026-03-01', -1)).toBe('2026-02-28');
  });

  it('muestra una etiqueta local legible', () => {
    expect(inputToLocalLabel('2026-11-24')).toContain('martes');
    expect(inputToLocalLabel('2026-11-24')).toContain('24');
  });

  it('RN-23: permite cancelar con 2 horas o más', () => {
    const now = new Date('2026-11-24T12:00:00.000Z');
    expect(canCancel('2026-11-24T14:00:00.000Z', now)).toBe(true);
    expect(canCancel('2026-11-24T13:59:00.000Z', now)).toBe(false);
  });

  it('RN-29: permite completar desde el inicio', () => {
    const now = new Date('2026-11-24T13:00:00.000Z');
    expect(canComplete('2026-11-24T13:00:00.000Z', now)).toBe(true);
    expect(canComplete('2026-11-24T13:01:00.000Z', now)).toBe(false);
  });

  it('RN-30: permite marcar ausencia 15 minutos después', () => {
    const now = new Date('2026-11-24T13:15:00.000Z');
    expect(canMarkNoShow('2026-11-24T13:00:00.000Z', now)).toBe(true);
    expect(canMarkNoShow('2026-11-24T13:01:00.000Z', now)).toBe(false);
  });

  it('traduce estados para la UI', () => {
    expect(statusLabel('confirmed')).toBe('Confirmado');
    expect(statusLabel('no_show')).toBe('Ausente');
    expect(statusClass('no_show')).toBe('badge badge-no-show');
    expect(statusLabel('otro')).toBe('otro');
  });

  it('genera iniciales para el avatar', () => {
    expect(initials('Ana Pérez')).toBe('AP');
    expect(initials('Nico')).toBe('N');
    expect(initials('  ')).toBe('');
  });

  it('convierte datetime-local de Buenos Aires a UTC', () => {
    expect(localInputToIso('2026-11-24T10:00')).toBe('2026-11-24T13:00:00.000Z');
    expect(localInputToIso('2026-07-24T10:00')).toBe('2026-07-24T13:00:00.000Z');
  });

  it('formatea la hora en la zona del negocio', () => {
    expect(formatTime('2026-11-24T13:00:00.000Z')).toBe('10:00');
  });
});
