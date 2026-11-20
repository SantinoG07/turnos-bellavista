import { Router } from 'express';
import { z } from 'zod';
import { APPOINTMENT_STATUSES } from '../../domain/constants.js';
import type { AppointmentService } from '../../services/appointment.service.js';
import type { AdminService } from '../../services/admin.service.js';
import type { UserRepository } from '../../repositories/user.repository.js';
import { authenticate, requireAdmin } from '../auth.middleware.js';
import { parseBody, parseQuery } from '../validation.js';

const dateString = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Usá el formato YYYY-MM-DD.');

const appointmentsQuery = z.object({
  date: dateString.optional(),
  status: z.enum(APPOINTMENT_STATUSES).optional(),
});

const metricsQuery = z.object({
  date: dateString.optional(),
});

const clientsQuery = z.object({
  query: z.string().max(100).optional(),
});

const timeOffQuery = z.object({
  from: dateString.optional(),
  to: dateString.optional(),
});

const cancelSchema = z.object({
  reason: z.string().min(5, 'Indicá un motivo de al menos 5 caracteres.').max(300),
});

const timeOffSchema = z.object({
  professionalId: z.string().uuid('Elegí un profesional válido.'),
  startsAt: z.string().min(1).max(50),
  endsAt: z.string().min(1).max(50),
  reason: z.string().trim().min(3, 'Indicá un motivo.').max(200),
});

export function createAdminRouter(deps: {
  appointmentService: AppointmentService;
  adminService: AdminService;
  users: UserRepository;
  jwtSecret: string;
}): Router {
  const router = Router();
  router.use(authenticate(deps.users, deps.jwtSecret), requireAdmin);

  router.get('/appointments', async (req, res) => {
    const query = parseQuery(appointmentsQuery, req.query);
    const appointments = await deps.adminService.listAppointments(query.date, query.status);
    res.json({ appointments });
  });

  router.get('/metrics', async (req, res) => {
    const query = parseQuery(metricsQuery, req.query);
    res.json({ metrics: await deps.adminService.getMetrics(query.date) });
  });

  router.patch('/appointments/:id/cancel', async (req, res) => {
    const body = parseBody(cancelSchema, req.body);
    const appointment = await deps.appointmentService.cancel(
      req.user!,
      String(req.params.id),
      body.reason,
    );
    res.json({ appointment });
  });

  router.patch('/appointments/:id/complete', async (req, res) => {
    const appointment = await deps.appointmentService.complete(
      req.user!,
      String(req.params.id),
    );
    res.json({ appointment });
  });

  router.patch('/appointments/:id/no-show', async (req, res) => {
    const appointment = await deps.appointmentService.markNoShow(
      req.user!,
      String(req.params.id),
    );
    res.json({ appointment });
  });

  router.get('/clients', async (req, res) => {
    const query = parseQuery(clientsQuery, req.query);
    res.json({ clients: await deps.adminService.listClients(query.query ?? '') });
  });

  router.patch('/clients/:id/unblock', async (req, res) => {
    await deps.adminService.unblockClient(String(req.params.id));
    res.json({ ok: true });
  });

  router.get('/time-off', async (req, res) => {
    const query = parseQuery(timeOffQuery, req.query);
    res.json({ timeOff: await deps.adminService.listTimeOff(query.from, query.to) });
  });

  router.post('/time-off', async (req, res) => {
    const body = parseBody(timeOffSchema, req.body);
    const timeOff = await deps.adminService.createTimeOff(req.user!.id, body);
    res.status(201).json({ timeOff });
  });

  router.delete('/time-off/:id', async (req, res) => {
    await deps.adminService.deleteTimeOff(String(req.params.id));
    res.status(204).send();
  });

  return router;
}
