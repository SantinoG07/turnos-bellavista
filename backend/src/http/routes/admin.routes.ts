import { Router } from 'express';
import { z } from 'zod';
import type { AppointmentService } from '../../services/appointment.service.js';
import type { UserRepository } from '../../repositories/user.repository.js';
import { authenticate, requireAdmin } from '../auth.middleware.js';
import { parseBody } from '../validation.js';

const cancelSchema = z.object({
  reason: z.string().min(5, 'Indicá un motivo de al menos 5 caracteres.').max(300),
});

export function createAdminRouter(deps: {
  appointmentService: AppointmentService;
  users: UserRepository;
  jwtSecret: string;
}): Router {
  const router = Router();
  router.use(authenticate(deps.users, deps.jwtSecret), requireAdmin);

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
    const appointment = await deps.appointmentService.complete(req.user!, String(req.params.id));
    res.json({ appointment });
  });

  router.patch('/appointments/:id/no-show', async (req, res) => {
    const appointment = await deps.appointmentService.markNoShow(req.user!, String(req.params.id));
    res.json({ appointment });
  });

  return router;
}
