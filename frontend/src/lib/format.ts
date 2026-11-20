const ZONE = 'America/Argentina/Buenos_Aires';

export function formatMoney(cents: number): string {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

export function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? `${hours} h` : `${hours} h ${rest} min`;
}

export function formatDateTime(iso: string): string {
  return new Intl.DateTimeFormat('es-AR', {
    timeZone: ZONE,
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(iso));
}

export function formatDateLong(iso: string): string {
  return new Intl.DateTimeFormat('es-AR', {
    timeZone: ZONE,
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date(iso));
}

export function formatTime(iso: string): string {
  return new Intl.DateTimeFormat('es-AR', {
    timeZone: ZONE,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(iso));
}

/** Fecha YYYY-MM-DD en la zona del negocio (no usar toISOString). */
export function dateInputValue(date: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? '';
  return `${get('year')}-${get('month')}-${get('day')}`;
}

export function addDaysToInput(value: string, days: number): string {
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year!, month! - 1, day! + days));
  return date.toISOString().slice(0, 10);
}

export function inputToLocalLabel(value: string): string {
  const [year, month, day] = value.split('-').map(Number);
  return new Intl.DateTimeFormat('es-AR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(new Date(Date.UTC(year!, month! - 1, day!, 12)));
}

export function canCancel(iso: string, now: Date = new Date()): boolean {
  return new Date(iso).getTime() - now.getTime() >= 2 * 60 * 60_000;
}

export function canComplete(iso: string, now: Date = new Date()): boolean {
  return now.getTime() >= new Date(iso).getTime();
}

export function canMarkNoShow(iso: string, now: Date = new Date()): boolean {
  return now.getTime() >= new Date(iso).getTime() + 15 * 60_000;
}

export function statusLabel(status: string): string {
  return (
    {
      confirmed: 'Confirmado',
      cancelled: 'Cancelado',
      completed: 'Atendido',
      no_show: 'Ausente',
    }[status] ?? status
  );
}

export function statusClass(status: string): string {
  return `badge badge-${status.replace('_', '-')}`;
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}

/** Convierte un datetime-local (hora del negocio) a ISO UTC. */
export function localInputToIso(value: string): string {
  // Argentina no aplica horario de verano: offset fijo -03:00.
  return new Date(`${value}:00-03:00`).toISOString();
}
