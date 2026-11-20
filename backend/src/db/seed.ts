import type { Database } from './types.js';
import { hashPassword } from '../auth/password.js';

export const SEED_IDS = {
  services: {
    corte: 'a0000000-0000-4000-8000-000000000001',
    corteBarba: 'a0000000-0000-4000-8000-000000000002',
    afeitado: 'a0000000-0000-4000-8000-000000000003',
    color: 'a0000000-0000-4000-8000-000000000004',
  },
  professionals: {
    nico: 'b0000000-0000-4000-8000-000000000011',
    carla: 'b0000000-0000-4000-8000-000000000012',
    martin: 'b0000000-0000-4000-8000-000000000013',
  },
  users: {
    admin: 'c0000000-0000-4000-8000-000000000021',
    cliente: 'c0000000-0000-4000-8000-000000000022',
  },
  clientPassword: 'Cliente1234',
} as const;

const services = [
  {
    id: SEED_IDS.services.corte,
    name: 'Corte clásico',
    description: 'Corte de cabello con lavado y peinado.',
    duration: 30,
    price: 1_200_000,
  },
  {
    id: SEED_IDS.services.corteBarba,
    name: 'Corte + barba',
    description: 'Corte de cabello y perfilado de barba.',
    duration: 45,
    price: 1_800_000,
  },
  {
    id: SEED_IDS.services.afeitado,
    name: 'Afeitado tradicional',
    description: 'Afeitado a navaja con toalla caliente.',
    duration: 30,
    price: 900_000,
  },
  {
    id: SEED_IDS.services.color,
    name: 'Coloración',
    description: 'Coloración completa con tratamiento.',
    duration: 90,
    price: 2_500_000,
  },
];

const professionals = [
  {
    id: SEED_IDS.professionals.nico,
    name: 'Nico',
    bio: 'Barbero con 10 años de experiencia. Especialista en clásicos.',
    services: [SEED_IDS.services.corte, SEED_IDS.services.corteBarba, SEED_IDS.services.afeitado],
  },
  {
    id: SEED_IDS.professionals.carla,
    name: 'Carla',
    bio: 'Especialista en color y cortes modernos.',
    services: [SEED_IDS.services.corte, SEED_IDS.services.corteBarba, SEED_IDS.services.color],
  },
  {
    id: SEED_IDS.professionals.martin,
    name: 'Martín',
    bio: 'Afeitados tradicionales y cuidado de barba.',
    services: [SEED_IDS.services.corte, SEED_IDS.services.afeitado],
  },
];

// weekday: 0 domingo … 6 sábado. Minutos desde las 00:00 locales.
const weekly = [
  { professional: SEED_IDS.professionals.nico, weekday: 2, start: 540, end: 780 },
  { professional: SEED_IDS.professionals.nico, weekday: 2, start: 840, end: 1140 },
  { professional: SEED_IDS.professionals.nico, weekday: 3, start: 540, end: 780 },
  { professional: SEED_IDS.professionals.nico, weekday: 3, start: 840, end: 1140 },
  { professional: SEED_IDS.professionals.nico, weekday: 4, start: 540, end: 780 },
  { professional: SEED_IDS.professionals.nico, weekday: 4, start: 840, end: 1140 },
  { professional: SEED_IDS.professionals.nico, weekday: 5, start: 540, end: 780 },
  { professional: SEED_IDS.professionals.nico, weekday: 5, start: 840, end: 1140 },
  { professional: SEED_IDS.professionals.nico, weekday: 6, start: 540, end: 780 },

  { professional: SEED_IDS.professionals.carla, weekday: 2, start: 600, end: 780 },
  { professional: SEED_IDS.professionals.carla, weekday: 2, start: 840, end: 1140 },
  { professional: SEED_IDS.professionals.carla, weekday: 3, start: 600, end: 780 },
  { professional: SEED_IDS.professionals.carla, weekday: 3, start: 840, end: 1140 },
  { professional: SEED_IDS.professionals.carla, weekday: 4, start: 600, end: 780 },
  { professional: SEED_IDS.professionals.carla, weekday: 4, start: 840, end: 1140 },
  { professional: SEED_IDS.professionals.carla, weekday: 5, start: 540, end: 780 },
  { professional: SEED_IDS.professionals.carla, weekday: 6, start: 600, end: 840 },

  { professional: SEED_IDS.professionals.martin, weekday: 2, start: 600, end: 780 },
  { professional: SEED_IDS.professionals.martin, weekday: 2, start: 900, end: 1140 },
  { professional: SEED_IDS.professionals.martin, weekday: 3, start: 600, end: 780 },
  { professional: SEED_IDS.professionals.martin, weekday: 3, start: 900, end: 1140 },
  { professional: SEED_IDS.professionals.martin, weekday: 4, start: 600, end: 780 },
  { professional: SEED_IDS.professionals.martin, weekday: 4, start: 900, end: 1140 },
  { professional: SEED_IDS.professionals.martin, weekday: 5, start: 600, end: 780 },
  { professional: SEED_IDS.professionals.martin, weekday: 5, start: 900, end: 1140 },
  { professional: SEED_IDS.professionals.martin, weekday: 6, start: 600, end: 780 },
];

export interface SeedOptions {
  adminEmail: string;
  adminPassword: string;
  adminName: string;
  withDemoClient?: boolean;
}

export async function seedDatabase(db: Database, options: SeedOptions): Promise<void> {
  const adminHash = await hashPassword(options.adminPassword);
  const clientHash = await hashPassword(SEED_IDS.clientPassword);

  await db.transaction(async (tx) => {
    for (const service of services) {
      await tx.query(
        `INSERT INTO services (id, name, description, duration_min, price_cents, active)
         VALUES ($1, $2, $3, $4, $5, true)
         ON CONFLICT (id) DO UPDATE SET
           description = EXCLUDED.description,
           duration_min = EXCLUDED.duration_min,
           price_cents = EXCLUDED.price_cents`,
        [service.id, service.name, service.description, service.duration, service.price],
      );
    }

    for (const professional of professionals) {
      await tx.query(
        `INSERT INTO professionals (id, name, bio, active)
         VALUES ($1, $2, $3, true)
         ON CONFLICT (id) DO UPDATE SET bio = EXCLUDED.bio`,
        [professional.id, professional.name, professional.bio],
      );
      for (const serviceId of professional.services) {
        await tx.query(
          `INSERT INTO professional_services (professional_id, service_id)
           VALUES ($1, $2) ON CONFLICT DO NOTHING`,
          [professional.id, serviceId],
        );
      }
    }

    for (const rule of weekly) {
      await tx.query(
        `INSERT INTO availability_rules (professional_id, weekday, start_minute, end_minute)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (professional_id, weekday, start_minute, end_minute) DO NOTHING`,
        [rule.professional, rule.weekday, rule.start, rule.end],
      );
    }

    await tx.query(
      `INSERT INTO users (id, email, password_hash, full_name, role)
       VALUES ($1, $2, $3, $4, 'admin')
       ON CONFLICT (email) DO NOTHING`,
      [SEED_IDS.users.admin, options.adminEmail.trim().toLowerCase(), adminHash, options.adminName],
    );

    if (options.withDemoClient !== false) {
      await tx.query(
        `INSERT INTO users (id, email, password_hash, full_name, role)
         VALUES ($1, $2, $3, $4, 'client')
         ON CONFLICT (email) DO NOTHING`,
        [SEED_IDS.users.cliente, 'cliente@bellavista.test', clientHash, 'Cliente Demo'],
      );
    }
  });
}
