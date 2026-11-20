import { Router } from 'express';
import type { AppDependencies } from '../../app.js';
import { config } from '../../config.js';
import { AvailabilityService } from '../../services/availability.service.js';
import { CatalogService } from '../../services/catalog.service.js';
import { CatalogRepository } from '../../repositories/catalog.repository.js';
import { UserRepository } from '../../repositories/user.repository.js';
import { AuthService } from '../../services/auth.service.js';
import { createAuthRouter } from './auth.routes.js';
import { createCatalogRouter } from './catalog.routes.js';

export function createApiRouter(deps: AppDependencies): Router {
  const router = Router();
  const jwtSecret = deps.jwtSecret ?? config.jwtSecret;
  const now = deps.now ?? (() => new Date());
  const users = new UserRepository(deps.db);
  const catalog = new CatalogRepository(deps.db);
  const authService = new AuthService(users, jwtSecret, now);
  const catalogService = new CatalogService(catalog);
  const availabilityService = new AvailabilityService(catalog, catalogService, now);

  router.use(
    '/auth',
    createAuthRouter({
      authService,
      users,
      jwtSecret,
      rateLimit: deps.rateLimit,
    }),
  );

  router.use(
    '/',
    createCatalogRouter({
      catalogService,
      availabilityService,
    }),
  );

  return router;
}
