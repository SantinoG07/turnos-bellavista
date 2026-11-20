import { Router } from 'express';
import type { AppDependencies } from '../../app.js';
import { config } from '../../config.js';
import { UserRepository } from '../../repositories/user.repository.js';
import { AuthService } from '../../services/auth.service.js';
import { createAuthRouter } from './auth.routes.js';

export function createApiRouter(deps: AppDependencies): Router {
  const router = Router();
  const jwtSecret = deps.jwtSecret ?? config.jwtSecret;
  const users = new UserRepository(deps.db);
  const authService = new AuthService(users, jwtSecret, deps.now);

  router.use(
    '/auth',
    createAuthRouter({
      authService,
      users,
      jwtSecret,
      rateLimit: deps.rateLimit,
    }),
  );

  return router;
}
