import type { Queryable } from '../db/types.js';
import type {
  AvailabilityRuleRow,
  ProfessionalRow,
  ServiceRow,
  TimeOffRow,
} from '../domain/types.js';

export interface PublicService {
  id: string;
  name: string;
  description: string;
  durationMin: number;
  priceCents: number;
}

export interface PublicProfessional {
  id: string;
  name: string;
  bio: string;
  serviceIds: string[];
}

export function toPublicService(row: ServiceRow): PublicService {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    durationMin: row.duration_min,
    priceCents: row.price_cents,
  };
}

export class CatalogRepository {
  constructor(private readonly db: Queryable) {}

  async listActiveServices(): Promise<ServiceRow[]> {
    const result = await this.db.query<ServiceRow>(
      `SELECT id, name, description, duration_min, price_cents, active, created_at
       FROM services WHERE active = true ORDER BY name`,
    );
    return result.rows;
  }

  async findService(id: string): Promise<ServiceRow | null> {
    const result = await this.db.query<ServiceRow>(
      `SELECT id, name, description, duration_min, price_cents, active, created_at
       FROM services WHERE id = $1`,
      [id],
    );
    return result.rows[0] ?? null;
  }

  async listActiveProfessionals(serviceId?: string): Promise<PublicProfessional[]> {
    const result = serviceId
      ? await this.db.query<ProfessionalRow & { service_id: string }>(
          `SELECT p.id, p.name, p.bio, p.active, p.created_at, ps.service_id
           FROM professionals p
           JOIN professional_services ps ON ps.professional_id = p.id
           WHERE p.active = true AND ps.service_id = $1
           ORDER BY p.name`,
          [serviceId],
        )
      : await this.db.query<ProfessionalRow & { service_id: string }>(
          `SELECT p.id, p.name, p.bio, p.active, p.created_at, ps.service_id
           FROM professionals p
           LEFT JOIN professional_services ps ON ps.professional_id = p.id
           WHERE p.active = true
           ORDER BY p.name`,
        );

    const map = new Map<string, PublicProfessional>();
    for (const row of result.rows) {
      const current = map.get(row.id) ?? {
        id: row.id,
        name: row.name,
        bio: row.bio,
        serviceIds: [],
      };
      if (row.service_id) current.serviceIds.push(row.service_id);
      map.set(row.id, current);
    }
    return [...map.values()];
  }

  async findProfessional(id: string): Promise<ProfessionalRow | null> {
    const result = await this.db.query<ProfessionalRow>(
      `SELECT id, name, bio, active, created_at FROM professionals WHERE id = $1`,
      [id],
    );
    return result.rows[0] ?? null;
  }

  async offersService(professionalId: string, serviceId: string): Promise<boolean> {
    const result = await this.db.query<{ exists: boolean }>(
      `SELECT EXISTS(
         SELECT 1 FROM professional_services
         WHERE professional_id = $1 AND service_id = $2
       ) AS exists`,
      [professionalId, serviceId],
    );
    return result.rows[0]?.exists === true;
  }

  async listAvailabilityRules(professionalId: string): Promise<AvailabilityRuleRow[]> {
    const result = await this.db.query<AvailabilityRuleRow>(
      `SELECT id, professional_id, weekday, start_minute, end_minute
       FROM availability_rules WHERE professional_id = $1
       ORDER BY weekday, start_minute`,
      [professionalId],
    );
    return result.rows;
  }

  async listTimeOffOverlapping(
    professionalId: string,
    from: Date,
    to: Date,
  ): Promise<TimeOffRow[]> {
    const result = await this.db.query<TimeOffRow>(
      `SELECT id, professional_id, starts_at, ends_at, reason, created_by, created_at
       FROM time_off
       WHERE professional_id = $1 AND starts_at < $3 AND ends_at > $2
       ORDER BY starts_at`,
      [professionalId, from, to],
    );
    return result.rows;
  }

  async listBusyAppointments(
    professionalId: string,
    from: Date,
    to: Date,
  ): Promise<{ starts_at: string | Date; ends_at: string | Date }[]> {
    const result = await this.db.query<{ starts_at: string | Date; ends_at: string | Date }>(
      `SELECT starts_at, ends_at FROM appointments
       WHERE professional_id = $1 AND status = 'confirmed'
         AND starts_at < $3 AND ends_at > $2
       ORDER BY starts_at`,
      [professionalId, from, to],
    );
    return result.rows;
  }
}
