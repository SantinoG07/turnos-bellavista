import { Router } from 'express';
import { z } from 'zod';
import type { AppointmentService } from '../../services/appointment.service.js';
import type { UserRepository } from '../../repositories/user.repository.js';
import { authenticate } from '../auth.middleware.js';
import { parseBody, parseQuery } from '../validation.js';

const createSchema = z.object({
  serviceId: z.string().uuid('Elegí un servicio válido.'),
  professionalId: z.string().uuid('Elegí un profesional válido.'),
  startsAt: z.string().min(1, 'Elegí un horario.').max(50),
  notes: z.string().max(500).optional().nullable(),
});

const scopeSchema = z.object({
  scope: z.enum(['upcoming', 'past', 'all']).default('upcoming'),
});

const cancelSchema = z.object({
  reason: z.string().max(300).optional().nullable(),
});

const rescheduleSchema = z.object({
  startsAt: z.string().min(1, 'Elegí un horario.').max(50),
});

export function createAppointmentsRouter(deps: {
  appointmentService: AppointmentService;
  users: UserRepository;
  jwtSecret: string;
}): Router {
  const router = Router();
  const auth = authenticate(deps.users, deps.jwtSecret);

  router.post('/', auth, async (req, res) => {
    const body = parseBody(createSchema, req.body);
    const appointment = await deps.appointmentService.create(req.user!.id, body);
    res.status(201).json({ appointment });
  });

  router.get('/mine', auth, async (req, res) => {
    const query = parseQuery(scopeSchema, req.query);
    const appointments = await deps.appointmentService.listMine(
      req.user!,
      query.scope ?? 'upcoming',
    );
    res.json({ appointments });
  });

  router.get('/:id', auth, async (req, res) => {
    const appointment = await deps.appointmentService.getById(
      req.user!,
      String(req.params.id),
    );
    res.json({ appointment });
  });

  router.patch('/:id/cancel', auth, async (req, res) => {
    const body = parseBody(cancelSchema, req.body ?? {});
    const appointment = await deps.appointmentService.cancel(
      req.user!,
      String(req.params.id),
      body.reason,
    );
    res.json({ appointment });
  });

  router.patch('/:id/reschedule', auth, async (req, res) => {
    const body = parseBody(rescheduleSchema, req.body);
    const appointment = await deps.appointmentService.reschedule(
      req.user!,
      String(req.params.id),
      body.startsAt,
    );
    res.json({ appointment });
  });

  return router;
}
