# Informe de pruebas

Ejecución local de cierre: Node 22.22.1, npm 9.2.0. Las pruebas de backend usan PGlite
(PostgreSQL real compilado a WASM) en memoria; las de frontend usan jsdom; el E2E usa Firefox de
Playwright con Vite y Express reales sobre una base PGlite aislada.

## Resultado de la última corrida

| Capa | Comando | Resultado |
| --- | --- | --- |
| Backend | `npm run test -w backend` | **86 tests aprobados** (8 archivos) |
| Frontend | `npm run test -w frontend` | **88 tests aprobados** (10 archivos) |
| Tipos | `npm run typecheck` | Aprobado |
| Build producción | `npm run build` | Aprobado (backend + frontend) |
| E2E | `npm run test:e2e` | **4 flujos, 44 comprobaciones aprobadas** |
| Migraciones/seed | `npm run migrate && npm run seed` | Aprobado contra PGlite y Neon |

Los avisos de React `act(...)` en `HomePage.test.tsx` no hacen fallar la suite; son ruido de
actualización asíncrona en un test de carga y quedan documentados como deuda menor.

## Matriz regla → prueba → resultado

Todas las reglas RN-01…RN-34 de `docs/spec.md` tienen al menos una prueba automatizada cuyo
nombre cita la regla.

| Regla | Evidencia principal | Resultado |
| --- | --- | --- |
| RN-01 | `backend/src/db/schema.test.ts`, `http/auth.test.ts` | Aprobado |
| RN-02 | `backend/src/http/auth.test.ts` | Aprobado |
| RN-03 | `backend/src/http/auth.test.ts` | Aprobado |
| RN-04 | `backend/src/http/auth.test.ts` | Aprobado |
| RN-05 | `backend/src/http/auth.test.ts`, `http/admin.test.ts` | Aprobado |
| RN-06 | `backend/src/http/auth.test.ts` | Aprobado |
| RN-07 | `backend/src/http/appointments.test.ts`, `http/auth.test.ts` | Aprobado |
| RN-08 | `backend/src/http/lifecycle.test.ts` | Aprobado |
| RN-09 | `backend/src/db/schema.test.ts` | Aprobado |
| RN-10 | `backend/src/http/appointments.test.ts`, `http/catalog.test.ts` | Aprobado |
| RN-11 | `backend/src/http/appointments.test.ts`, `http/catalog.test.ts` | Aprobado |
| RN-12 | `backend/src/http/appointments.test.ts` | Aprobado |
| RN-13 | `backend/src/db/schema.test.ts`, `http/catalog.test.ts`, `domain/time.test.ts` | Aprobado |
| RN-14 | `backend/src/http/appointments.test.ts`, `domain/time.test.ts` | Aprobado |
| RN-15 | `backend/src/http/appointments.test.ts`, `http/catalog.test.ts` | Aprobado |
| RN-16 | `backend/src/http/appointments.test.ts`, `http/catalog.test.ts` | Aprobado |
| RN-17 | `backend/src/http/appointments.test.ts` | Aprobado |
| RN-18 | `backend/src/http/appointments.test.ts`, `http/catalog.test.ts` | Aprobado |
| RN-19 | `backend/src/http/appointments.test.ts`, `http/catalog.test.ts` | Aprobado |
| RN-20 | `backend/src/http/appointments.test.ts`, `http/catalog.test.ts` | Aprobado |
| RN-21 | `backend/src/http/catalog.test.ts` | Aprobado |
| RN-22 | `backend/src/http/appointments.test.ts` | Aprobado |
| RN-23 | `backend/src/http/lifecycle.test.ts`, `frontend/src/pages/MyAppointmentsPage.test.tsx` | Aprobado |
| RN-24 | `backend/src/http/lifecycle.test.ts` | Aprobado |
| RN-25 | `backend/src/http/lifecycle.test.ts` | Aprobado |
| RN-26 | `backend/src/http/lifecycle.test.ts`, `frontend/src/pages/MyAppointmentsPage.test.tsx` | Aprobado |
| RN-27 | `backend/src/http/lifecycle.test.ts`, `frontend/src/pages/MyAppointmentsPage.test.tsx` | Aprobado |
| RN-28 | `backend/src/http/lifecycle.test.ts` | Aprobado |
| RN-29 | `backend/src/http/lifecycle.test.ts`, `frontend/src/lib/format.test.ts` | Aprobado |
| RN-30 | `backend/src/http/lifecycle.test.ts`, `frontend/src/lib/format.test.ts` | Aprobado |
| RN-31 | `backend/src/http/lifecycle.test.ts` | Aprobado |
| RN-32 | `backend/src/db/schema.test.ts`, `http/lifecycle.test.ts` | Aprobado |
| RN-33 | `backend/src/http/appointments.test.ts` | Aprobado |
| RN-34 | `backend/src/domain/time.test.ts`, `frontend/src/lib/format.test.ts` | Aprobado |

## Cobertura por capa

### Backend (86 tests)

- `auth.test.ts` (13): registro, scrypt, JWT, roles, bloqueo y rate limit.
- `catalog.test.ts` (14): catálogo, profesionales, disponibilidad, pausas, time off, límites.
- `appointments.test.ts` (16): creación, snapshot de precio, propiedad, límite de 3, concurrencia.
- `lifecycle.test.ts` (14): cancelación, reprogramación, atención, ausencia y penalizaciones.
- `admin.test.ts` (11): autorización, agenda, métricas, clientes, desbloqueo y bloqueos.
- `schema.test.ts` (8), `app.test.ts` (4), `domain/time.test.ts` (6): esquema, salud y fechas.

### Frontend (88 tests)

- `lib/api.test.ts` y `lib/format.test.ts`: contrato HTTP, errores, token, fechas y dinero.
- `AuthContext.test.tsx`, `AuthPage.test.tsx`, `ProtectedRoute.test.tsx`: sesión y permisos.
- `BookingPage.test.tsx` (12): flujo de reserva, recarga de disponibilidad y conflictos.
- `MyAppointmentsPage.test.tsx` (10): listado, cancelación, reprogramación y límites.
- `AdminPage.test.tsx` (13): métricas, agenda, acciones, clientes y bloqueos.
- `HomePage.test.tsx` y `Layout.test.tsx`: portada, navegación y aviso de bloqueo.

### E2E (4 flujos, 44 comprobaciones)

1. Registro, reserva, visualización y cancelación desde el navegador.
2. Reprogramación a un nuevo horario del mismo profesional.
3. Login de administración, agenda, métricas y creación de un bloqueo.
4. Portada pública: servicios, textos de reglas y navegación antes de iniciar sesión.

## Criterio de salida

No se modifica una regla sin su prueba asociada. Ante un fallo se conserva la prueba y se corrige
el comportamiento; no se eliminan tests para cambiar el resultado. Los defectos encontrados
durante el E2E (fecha inicial de reprogramación, precedencia de variables de entorno y selectores
ambiguos) se corrigieron en código o en los tests y quedaron cubiertos por la suite.
