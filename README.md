# Turnos Bellavista

Sistema de turnos para una barbería. Proyecto propio de la **Generación T**.

> Estado: en construcción. La documentación definitiva y los enlaces públicos se completan
> en T15.

## Stack

- Frontend: React + Vite + TypeScript.
- Backend: Node.js 22 + Express 5 + TypeScript.
- Base de datos: PostgreSQL (Neon en producción).
- Tests: Vitest, Supertest, React Testing Library y Playwright.

## Documentación

- [Especificación y 34 reglas](docs/spec.md)
- [Plan](docs/plan.md)
- [Tareas](docs/tareas.md)
- [AGENTS.md](AGENTS.md)

## Cómo correr

```bash
npm install
npm run migrate
npm run seed
npm run dev
```

Con `DATABASE_URL` vacío se usa PGlite local. Ver `.env.example` para PostgreSQL real.
