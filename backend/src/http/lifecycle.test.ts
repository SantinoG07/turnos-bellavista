import request from 'supertest';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { SEED_IDS } from '../db/seed.js';
import { signToken } from '../auth/jwt.js';
import { createTestContext, TEST_JWT_SECRET, type TestContext } from '../test/context.js';

describe('T07 · ciclo de vida del turno', () => {
  let ctx: TestContext;
  let clientToken: string;
  let otherToken: string;
  let adminToken: string;

  beforeAll(async () => {
    ctx = await createTestContext();
    clientToken = signToken({ id: SEED_IDS.users.cliente, role: 'client' }, TEST_JWT_SECRET);
    adminToken = signToken({ id: SEED_IDS.users.admin, role: 'admin' }, TEST_JWT_SECRET);
    const other = await request(ctx.app).post('/api/auth/register').send({
      fullName: 'Otro Cliente',
      email: 'otro@test.com',
      password: 'Cliente1234',
    });
    otherToken = other.body.token;
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

  async function createAppointment(startsAt = '2026-11-24T13:00:00.000Z') {
    const response = await request(ctx.app)
      .post('/api/appointments')
      .set('Authorization', `Bearer ${clientToken}`)
      .send({
        serviceId: SEED_IDS.services.corte,
        professionalId: SEED_IDS.professionals.nico,
        startsAt,
      });
    expect(response.status).toBe(201);
    return response.body.appointment as { id: string; priceCents: number };
  }

  async function insertPastAppointment(startsAt: string, status = 'confirmed') {
    const start = new Date(startsAt);
    const result = await ctx.db.query<{ id: string }>(
      `INSERT INTO appointments
        (client_id, professional_id, service_id, starts_at, ends_at, status, price_cents)
       VALUES ($1, $2, $3, $4, $5, $6, 1200000) RETURNING id`,
      [
        SEED_IDS.users.cliente,
        SEED_IDS.professionals.nico,
        SEED_IDS.services.corte,
        start,
        new Date(start.getTime() + 30 * 60_000),
        status,
      ],
    );
    return result.rows[0]!.id;
  }

  it('RN-23: el cliente cancela hasta 2 horas antes', async () => {
    const appointment = await createAppointment();
    const response = await request(ctx.app)
      .patch(`/api/appointments/${appointment.id}/cancel`)
      .set('Authorization', `Bearer ${clientToken}`)
      .send({ reason: 'Me surgió un viaje' });
    expect(response.status).toBe(200);
    expect(response.body.appointment.status).toBe('cancelled');
    expect(response.body.appointment.cancellationReason).toBe('Me surgió un viaje');
    expect(response.body.appointment.cancelledAt).toBeTruthy();

    const event = await ctx.db.query<{ type: string }>(
      `SELECT type FROM appointment_events WHERE appointment_id = $1 ORDER BY created_at`,
      [appointment.id],
    );
    expect(event.rows.map((row) => row.type)).toEqual(['created', 'cancelled']);
  });

  it('RN-24: no permite cancelar con menos de 2 horas', async () => {
    const appointment = await createAppointment('2026-11-24T17:30:00.000Z'); // 14:30 local
    ctx.setNow(new Date('2026-11-24T16:00:00.000Z')); // 13:00 local, 1.5 h antes
    const response = await request(ctx.app)
      .patch(`/api/appointments/${appointment.id}/cancel`)
      .set('Authorization', `Bearer ${clientToken}`)
      .send({});
    expect(response.status).toBe(422);
    expect(response.body.error.message).toMatch(/menos de 2 horas/);

    const stored = await ctx.db.query<{ status: string }>(
      'SELECT status FROM appointments WHERE id = $1',
      [appointment.id],
    );
    expect(stored.rows[0]!.status).toBe('confirmed');
  });

  it('RN-25: el admin cancela en cualquier momento y exige motivo', async () => {
    const appointment = await createAppointment();
    ctx.setNow(new Date('2026-11-24T14:00:00.000Z')); // después del inicio

    const noReason = await request(ctx.app)
      .patch(`/api/admin/appointments/${appointment.id}/cancel`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ reason: 'x' });
    expect(noReason.status).toBe(400);

    const response = await request(ctx.app)
      .patch(`/api/admin/appointments/${appointment.id}/cancel`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ reason: 'El barbero se enfermó' });
    expect(response.status).toBe(200);
    expect(response.body.appointment.status).toBe('cancelled');
    expect(response.body.appointment.cancellationReason).toBe('El barbero se enfermó');
  });

  it('RN-26: cancelar libera el horario en la disponibilidad', async () => {
    const appointment = await createAppointment();
    const before = await request(ctx.app).get(
      `/api/availability?professionalId=${SEED_IDS.professionals.nico}&serviceId=${SEED_IDS.services.corte}&date=2026-11-24`,
    );
    expect(before.body.slots.map((slot: { label: string }) => slot.label)).not.toContain('10:00');

    await request(ctx.app)
      .patch(`/api/appointments/${appointment.id}/cancel`)
      .set('Authorization', `Bearer ${clientToken}`)
      .send({});
    const after = await request(ctx.app).get(
      `/api/availability?professionalId=${SEED_IDS.professionals.nico}&serviceId=${SEED_IDS.services.corte}&date=2026-11-24`,
    );
    expect(after.body.slots.map((slot: { label: string }) => slot.label)).toContain('10:00');
  });

  it('RN-27: reprograma, conserva precio y revalida disponibilidad', async () => {
    const appointment = await createAppointment();
    const response = await request(ctx.app)
      .patch(`/api/appointments/${appointment.id}/reschedule`)
      .set('Authorization', `Bearer ${clientToken}`)
      .send({ startsAt: '2026-11-24T14:00:00.000Z' }); // 11:00 local
    expect(response.status).toBe(200);
    expect(response.body.appointment.id).toBe(appointment.id);
    expect(response.body.appointment.startsAt).toBe('2026-11-24T14:00:00.000Z');
    expect(response.body.appointment.endsAt).toBe('2026-11-24T14:30:00.000Z');
    expect(response.body.appointment.priceCents).toBe(appointment.priceCents);
    expect(response.body.appointment.rescheduleCount).toBe(1);

    const event = await ctx.db.query<{ type: string }>(
      `SELECT type FROM appointment_events WHERE appointment_id = $1 ORDER BY created_at`,
      [appointment.id],
    );
    expect(event.rows.map((row) => row.type)).toEqual(['created', 'rescheduled']);
  });

  it('RN-27: no reprograma a un horario ocupado o fuera de agenda', async () => {
    const first = await createAppointment();
    await createAppointment('2026-11-24T14:00:00.000Z');
    const overlap = await request(ctx.app)
      .patch(`/api/appointments/${first.id}/reschedule`)
      .set('Authorization', `Bearer ${clientToken}`)
      .send({ startsAt: '2026-11-24T14:00:00.000Z' });
    expect(overlap.status).toBe(422);

    const outside = await request(ctx.app)
      .patch(`/api/appointments/${first.id}/reschedule`)
      .set('Authorization', `Bearer ${clientToken}`)
      .send({ startsAt: '2026-11-24T16:30:00.000Z' });
    expect(outside.status).toBe(422);
  });

  it('RN-28: permite máximo 2 reprogramaciones', async () => {
    const appointment = await createAppointment();
    for (const startsAt of ['2026-11-24T14:00:00.000Z', '2026-11-24T15:00:00.000Z']) {
      const response = await request(ctx.app)
        .patch(`/api/appointments/${appointment.id}/reschedule`)
        .set('Authorization', `Bearer ${clientToken}`)
        .send({ startsAt });
      expect(response.status).toBe(200);
    }
    const third = await request(ctx.app)
      .patch(`/api/appointments/${appointment.id}/reschedule`)
      .set('Authorization', `Bearer ${clientToken}`)
      .send({ startsAt: '2026-11-24T15:30:00.000Z' });
    expect(third.status).toBe(422);
    expect(third.body.error.message).toMatch(/2 veces/);
  });

  it('RN-28: no reprograma con menos de 2 horas', async () => {
    const appointment = await createAppointment('2026-11-24T17:30:00.000Z');
    ctx.setNow(new Date('2026-11-24T16:00:00.000Z'));
    const response = await request(ctx.app)
      .patch(`/api/appointments/${appointment.id}/reschedule`)
      .set('Authorization', `Bearer ${clientToken}`)
      .send({ startsAt: '2026-11-24T18:00:00.000Z' });
    expect(response.status).toBe(422);
    expect(response.body.error.message).toMatch(/2 horas/);
  });

  it('RN-29: solo admin puede marcar atendido y solo después del inicio', async () => {
    const appointment = await createAppointment();
    const clientAttempt = await request(ctx.app)
      .patch(`/api/admin/appointments/${appointment.id}/complete`)
      .set('Authorization', `Bearer ${clientToken}`);
    expect(clientAttempt.status).toBe(403);

    const early = await request(ctx.app)
      .patch(`/api/admin/appointments/${appointment.id}/complete`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(early.status).toBe(422);

    ctx.setNow(new Date('2026-11-24T13:05:00.000Z'));
    const response = await request(ctx.app)
      .patch(`/api/admin/appointments/${appointment.id}/complete`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(response.status).toBe(200);
    expect(response.body.appointment.status).toBe('completed');
  });

  it('RN-30: la ausencia se marca recién 15 minutos después del inicio', async () => {
    const appointment = await createAppointment();
    ctx.setNow(new Date('2026-11-24T13:10:00.000Z'));
    const early = await request(ctx.app)
      .patch(`/api/admin/appointments/${appointment.id}/no-show`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(early.status).toBe(422);

    ctx.setNow(new Date('2026-11-24T13:16:00.000Z'));
    const response = await request(ctx.app)
      .patch(`/api/admin/appointments/${appointment.id}/no-show`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(response.status).toBe(200);
    expect(response.body.appointment.status).toBe('no_show');
  });

  it('RN-32: los estados terminales no se pueden modificar', async () => {
    const appointment = await createAppointment();
    await request(ctx.app)
      .patch(`/api/appointments/${appointment.id}/cancel`)
      .set('Authorization', `Bearer ${clientToken}`)
      .send({});

    ctx.setNow(new Date('2026-11-24T14:00:00.000Z'));
    const complete = await request(ctx.app)
      .patch(`/api/admin/appointments/${appointment.id}/complete`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(complete.status).toBe(409);

    const noShow = await request(ctx.app)
      .patch(`/api/admin/appointments/${appointment.id}/no-show`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(noShow.status).toBe(409);

    const reschedule = await request(ctx.app)
      .patch(`/api/appointments/${appointment.id}/reschedule`)
      .set('Authorization', `Bearer ${clientToken}`)
      .send({ startsAt: '2026-11-24T14:30:00.000Z' });
    expect(reschedule.status).toBe(409);

    const again = await request(ctx.app)
      .patch(`/api/appointments/${appointment.id}/cancel`)
      .set('Authorization', `Bearer ${clientToken}`)
      .send({});
    expect(again.status).toBe(409);
  });

  it('RN-31: tres ausencias en 180 días bloquean 30 días', async () => {
    await insertPastAppointment('2025-01-01T13:00:00.000Z', 'no_show'); // fuera de ventana
    const first = await insertPastAppointment('2026-11-03T13:00:00.000Z');
    const second = await insertPastAppointment('2026-11-10T13:00:00.000Z');
    const third = await insertPastAppointment('2026-11-17T13:00:00.000Z');
    ctx.setNow(new Date('2026-11-20T15:00:00.000Z'));

    for (const id of [first, second]) {
      const response = await request(ctx.app)
        .patch(`/api/admin/appointments/${id}/no-show`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(response.status).toBe(200);
    }
    const before = await ctx.db.query<{ blocked_until: Date | null }>(
      'SELECT blocked_until FROM users WHERE id = $1',
      [SEED_IDS.users.cliente],
    );
    expect(before.rows[0]!.blocked_until).toBeNull();

    const response = await request(ctx.app)
      .patch(`/api/admin/appointments/${third}/no-show`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(response.status).toBe(200);

    const after = await ctx.db.query<{ blocked_until: Date }>(
      'SELECT blocked_until FROM users WHERE id = $1',
      [SEED_IDS.users.cliente],
    );
    expect(new Date(after.rows[0]!.blocked_until).toISOString()).toBe(
      '2026-12-20T15:00:00.000Z',
    );
    const booking = await request(ctx.app)
      .post('/api/appointments')
      .set('Authorization', `Bearer ${clientToken}`)
      .send({
        serviceId: SEED_IDS.services.corte,
        professionalId: SEED_IDS.professionals.carla,
        startsAt: '2026-11-24T13:00:00.000Z',
      });
    expect(booking.status).toBe(403);
  });

  it('RN-08: un cliente no puede ver ni operar turnos ajenos', async () => {
    const appointment = await createAppointment();
    const get = await request(ctx.app)
      .get(`/api/appointments/${appointment.id}`)
      .set('Authorization', `Bearer ${otherToken}`);
    expect(get.status).toBe(404);

    const cancel = await request(ctx.app)
      .patch(`/api/appointments/${appointment.id}/cancel`)
      .set('Authorization', `Bearer ${otherToken}`)
      .send({});
    expect(cancel.status).toBe(404);
  });

  it('lista mis turnos por scope', async () => {
    const future = await createAppointment();
    const past = await insertPastAppointment('2026-11-10T13:00:00.000Z');

    const upcoming = await request(ctx.app)
      .get('/api/appointments/mine?scope=upcoming')
      .set('Authorization', `Bearer ${clientToken}`);
    expect(upcoming.body.appointments.map((a: { id: string }) => a.id)).toEqual([future.id]);

    const pastResponse = await request(ctx.app)
      .get('/api/appointments/mine?scope=past')
      .set('Authorization', `Bearer ${clientToken}`);
    expect(pastResponse.body.appointments.map((a: { id: string }) => a.id)).toContain(past);

    const all = await request(ctx.app)
      .get('/api/appointments/mine?scope=all')
      .set('Authorization', `Bearer ${clientToken}`);
    expect(all.body.appointments).toHaveLength(2);
  });
});
