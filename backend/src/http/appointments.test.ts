import request from 'supertest';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { SEED_IDS } from '../db/seed.js';
import { signToken } from '../auth/jwt.js';
import { createTestContext, TEST_JWT_SECRET, type TestContext } from '../test/context.js';

const TUESDAY = '2026-11-24';

describe('T06 · reserva de turnos', () => {
  let ctx: TestContext;
  let clientToken: string;
  let secondToken: string;

  beforeAll(async () => {
    ctx = await createTestContext();
    clientToken = signToken({ id: SEED_IDS.users.cliente, role: 'client' }, TEST_JWT_SECRET);
    const second = await request(ctx.app).post('/api/auth/register').send({
      fullName: 'Segundo Cliente',
      email: 'segundo@test.com',
      password: 'Cliente1234',
    });
    secondToken = second.body.token;
  });

  afterEach(async () => {
    await ctx.db.query('DELETE FROM appointment_events');
    await ctx.db.query('DELETE FROM appointments');
    await ctx.db.query('DELETE FROM time_off');
    await ctx.db.query('UPDATE users SET blocked_until = NULL');
    await ctx.db.query('UPDATE services SET price_cents = 1200000 WHERE id = $1', [
      SEED_IDS.services.corte,
    ]);
    await ctx.db.query('UPDATE services SET active = true');
    await ctx.db.query('UPDATE professionals SET active = true');
    ctx.setNow(new Date('2026-11-20T12:00:00.000Z'));
  });

  afterAll(async () => {
    await ctx.close();
  });

  function book(
    token: string,
    input: {
      startsAt?: string;
      serviceId?: string;
      professionalId?: string;
      notes?: string;
      extra?: Record<string, unknown>;
    } = {},
  ) {
    return request(ctx.app)
      .post('/api/appointments')
      .set('Authorization', `Bearer ${token}`)
      .send({
        serviceId: input.serviceId ?? SEED_IDS.services.corte,
        professionalId: input.professionalId ?? SEED_IDS.professionals.nico,
        startsAt: input.startsAt ?? '2026-11-24T13:00:00.000Z',
        notes: input.notes,
        ...input.extra,
      });
  }

  it('crea un turno confirmado con fin y precio calculados por el servidor', async () => {
    const response = await book(clientToken, { notes: 'Corte prolijo' });
    expect(response.status).toBe(201);
    expect(response.body.appointment).toMatchObject({
      status: 'confirmed',
      priceCents: 1200000,
      rescheduleCount: 0,
      notes: 'Corte prolijo',
      startsAt: '2026-11-24T13:00:00.000Z',
      endsAt: '2026-11-24T13:30:00.000Z',
      service: { id: SEED_IDS.services.corte, name: 'Corte clásico', durationMin: 30 },
      professional: { id: SEED_IDS.professionals.nico, name: 'Nico' },
    });
    expect(response.body.appointment.id).toMatch(/^[0-9a-f-]{36}$/);

    const event = await ctx.db.query<{ type: string }>(
      `SELECT type FROM appointment_events WHERE appointment_id = $1`,
      [response.body.appointment.id],
    );
    expect(event.rows).toEqual([{ type: 'created' }]);
  });

  it('RN-33: ignora endsAt, status y priceCents enviados por el cliente', async () => {
    const response = await book(clientToken, {
      extra: {
        endsAt: '2026-11-25T00:00:00.000Z',
        status: 'completed',
        priceCents: 1,
      },
    });
    expect(response.status).toBe(201);
    expect(response.body.appointment.status).toBe('confirmed');
    expect(response.body.appointment.priceCents).toBe(1200000);
    expect(response.body.appointment.endsAt).toBe('2026-11-24T13:30:00.000Z');
  });

  it('RN-12: congela el precio al momento de reservar', async () => {
    const response = await book(clientToken);
    expect(response.status).toBe(201);
    await ctx.db.query('UPDATE services SET price_cents = 9999999 WHERE id = $1', [
      SEED_IDS.services.corte,
    ]);
    const stored = await ctx.db.query<{ price_cents: number }>(
      'SELECT price_cents FROM appointments WHERE id = $1',
      [response.body.appointment.id],
    );
    expect(stored.rows[0]!.price_cents).toBe(1200000);
  });

  it('RN-14: rechaza un inicio fuera de la grilla de 15 minutos', async () => {
    const response = await book(clientToken, { startsAt: '2026-11-24T13:07:00.000Z' });
    expect(response.status).toBe(422);
    expect(response.body.error.message).toMatch(/grilla de 15/);
  });

  it('RN-13/RN-15: rechaza horarios fuera de la franja o en la pausa', async () => {
    const pause = await book(clientToken, { startsAt: '2026-11-24T16:30:00.000Z' }); // 13:30 local
    expect(pause.status).toBe(422);

    const closing = await book(clientToken, { startsAt: '2026-11-24T21:45:00.000Z' }); // 18:45 local
    expect(closing.status).toBe(422);

    const sunday = await book(clientToken, { startsAt: '2026-11-22T13:00:00.000Z' });
    expect(sunday.status).toBe(422);
  });

  it('RN-18: exige 2 horas de anticipación', async () => {
    ctx.setNow(new Date('2026-11-24T15:30:00.000Z')); // 12:30 local
    const tooSoon = await book(clientToken, { startsAt: '2026-11-24T17:15:00.000Z' }); // 14:15
    expect(tooSoon.status).toBe(422);
    expect(tooSoon.body.error.message).toMatch(/2 horas/);

    const exactly = await book(clientToken, { startsAt: '2026-11-24T17:30:00.000Z' }); // 14:30
    expect(exactly.status).toBe(201);
  });

  it('RN-19: rechaza más de 60 días de anticipación', async () => {
    const response = await book(clientToken, { startsAt: '2027-01-20T13:00:00.000Z' });
    expect(response.status).toBe(422);
    expect(response.body.error.message).toMatch(/60 días/);
  });

  it('RN-16: impide superponer turnos del mismo profesional', async () => {
    expect((await book(clientToken)).status).toBe(201);
    const overlap = await book(secondToken);
    expect(overlap.status).toBe(422);
    expect(overlap.body.error.message).toMatch(/no está disponible/);
  });

  it('RN-17: impide superponer turnos del mismo cliente con otro profesional', async () => {
    expect((await book(clientToken)).status).toBe(201);
    const overlap = await book(clientToken, {
      professionalId: SEED_IDS.professionals.carla,
    });
    expect(overlap.status).toBe(422);
    expect(overlap.body.error.message).toMatch(/Ya tenés otro turno/);
  });

  it('RN-20: respeta los bloqueos de agenda', async () => {
    await ctx.db.query(
      `INSERT INTO time_off (professional_id, starts_at, ends_at, reason)
       VALUES ($1, $2, $3, 'Congreso')`,
      [
        SEED_IDS.professionals.nico,
        new Date('2026-11-24T13:00:00.000Z'),
        new Date('2026-11-24T14:00:00.000Z'),
      ],
    );
    const response = await book(clientToken, { startsAt: '2026-11-24T13:30:00.000Z' });
    expect(response.status).toBe(422);
  });

  it('RN-22: permite como máximo 3 turnos futuros confirmados', async () => {
    expect((await book(clientToken, { startsAt: '2026-11-24T13:00:00.000Z' })).status).toBe(201);
    expect((await book(clientToken, { startsAt: '2026-11-24T14:00:00.000Z' })).status).toBe(201);
    expect((await book(clientToken, { startsAt: '2026-11-24T15:00:00.000Z' })).status).toBe(201);
    const fourth = await book(clientToken, { startsAt: '2026-11-24T15:30:00.000Z' });
    expect(fourth.status).toBe(422);
    expect(fourth.body.error.message).toMatch(/máximo 3 turnos/);
  });

  it('RN-22: un turno cancelado no ocupa cupo', async () => {
    const first = await book(clientToken, { startsAt: '2026-11-24T13:00:00.000Z' });
    await book(clientToken, { startsAt: '2026-11-24T14:00:00.000Z' });
    await book(clientToken, { startsAt: '2026-11-24T15:00:00.000Z' });
    await ctx.db.query(`UPDATE appointments SET status = 'cancelled' WHERE id = $1`, [
      first.body.appointment.id,
    ]);
    const fourth = await book(clientToken, { startsAt: '2026-11-24T15:30:00.000Z' });
    expect(fourth.status).toBe(201);
  });

  it('RN-10/RN-11: rechaza profesional que no ofrece el servicio', async () => {
    const response = await book(clientToken, {
      serviceId: SEED_IDS.services.color,
      professionalId: SEED_IDS.professionals.martin,
    });
    expect(response.status).toBe(422);
  });

  it('RN-07: un cliente bloqueado no puede reservar', async () => {
    await ctx.db.query('UPDATE users SET blocked_until = $2 WHERE id = $1', [
      SEED_IDS.users.cliente,
      new Date('2027-01-01T00:00:00.000Z'),
    ]);
    const response = await book(clientToken);
    expect(response.status).toBe(403);
    expect(response.body.error.message).toMatch(/bloqueada/);
  });

  it('rechaza reservas sin sesión o con datos inválidos', async () => {
    const anonymous = await request(ctx.app).post('/api/appointments').send({});
    expect(anonymous.status).toBe(401);

    const invalid = await book(clientToken, { serviceId: 'no-es-uuid' });
    expect(invalid.status).toBe(400);
  });

  it('RN-16/RN-17: dos reservas concurrentes al mismo horario dejan una sola', async () => {
    const [a, b] = await Promise.all([book(clientToken), book(secondToken)]);
    const statuses = [a.status, b.status].sort();
    expect(statuses).toEqual([201, 422]);
    const count = await ctx.db.query<{ count: string }>(
      `SELECT count(*) FROM appointments WHERE status = 'confirmed'`,
    );
    expect(Number(count.rows[0]!.count)).toBe(1);
  });
});
