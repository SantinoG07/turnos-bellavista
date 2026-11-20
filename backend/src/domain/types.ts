import type { AppointmentStatus, UserRole } from './constants.js';

export interface PublicUser {
  id: string;
  email: string;
  fullName: string;
  phone: string | null;
  role: UserRole;
  blockedUntil: string | null;
}

export interface UserRow {
  id: string;
  email: string;
  password_hash: string;
  full_name: string;
  phone: string | null;
  role: UserRole;
  blocked_until: string | Date | null;
  created_at: string | Date;
}

export interface ServiceRow {
  id: string;
  name: string;
  description: string;
  duration_min: number;
  price_cents: number;
  active: boolean;
  created_at: string | Date;
}

export interface ProfessionalRow {
  id: string;
  name: string;
  bio: string;
  active: boolean;
  created_at: string | Date;
}

export interface AvailabilityRuleRow {
  id: string;
  professional_id: string;
  weekday: number;
  start_minute: number;
  end_minute: number;
}

export interface AppointmentRow {
  id: string;
  client_id: string;
  professional_id: string;
  service_id: string;
  starts_at: string | Date;
  ends_at: string | Date;
  status: AppointmentStatus;
  price_cents: number;
  reschedule_count: number;
  notes: string | null;
  cancelled_at: string | Date | null;
  cancelled_by: string | null;
  cancellation_reason: string | null;
  created_at: string | Date;
  updated_at: string | Date;
  service_name?: string;
  service_duration_min?: number;
  professional_name?: string;
  client_name?: string;
  client_email?: string;
  client_phone?: string | null;
}

export interface TimeOffRow {
  id: string;
  professional_id: string;
  starts_at: string | Date;
  ends_at: string | Date;
  reason: string;
  created_by: string | null;
  created_at: string | Date;
}
