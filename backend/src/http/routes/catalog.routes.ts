import { Router } from 'express';
import { z } from 'zod';
import { isDateKey } from '../../domain/time.js';
import type { AvailabilityService } from '../../services/availability.service.js';
import type { CatalogService } from '../../services/catalog.service.js';
import { parseQuery } from '../validation.js';

const professionalsQuery = z.object({
  serviceId: z.string().uuid().optional(),
});

const availabilityQuery = z.object({
  professionalId: z.string().uuid('Elegí un profesional válido.'),
  serviceId: z.string().uuid('Elegí un servicio válido.'),
  date: z.string().refine(isDateKey, 'La fecha debe tener formato YYYY-MM-DD.'),
});

export function createCatalogRouter(deps: {
  catalogService: CatalogService;
  availabilityService: AvailabilityService;
}): Router {
  const router = Router();

  router.get('/services', async (_req, res) => {
    res.json({ services: await deps.catalogService.listServices() });
  });

  router.get('/professionals', async (req, res) => {
    const query = parseQuery(professionalsQuery, req.query);
    res.json({ professionals: await deps.catalogService.listProfessionals(query.serviceId) });
  });

  router.get('/availability', async (req, res) => {
    const query = parseQuery(availabilityQuery, req.query);
    res.json(await deps.availabilityService.getSlots(query));
  });

  return router;
}
