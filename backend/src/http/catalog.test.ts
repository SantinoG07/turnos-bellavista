import request from 'supertest';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { SEED_IDS } from '../db/seed.js';
import { createTestContext, type TestContext } from '../test/context.js';

const TUESDAY = '2026-11-24';

describe('T05 · catálogo y disponibilidad', () => {
  let ctx: TestContext;

  beforeAll(async () => {
    ctx = await createTestContext();
  });

  afterEach(async () => {
    await ctx.db.query('DELETE FROM appointments');
    await ctx.db.query('DELETE FROM time_off');
    await ctx.db.query('UPDATE services SET active = true');
    await ctx.db.query('UPDATE professionals SET active = true');
    ctx.setNow(new Date('2026-11-20T12:00:00.000Z'));
  });

  afterAll(async () => {
    await ctx.close();
  });

  async function insertAppointment(input: {
    professionalId?: string;
    serviceId?: string;
    startsAt: string;
    durationMin: number;
    status?: string;
  }) {
    const starts = new Date(input.startsAt);
    const ends = new Date(starts.getTime() + input.durationMin * 60_000);
    await ctx.db.query(
      `INSERT INTO appointments
        (client_id, professional_id, service_id, starts_at, ends_at, status, price_cents)
       VALUES ($1, $2, $3, $4, $5, $6, 100)`,
      [
        SEED_IDS.users.cliente,
        input.professionalId ?? SEED_IDS.professionals.nico,
        input.serviceId ?? SEED_IDS.services.corte,
        starts,
        ends,
        input.status ?? 'confirmed',
      ],
    );
  }

  it('lista solo servicios activos', async () => {
    const response = await request(ctx.app).get('/api/services');
    expect(response.status).toBe(200);
    expect(response.body.services).toHaveLength(4);
    expect(response.body.services[0]).toHaveProperty('priceCents');
    expect(response.body.services[0]).not.toHaveProperty('price_cents');

    await ctx.db.query('UPDATE services SET active = false WHERE id = $1', [
      SEED_IDS.services.color,
    ]);
    const after = await request(ctx.app).get('/api/services');
    expect(after.body.services).toHaveLength(3);
    expect(after.body.services.map((s: { name: string }) => s.name)).not.toContain('Coloración');
  });

  it('RN-11: filtra profesionales por servicio ofrecido', async () => {
    const color = await request(ctx.app).get(
      `/api/professionals?serviceId=${SEED_IDS.services.color}`,
    );
    expect(color.status).toBe(200);
    expect(color.body.professionals).toHaveLength(1);
    expect(color.body.professionals[0].name).toBe('Carla');
    expect(color.body.professionals[0].serviceIds).toContain(SEED_IDS.services.color);

    const corte = await request(ctx.app).get(
      `/api/professionals?serviceId=${SEED_IDS.services.corte}`,
    );
    expect(corte.body.professionals).toHaveLength(3);
  });

  it('RN-10: solo profesionales activos', async () => {
    await ctx.db.query('UPDATE professionals SET active = false WHERE id = $1', [
      SEED_IDS.professionals.martin,
    ]);
    const response = await request(ctx.app).get('/api/professionals');
    expect(response.body.professionals.map((p: { name: string }) => p.name)).not.toContain(
      'Martín',
    );
  });

  it('RN-13: genera las franjas semanales del martes', async () => {
    const response = await request(ctx.app).get(
      `/api/availability?professionalId=${SEED_IDS.professionals.nico}&serviceId=${SEED_IDS.services.corte}&date=${TUESDAY}`,
    );
    expect(response.status).toBe(200);
    expect(response.body.date).toBe(TUESDAY);
    expect(response.body.timezone).toBe('America/Argentina/Buenos_Aires');
    expect(response.body.slots).toHaveLength(34);
    expect(response.body.slots[0]).toEqual({
      startsAt: '2026-11-24T12:00:00.000Z',
      label: '09:00',
    });
    expect(response.body.slots.at(-1)).toEqual({
      startsAt: '2026-11-24T21:30:00.000Z',
      label: '18:30',
    });
  });

  it('RN-15: no ofrece horarios que cruzan la pausa del mediodía', async () => {
    const response = await request(ctx.app).get(
      `/api/availability?professionalId=${SEED_IDS.professionals.nico}&serviceId=${SEED_IDS.services.corte}&date=${TUESDAY}`,
    );
    const labels = response.body.slots.map((s: { label: string }) => s.label);
    expect(labels).toContain('12:30');
    expect(labels).not.toContain('13:00');
    expect(labels).toContain('14:00');
    expect(labels).toContain('18:30');
  });

  it('RN-15: el último turno termina justo al cerrar la franja', async () => {
    const response = await request(ctx.app).get(
      `/api/availability?professionalId=${SEED_IDS.professionals.carla}&serviceId=${SEED_IDS.services.color}&date=2026-11-28`,
    );
    expect(response.status).toBe(200);
    const labels = response.body.slots.map((s: { label: string }) => s.label);
    expect(labels[0]).toBe('10:00');
    expect(labels.at(-1)).toBe('12:30');
  });

  it('RN-16: oculta horarios ocupados por otro turno', async () => {
    await insertAppointment({
      startsAt: '2026-11-24T13:00:00.000Z', // 10:00 local
      durationMin: 30,
    });
    const response = await request(ctx.app).get(
      `/api/availability?professionalId=${SEED_IDS.professionals.nico}&serviceId=${SEED_IDS.services.corte}&date=${TUESDAY}`,
    );
    const labels = response.body.slots.map((s: { label: string }) => s.label);
    expect(labels).not.toContain('10:00');
    expect(labels).not.toContain('09:45');
    expect(labels).toContain('09:30');
    expect(labels).toContain('10:30');
  });

  it('RN-16: un turno cancelado no bloquea el horario', async () => {
    await insertAppointment({
      startsAt: '2026-11-24T13:00:00.000Z',
      durationMin: 30,
      status: 'cancelled',
    });
    const response = await request(ctx.app).get(
      `/api/availability?professionalId=${SEED_IDS.professionals.nico}&serviceId=${SEED_IDS.services.corte}&date=${TUESDAY}`,
    );
    const labels = response.body.slots.map((s: { label: string }) => s.label);
    expect(labels).toContain('10:00');
  });

  it('RN-20: un bloqueo de agenda quita los horarios superpuestos', async () => {
    await ctx.db.query(
      `INSERT INTO time_off (professional_id, starts_at, ends_at, reason)
       VALUES ($1, $2, $3, 'Trámite')`,
      [
        SEED_IDS.professionals.nico,
        new Date('2026-11-24T18:00:00.000Z'), // 15:00 local
        new Date('2026-11-24T19:00:00.000Z'), // 16:00 local
      ],
    );
    const response = await request(ctx.app).get(
      `/api/availability?professionalId=${SEED_IDS.professionals.nico}&serviceId=${SEED_IDS.services.corte}&date=${TUESDAY}`,
    );
    const labels = response.body.slots.map((s: { label: string }) => s.label);
    expect(labels).not.toContain('14:45');
    expect(labels).not.toContain('15:00');
    expect(labels).not.toContain('15:15');
    expect(labels).not.toContain('15:30');
    expect(labels).toContain('14:30');
    expect(labels).toContain('16:00');
  });

  it('RN-18: respeta las 2 horas de anticipación mínima', async () => {
    ctx.setNow(new Date('2026-11-24T15:30:00.000Z')); // 12:30 local
    const response = await request(ctx.app).get(
      `/api/availability?professionalId=${SEED_IDS.professionals.nico}&serviceId=${SEED_IDS.services.corte}&date=${TUESDAY}`,
    );
    expect(response.status).toBe(200);
    expect(response.body.slots[0].label).toBe('14:30');
    expect(response.body.slots.map((s: { label: string }) => s.label)).not.toContain('12:30');
  });

  it('RN-21: un día sin franjas devuelve una lista vacía', async () => {
    const response = await request(ctx.app).get(
      `/api/availability?professionalId=${SEED_IDS.professionals.nico}&serviceId=${SEED_IDS.services.corte}&date=2026-11-22`,
    );
    expect(response.status).toBe(200);
    expect(response.body.slots).toEqual([]);
  });

  it('RN-18/RN-19: rechaza fechas pasadas o con más de 60 días', async () => {
    const past = await request(ctx.app).get(
      `/api/availability?professionalId=${SEED_IDS.professionals.nico}&serviceId=${SEED_IDS.services.corte}&date=2026-11-19`,
    );
    expect(past.status).toBe(422);
    expect(past.body.error.code).toBe('RULE_VIOLATION');

    const far = await request(ctx.app).get(
      `/api/availability?professionalId=${SEED_IDS.professionals.nico}&serviceId=${SEED_IDS.services.corte}&date=2027-01-20`,
    );
    expect(far.status).toBe(422);
  });

  it('RN-10/RN-11: rechaza servicio inactivo, profesional inactivo o no habilitado', async () => {
    await ctx.db.query('UPDATE services SET active = false WHERE id = $1', [
      SEED_IDS.services.corte,
    ]);
    const inactiveService = await request(ctx.app).get(
      `/api/availability?professionalId=${SEED_IDS.professionals.nico}&serviceId=${SEED_IDS.services.corte}&date=${TUESDAY}`,
    );
    expect(inactiveService.status).toBe(422);

    await ctx.db.query('UPDATE services SET active = true WHERE id = $1', [
      SEED_IDS.services.corte,
    ]);
    await ctx.db.query('UPDATE professionals SET active = false WHERE id = $1', [
      SEED_IDS.professionals.nico,
    ]);
    const inactiveProfessional = await request(ctx.app).get(
      `/api/availability?professionalId=${SEED_IDS.professionals.nico}&serviceId=${SEED_IDS.services.corte}&date=${TUESDAY}`,
    );
    expect(inactiveProfessional.status).toBe(422);

    const notOffered = await request(ctx.app).get(
      `/api/availability?professionalId=${SEED_IDS.professionals.martin}&serviceId=${SEED_IDS.services.color}&date=${TUESDAY}`,
    );
    expect(notOffered.status).toBe(422);
    expect(notOffered.body.error.message).toMatch(/no realiza ese servicio/);
  });

  it('valida el formato de los parámetros', async () => {
    const badDate = await request(ctx.app).get(
      `/api/availability?professionalId=${SEED_IDS.professionals.nico}&serviceId=${SEED_IDS.services.corte}&date=24-11-2026`,
    );
    expect(badDate.status).toBe(400);
    expect(badDate.body.error.details).toHaveProperty('date');

    const badId = await request(ctx.app).get(
      `/api/availability?professionalId=no-es-uuid&serviceId=${SEED_IDS.services.corte}&date=${TUESDAY}`,
    );
    expect(badId.status).toBe(400);
  });
});
