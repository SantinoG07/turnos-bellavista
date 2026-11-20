import request from 'supertest';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { SEED_IDS } from '../db/seed.js';
import { signToken } from '../auth/jwt.js';
import { createTestContext, TEST_JWT_SECRET, type TestContext } from '../test/context.js';

const TUESDAY = '2026-11-24';

describe('T08 · API de administración', () => {
  let ctx: TestContext;
  let adminToken: string;
  let clientToken: string;

  beforeAll(async () => {
    ctx = await createTestContext();
    adminToken = signToken({ id: SEED_IDS.users.admin, role: 'admin' }, TEST_JWT_SECRET);
    clientToken = signToken({ id: SEED_IDS.users.cliente, role: 'client' }, TEST_JWT_SECRET);
  });

  afterEach(async () => {
    await ctx.db.query('DELETE FROM appointment_events');
    await ctx.db.query('DELETE FROM appointments');
    await ctx.db.query('DELETE FROM time_off');
    await ctx.db.query('UPDATE users SET blocked_until = NULL');
    ctx.setNow(new Date('2026-11-20T12:00:00.000Z'));
  });

  afterAll(async () => {
    await ctx.close();
  });

  async function insertAppointment(input: {
    startsAt: string;
    status: string;
    professionalId?: string;
    clientId?: string;
  }) {
    const start = new Date(input.startsAt);
    const result = await ctx.db.query<{ id: string }>(
      `INSERT INTO appointments
        (client_id, professional_id, service_id, starts_at, ends_at, status, price_cents)
       VALUES ($1, $2, $3, $4, $5, $6, 1200000) RETURNING id`,
      [
        input.clientId ?? SEED_IDS.users.cliente,
        input.professionalId ?? SEED_IDS.professionals.nico,
        SEED_IDS.services.corte,
        start,
        new Date(start.getTime() + 30 * 60_000),
        input.status,
      ],
    );
    return result.rows[0]!.id;
  }

  it('RN-05: exige sesión y rol admin en toda la sección', async () => {
    const anonymous = await request(ctx.app).get('/api/admin/metrics');
    expect(anonymous.status).toBe(401);

    const asClient = await request(ctx.app)
      .get('/api/admin/metrics')
      .set('Authorization', `Bearer ${clientToken}`);
    expect(asClient.status).toBe(403);

    const writeAsClient = await request(ctx.app)
      .post('/api/admin/time-off')
      .set('Authorization', `Bearer ${clientToken}`)
      .send({});
    expect(writeAsClient.status).toBe(403);
  });

  it('devuelve la agenda del día con datos del cliente', async () => {
    await insertAppointment({ startsAt: '2026-11-24T13:00:00.000Z', status: 'confirmed' });
    await insertAppointment({ startsAt: '2026-11-24T14:00:00.000Z', status: 'cancelled' });
    await insertAppointment({ startsAt: '2026-11-25T13:00:00.000Z', status: 'confirmed' });

    const response = await request(ctx.app)
      .get(`/api/admin/appointments?date=${TUESDAY}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(response.status).toBe(200);
    expect(response.body.appointments).toHaveLength(2);
    expect(response.body.appointments[0].client).toMatchObject({
      id: SEED_IDS.users.cliente,
      name: 'Cliente Demo',
      email: 'cliente@bellavista.test',
    });
  });

  it('filtra la agenda por estado', async () => {
    await insertAppointment({ startsAt: '2026-11-24T13:00:00.000Z', status: 'confirmed' });
    await insertAppointment({ startsAt: '2026-11-24T14:00:00.000Z', status: 'cancelled' });
    const response = await request(ctx.app)
      .get(`/api/admin/appointments?date=${TUESDAY}&status=cancelled`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(response.body.appointments).toHaveLength(1);
    expect(response.body.appointments[0].status).toBe('cancelled');
  });

  it('calcula las métricas del día y los próximos 7 días', async () => {
    await insertAppointment({ startsAt: '2026-11-24T13:00:00.000Z', status: 'confirmed' });
    await insertAppointment({ startsAt: '2026-11-24T14:00:00.000Z', status: 'confirmed' });
    await insertAppointment({ startsAt: '2026-11-24T15:00:00.000Z', status: 'cancelled' });
    await insertAppointment({ startsAt: '2026-11-24T16:00:00.000Z', status: 'completed' });
    await insertAppointment({ startsAt: '2026-11-24T17:00:00.000Z', status: 'no_show' });

    const response = await request(ctx.app)
      .get(`/api/admin/metrics?date=${TUESDAY}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(response.status).toBe(200);
    expect(response.body.metrics).toEqual({
      date: TUESDAY,
      total: 5,
      confirmed: 2,
      cancelled: 1,
      completed: 1,
      noShow: 1,
      upcoming7Days: 2,
    });
  });

  it('valida el formato de fecha en agenda y métricas', async () => {
    const agenda = await request(ctx.app)
      .get('/api/admin/appointments?date=24-11-2026')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(agenda.status).toBe(400);

    const metrics = await request(ctx.app)
      .get('/api/admin/metrics?date=2026-13-99')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(metrics.status).toBe(400);
  });

  it('busca clientes y muestra ausencias y turnos futuros', async () => {
    await request(ctx.app).post('/api/auth/register').send({
      fullName: 'Cliente Buscado',
      email: 'buscado@test.com',
      password: 'Cliente1234',
    });
    await insertAppointment({ startsAt: '2026-11-24T13:00:00.000Z', status: 'no_show' });
    await insertAppointment({ startsAt: '2026-11-24T14:00:00.000Z', status: 'confirmed' });

    const response = await request(ctx.app)
      .get('/api/admin/clients?query=buscado')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(response.status).toBe(200);
    expect(response.body.clients).toHaveLength(1);
    expect(response.body.clients[0]).toMatchObject({
      fullName: 'Cliente Buscado',
      email: 'buscado@test.com',
      noShowCount: 0,
      upcomingCount: 0,
    });

    const all = await request(ctx.app)
      .get('/api/admin/clients')
      .set('Authorization', `Bearer ${adminToken}`);
    const demo = all.body.clients.find(
      (client: { id: string }) => client.id === SEED_IDS.users.cliente,
    );
    expect(demo.noShowCount).toBe(1);
    expect(demo.upcomingCount).toBe(1);
  });

  it('desbloquea un cliente', async () => {
    await ctx.db.query('UPDATE users SET blocked_until = $2 WHERE id = $1', [
      SEED_IDS.users.cliente,
      new Date('2026-12-20T00:00:00.000Z'),
    ]);
    const before = await request(ctx.app)
      .get('/api/admin/clients')
      .set('Authorization', `Bearer ${adminToken}`);
    const blocked = before.body.clients.find(
      (client: { id: string }) => client.id === SEED_IDS.users.cliente,
    );
    expect(blocked.blockedUntil).toBe('2026-12-20T00:00:00.000Z');

    const response = await request(ctx.app)
      .patch(`/api/admin/clients/${SEED_IDS.users.cliente}/unblock`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(response.status).toBe(200);

    const after = await request(ctx.app)
      .get('/api/admin/clients')
      .set('Authorization', `Bearer ${adminToken}`);
    const unblocked = after.body.clients.find(
      (client: { id: string }) => client.id === SEED_IDS.users.cliente,
    );
    expect(unblocked.blockedUntil).toBeNull();
  });

  it('crea un bloqueo de agenda y lo refleja en la disponibilidad', async () => {
    const response = await request(ctx.app)
      .post('/api/admin/time-off')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        professionalId: SEED_IDS.professionals.nico,
        startsAt: '2026-11-25T13:00:00.000Z', // 10:00 local
        endsAt: '2026-11-25T14:00:00.000Z',
        reason: 'Trámite personal',
      });
    expect(response.status).toBe(201);
    expect(response.body.timeOff).toMatchObject({
      professionalId: SEED_IDS.professionals.nico,
      professionalName: 'Nico',
      reason: 'Trámite personal',
    });

    const availability = await request(ctx.app).get(
      `/api/availability?professionalId=${SEED_IDS.professionals.nico}&serviceId=${SEED_IDS.services.corte}&date=2026-11-25`,
    );
    const labels = availability.body.slots.map((slot: { label: string }) => slot.label);
    expect(labels).not.toContain('10:00');
    expect(labels).not.toContain('10:30');
    expect(labels).toContain('11:00');
  });

  it('lista y elimina bloqueos de agenda', async () => {
    const created = await request(ctx.app)
      .post('/api/admin/time-off')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        professionalId: SEED_IDS.professionals.nico,
        startsAt: '2026-11-25T13:00:00.000Z',
        endsAt: '2026-11-25T14:00:00.000Z',
        reason: 'Congreso',
      });
    const list = await request(ctx.app)
      .get('/api/admin/time-off?from=2026-11-24&to=2026-11-29')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(list.body.timeOff).toHaveLength(1);
    expect(list.body.timeOff[0].reason).toBe('Congreso');

    const deleted = await request(ctx.app)
      .delete(`/api/admin/time-off/${created.body.timeOff.id}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(deleted.status).toBe(204);

    const availability = await request(ctx.app).get(
      `/api/availability?professionalId=${SEED_IDS.professionals.nico}&serviceId=${SEED_IDS.services.corte}&date=2026-11-25`,
    );
    expect(
      availability.body.slots.map((slot: { label: string }) => slot.label),
    ).toContain('10:00');
  });

  it('no permite bloquear un horario con turnos confirmados', async () => {
    await insertAppointment({ startsAt: '2026-11-25T15:00:00.000Z', status: 'confirmed' }); // 12:00 local
    const response = await request(ctx.app)
      .post('/api/admin/time-off')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        professionalId: SEED_IDS.professionals.nico,
        startsAt: '2026-11-25T15:00:00.000Z',
        endsAt: '2026-11-25T16:00:00.000Z',
        reason: 'Cierre',
      });
    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe('CONFLICT');
  });

  it('valida los datos del bloqueo', async () => {
    const case1 = await request(ctx.app)
      .post('/api/admin/time-off')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        professionalId: SEED_IDS.professionals.nico,
        startsAt: '2026-11-25T14:00:00.000Z',
        endsAt: '2026-11-25T13:00:00.000Z',
        reason: 'Mal',
      });
    expect(case1.status).toBe(400);

    const case2 = await request(ctx.app)
      .post('/api/admin/time-off')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        professionalId: SEED_IDS.professionals.nico,
        startsAt: '2026-11-25T13:00:00.000Z',
        endsAt: '2026-11-25T14:00:00.000Z',
        reason: 'x',
      });
    expect(case2.status).toBe(400);

    const case3 = await request(ctx.app)
      .post('/api/admin/time-off')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        professionalId: '00000000-0000-4000-8000-000000000000',
        startsAt: '2026-11-25T13:00:00.000Z',
        endsAt: '2026-11-25T14:00:00.000Z',
        reason: 'Inexistente',
      });
    expect(case3.status).toBe(400);
  });
});
