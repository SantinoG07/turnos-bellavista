# Manual técnico

## 1. Requisitos y ejecución local

Se necesita Node.js 22.12 o superior. Desde la raíz:

```bash
npm install
cp .env.example .env
# Para desarrollo sin PostgreSQL, dejar DATABASE_URL=pglite://./.pgdata
npm run migrate
npm run seed
npm run dev
```

- Frontend: `http://localhost:5173`
- API: `http://localhost:3000`
- Healthcheck: `http://localhost:3000/api/health`

`npm run dev` levanta ambos workspaces con `concurrently`. Comandos útiles:

```bash
npm run typecheck
npm test
npm run test:e2e
npm run build
npm run migrate
npm run seed
```

## 2. Estructura

```text
backend/
  src/
    app.ts                 app Express, CORS, helmet, errores
    server.ts              arranque y cierre ordenado
    config.ts              entorno, JWT, seed y zona horaria
    domain/                errores tipados, constantes, fechas/zonas
    http/
      routes/              composición de routers
      auth.middleware.ts   JWT, roles y usuario bloqueado
      validation.ts        esquemas Zod y parseo de errores
    services/              reglas de negocio y transacciones
    repositories/          SQL parametrizado
    db/
      migrations/          SQL versionado
      database.ts          adaptadores pg / PGlite
      seed.ts              catálogo, profesionales y cuentas demo
    test/                  contexto PGlite + helpers
frontend/
  src/
    pages/                 inicio, login, reserva, mis turnos, admin
    components/            layout, rutas protegidas, modales, feedback
    context/               sesión y token
    lib/                   cliente HTTP y formato de fechas/dinero
e2e/                       flujos Playwright
docs/                      especificación, plan, manuales e informe
```

## 3. Arquitectura

```text
HTTP → routes/controllers → services → repositories → PostgreSQL
```

- **Routes/controllers:** traducen HTTP a casos de uso y validan con Zod. No contienen reglas.
- **Services:** dueños de las reglas RN-01…RN-34, de las validaciones de negocio y de las
  transacciones. Reciben un reloj inyectable para tests deterministas.
- **Repositories:** SQL parametrizado. Nunca se concatena input del usuario.
- **Domain:** errores (`ApiError`), constantes de estados, utilidades de zona horaria y dinero.
- **Frontend:** React + React Router. El servidor es la fuente de verdad de disponibilidad,
  precios, duraciones y estados; la UI solo muestra y envía comandos.

### Decisiones relevantes

- Fechas en UTC (`timestamptz`, ISO con `Z`); la zona `America/Argentina/Buenos_Aires` se aplica
  en servicios y en la UI.
- Dinero en enteros de centavos (`price_cents`, `priceCents`).
- La no superposición se garantiza dentro de una transacción con
  `SELECT ... FOR UPDATE` sobre profesional y cliente, más verificación de solapamiento.
- Un turno guarda un snapshot del precio para que cambios de catálogo no alteren el historial.
- JWT de 7 días; contraseñas con scrypt y salt; rate limit de login por IP.
- PGlite permite correr desarrollo y tests sin instalar PostgreSQL. En producción se usa `pg`.

## 4. Base de datos

Migración inicial: `backend/src/db/migrations/001_init.sql`.

| Tabla | Uso |
| --- | --- |
| `users` | Clientes y administradores; `blocked_until` para penalizaciones |
| `services` | Catálogo con duración y precio en centavos |
| `professionals` | Barberos activos y su biografía |
| `professional_services` | Servicios que ofrece cada profesional |
| `availability_rules` | Franjas semanales por profesional (día, inicio, fin, pausa) |
| `time_off` | Bloqueos excepcionales de agenda |
| `appointments` | Turno con estado, precio y contador de reprogramaciones |
| `appointment_events` | Bitácora de creación, cancelación, reprogramación, atención y ausencia |

Las migraciones se ejecutan con `runMigrations` y se registran en `schema_migrations`. No se edita
una migración ya aplicada: se agrega una nueva.

## 5. API principal

| Método y ruta | Descripción | Acceso |
| --- | --- | --- |
| `GET /api/health` | Estado de la API y la base | Público |
| `POST /api/auth/register` | Alta de cliente | Público |
| `POST /api/auth/login` | Login, devuelve JWT | Público, rate limited |
| `GET /api/auth/me` | Usuario de la sesión | Autenticado |
| `GET /api/services` | Catálogo | Público |
| `GET /api/professionals?serviceId=` | Profesionales por servicio | Público |
| `GET /api/availability?...` | Slots reales por día | Público |
| `POST /api/appointments` | Crear turno | Cliente |
| `GET /api/appointments/mine?scope=` | Próximos, historial o todos | Cliente |
| `GET /api/appointments/:id` | Detalle con control de propiedad | Autenticado |
| `PATCH /api/appointments/:id/cancel` | Cancelar con motivo | Dueño o admin |
| `PATCH /api/appointments/:id/reschedule` | Reprogramar | Dueño |
| `GET /api/admin/appointments?date=&status=` | Agenda del día | Admin |
| `GET /api/admin/metrics?date=` | Métricas y próximos 7 días | Admin |
| `PATCH /api/admin/appointments/:id/complete` | Marcar atendido | Admin |
| `PATCH /api/admin/appointments/:id/no-show` | Marcar ausencia | Admin |
| `GET /api/admin/clients?query=` | Buscar clientes y ausencias | Admin |
| `PATCH /api/admin/clients/:id/unblock` | Quitar bloqueo | Admin |
| `GET/POST/DELETE /api/admin/time-off` | Gestionar bloqueos | Admin |

Formato de error:

```json
{ "error": { "code": "RULE_VIOLATION", "message": "Texto para el usuario", "details": {} } }
```

Códigos usados: `VALIDATION_ERROR` (400), `UNAUTHORIZED` (401), `FORBIDDEN` (403),
`NOT_FOUND` (404), `CONFLICT` (409), `RULE_VIOLATION` (422), `RATE_LIMITED` (429).

## 6. Pruebas

| Capa | Herramienta | Qué cubre |
| --- | --- | --- |
| Backend | Vitest + Supertest + PGlite | 86 tests de reglas, auth, catálogo, ciclo de vida y admin |
| Frontend | Vitest + Testing Library + jsdom | 88 tests de componentes, API y formato |
| E2E | Playwright + Firefox | 4 flujos y 44 comprobaciones reales |

El contexto de tests crea una base PGlite aislada, aplica migraciones y seed, y expone un reloj
fijo (`2026-11-20T12:00:00.000Z`). Los nombres de los tests citan la regla (`RN-16: ...`). El E2E
usa una base PGlite separada en `.e2e-pgdata`, que se recrea antes de cada corrida.

## 7. Seguridad

- No versionar `.env`, `.env.local`, claves ni bases locales.
- `JWT_SECRET` obligatorio en producción (mínimo 32 caracteres recomendado).
- Helmet, CORS restringido a `CORS_ORIGIN` y rate limit de login.
- Validación Zod de body/query, errores sin stack en producción.
- SQL siempre parametrizado; sin ORM.
