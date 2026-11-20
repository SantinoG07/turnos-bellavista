import type { AppointmentRow } from '../domain/types.js';

export interface PublicAppointment {
  id: string;
  startsAt: string;
  endsAt: string;
  status: string;
  priceCents: number;
  rescheduleCount: number;
  notes: string | null;
  cancellationReason: string | null;
  cancelledAt: string | null;
  service: { id: string; name: string; durationMin: number };
  professional: { id: string; name: string };
  client?: { id: string; name: string; email: string; phone: string | null };
}

export function toPublicAppointment(
  row: AppointmentRow,
  options: { includeClient?: boolean } = {},
): PublicAppointment {
  return {
    id: row.id,
    startsAt: new Date(row.starts_at as string | Date).toISOString(),
    endsAt: new Date(row.ends_at as string | Date).toISOString(),
    status: row.status,
    priceCents: row.price_cents,
    rescheduleCount: row.reschedule_count,
    notes: row.notes,
    cancellationReason: row.cancellation_reason,
    cancelledAt: row.cancelled_at
      ? new Date(row.cancelled_at as string | Date).toISOString()
      : null,
    service: {
      id: row.service_id,
      name: row.service_name ?? '',
      durationMin: row.service_duration_min ?? 0,
    },
    professional: { id: row.professional_id, name: row.professional_name ?? '' },
    ...(options.includeClient
      ? {
          client: {
            id: row.client_id,
            name: row.client_name ?? '',
            email: row.client_email ?? '',
            phone: row.client_phone ?? null,
          },
        }
      : {}),
  };
}
