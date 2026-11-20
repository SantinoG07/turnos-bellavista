import { Router } from 'express';
import { z } from 'zod';
import type { AppointmentService } from '../../services/appointment.service.js';
import type { UserRepository } from '../../repositories/user.repository.js';
import { authenticate } from '../auth.middleware.js';
import { parseBody } from '../validation.js';

const createSchema = z.object({
  serviceId: z.string().uuid('Elegí un servicio válido.'),
  professionalId: z.string().uuid('Elegí un profesional válido.'),
  startsAt: z.string().min(1, 'Elegí un horario.').max(50),
  notes: z.string().max(500).optional().nullable(),
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

  return router;
}
