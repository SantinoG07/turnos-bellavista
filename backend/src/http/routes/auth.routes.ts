import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import { z } from 'zod';
import { RULES } from '../../domain/constants.js';
import { parseBody } from '../validation.js';
import { authenticate } from '../auth.middleware.js';
import type { AuthService } from '../../services/auth.service.js';
import type { UserRepository } from '../../repositories/user.repository.js';

const registerSchema = z.object({
  fullName: z.string().trim().min(2, 'Ingresá tu nombre.').max(100),
  email: z.string().trim().email('Ingresá un email válido.').max(200),
  password: z.string().min(1, 'Ingresá una contraseña.').max(200),
  phone: z.string().trim().max(40).optional().nullable(),
});

const loginSchema = z.object({
  email: z.string().trim().email('Ingresá un email válido.'),
  password: z.string().min(1, 'Ingresá tu contraseña.'),
});

export interface AuthRouterDeps {
  authService: AuthService;
  users: UserRepository;
  jwtSecret: string;
  rateLimit?: { max?: number; windowMs?: number };
}

export function createAuthRouter(deps: AuthRouterDeps): Router {
  const router = Router();

  const loginLimiter = rateLimit({
    windowMs: deps.rateLimit?.windowMs ?? RULES.loginWindowMinutes * 60_000,
    limit: deps.rateLimit?.max ?? RULES.loginMaxAttempts,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    handler: (_req, res) => {
      res.status(429).json({
        error: {
          code: 'RATE_LIMITED',
          message: 'Demasiados intentos de inicio de sesión. Esperá 15 minutos y volvé a intentar.',
        },
      });
    },
  });

  router.post('/register', async (req, res) => {
    const body = parseBody(registerSchema, req.body);
    const result = await deps.authService.register(body);
    res.status(201).json(result);
  });

  router.post('/login', loginLimiter, async (req, res) => {
    const body = parseBody(loginSchema, req.body);
    const result = await deps.authService.login(body);
    res.json(result);
  });

  router.get('/me', authenticate(deps.users, deps.jwtSecret), async (req, res) => {
    const user = await deps.authService.me(req.user!.id);
    res.json({ user });
  });

  return router;
}
