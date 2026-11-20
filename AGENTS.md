# AGENTS.md — Turnos Bellavista

## Qué es este repo

Sistema de gestión de turnos para una barbería de Buenos Aires. Proyecto propio de la
Generación T. El objetivo es demostrar reglas de negocio reales, una arquitectura en capas
y un flujo completo de desarrollo con tests.

- **Dominio:** reserva, reprogramación y cancelación de turnos; disponibilidad semanal;
  bloqueos de agenda; penalizaciones por ausencias.
- **Usuario final:** clientes que reservan desde el navegador y administración del local.
- **Fuente de verdad:** el backend y PostgreSQL. El frontend nunca calcula precios,
  duraciones, estados ni disponibilidad definitiva.

## Stack

| Capa | Tecnología |
| --- | --- |
| Frontend | React 19 + Vite + TypeScript + React Router |
| Backend | Node.js >= 22.12 + Express 5 + TypeScript |
| Base de datos | PostgreSQL (Neon en producción, Docker o PGlite en local) |
| Tests backend | Vitest + Supertest + PGlite (PostgreSQL real compilado a WASM) |
| Tests frontend | Vitest + React Testing Library + jsdom |
| E2E | Playwright |
| Deploy | Netlify (frontend), Render (API), Neon (PostgreSQL) |

## Arquitectura del backend

```
HTTP -> routes -> controllers -> services -> repositories -> PostgreSQL
```

- **Controllers:** traducen HTTP a casos de uso. No contienen reglas de negocio.
- **Services:** dueños de las reglas (RN-xx de `docs/spec.md`), validaciones y transacciones.
- **Repositories:** SQL parametrizado. Nunca se interpola input del usuario en SQL.
- **Domain:** errores tipados, reloj inyectable, cálculo de horarios y reglas puras.
- **DB:** migraciones SQL versionadas; sin ORM.

## Convenciones

- TypeScript estricto. Nada de `any` sin justificar.
- Fechas: **siempre** `timestamptz` en UTC en la base y en la API (ISO 8601 con `Z`).
  La zona horaria del negocio es `America/Argentina/Buenos_Aires` y se aplica en la capa
  de dominio/servicio y en la UI para mostrar.
- Dinero: enteros en centavos (`priceCents`). Nunca floats.
- Errores de API: `{ "error": { "code": "...", "message": "...", "details": ... } }`.
- Tests: un test debe nombrar la regla que cubre (`RN-16: ...`).
- Commits: uno por tarea (`T01: ...`). Las tareas viven en `docs/tareas.md`.

## Comandos

```bash
npm install                 # instalar workspaces
npm run dev                 # API + frontend en paralelo
npm run migrate             # aplicar migraciones
npm run seed                # datos demo (admin + catálogo)
npm test                    # tests backend + frontend
npm run test:e2e            # Playwright
npm run build               # build de producción
npm run typecheck           # chequeo de tipos
```

Con `DATABASE_URL` vacío o `pglite://...` el backend usa PGlite para desarrollo local,
sin necesidad de instalar PostgreSQL. Con una URL `postgresql://` usa el driver `pg`.

## Reglas para agentes

1. Leer `docs/spec.md` antes de tocar reglas de negocio.
2. Toda regla nueva necesita: spec, implementación, test y fila en `docs/informe-de-pruebas.md`.
3. No commitear `.env`, tokens, contraseñas reales ni URLs con credenciales.
4. No cambiar el contrato de la API sin actualizar spec, frontend y tests.
5. No usar ORM ni SQL concatenado.
6. Mantener los tests existentes pasando; no borrar tests para "arreglar" una falla.
7. Si una tarea cambia el esquema, agregar una migración nueva; no editar la anterior.
