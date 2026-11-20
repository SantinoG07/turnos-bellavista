export const RULES = {
  slotGridMinutes: 15,
  minNoticeMinutes: 120,
  maxAdvanceDays: 60,
  maxUpcomingAppointments: 3,
  cancellationWindowMinutes: 120,
  maxReschedules: 2,
  noShowGraceMinutes: 15,
  noShowWindowDays: 180,
  noShowThreshold: 3,
  noShowBlockDays: 30,
  jwtExpiresIn: '7d',
  loginMaxAttempts: 10,
  loginWindowMinutes: 15,
} as const;

export const BUSINESS_TIMEZONE = 'America/Argentina/Buenos_Aires';

export const APPOINTMENT_STATUSES = [
  'confirmed',
  'cancelled',
  'completed',
  'no_show',
] as const;

export type AppointmentStatus = (typeof APPOINTMENT_STATUSES)[number];
export type UserRole = 'client' | 'admin';
