export type Role = 'client' | 'admin';

export interface User {
  id: string;
  email: string;
  fullName: string;
  phone: string | null;
  role: Role;
  blockedUntil: string | null;
}

export interface Service {
  id: string;
  name: string;
  description: string;
  durationMin: number;
  priceCents: number;
}

export interface Professional {
  id: string;
  name: string;
  bio: string;
  serviceIds: string[];
}

export interface Slot {
  startsAt: string;
  label: string;
}

export interface Availability {
  date: string;
  timezone: string;
  slots: Slot[];
}

export type AppointmentStatus = 'confirmed' | 'cancelled' | 'completed' | 'no_show';

export interface Appointment {
  id: string;
  startsAt: string;
  endsAt: string;
  status: AppointmentStatus;
  priceCents: number;
  rescheduleCount: number;
  notes: string | null;
  cancellationReason: string | null;
  cancelledAt: string | null;
  service: { id: string; name: string; durationMin: number };
  professional: { id: string; name: string };
  client?: { id: string; name: string; email: string; phone: string | null };
}

export interface Client {
  id: string;
  email: string;
  fullName: string;
  phone: string | null;
  blockedUntil: string | null;
  noShowCount: number;
  upcomingCount: number;
  createdAt: string;
}

export interface TimeOff {
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

export interface AuthResult {
  token: string;
  user: User;
}
