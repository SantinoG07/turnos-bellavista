# Informe de pruebas

Ejecución local de cierre: Node 22.22.1. Las pruebas unitarias/integración se ejecutan con PGlite aislado y las de interfaz con jsdom. El E2E usa Firefox (Playwright), Vite y Express reales sobre PGlite.

## Resultado

| Capa | Comando | Resultado |
| --- | --- | --- |
| Backend | `npm run test -w backend` | 86 tests aprobados |
| Frontend | `npm run test -w frontend` | 88 tests aprobados |
| Tipos | `npm run typecheck` | aprobado |
| Build | `npm run build` | aprobado |
| E2E | `npm run test:e2e` | 4 flujos; 44 comprobaciones de navegador aprobadas |

Los avisos de React `act(...)` de `HomePage.test.tsx` no hacen fallar la suite; son deuda de limpieza a corregir antes de una futura ampliación.

## Matriz regla → prueba

| Regla | Evidencia automatizada |
| --- | --- |
| RN-01 a RN-06 | `backend/src/http/auth.test.ts` |
| RN-07 y RN-08 | `backend/src/http/appointments.test.ts`, `admin.test.ts` |
| RN-09 a RN-12 | `backend/src/http/catalog.test.ts`, `appointments.test.ts`, `db/schema.test.ts` |
| RN-13 a RN-21 | `backend/src/http/catalog.test.ts`, `appointments.test.ts`, `domain/time.test.ts` |
| RN-22 | `backend/src/http/appointments.test.ts` |
| RN-23 a RN-28 | `backend/src/http/appointments.test.ts`, `frontend/src/pages/MyAppointmentsPage.test.tsx` |
| RN-29 a RN-32 | `backend/src/http/lifecycle.test.ts`, `http/admin.test.ts` |
| RN-33 y RN-34 | `backend/src/http/appointments.test.ts`, `frontend/src/lib/format.test.ts` |

Además, `frontend/src/pages/AdminPage.test.tsx` verifica agenda, filtros, métricas, acciones de administración, desbloqueo y bloqueos. `e2e/booking.spec.ts` cubre registro, reserva, cancelación, reprogramación y administración en navegador real.

## Criterio de salida

No se modifica una regla sin su prueba asociada. Ante un fallo, se conserva la prueba y se corrige el comportamiento; no se eliminan tests para cambiar el resultado.
