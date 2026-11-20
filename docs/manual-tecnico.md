# Manual técnico

## Requisitos y ejecución local

Se necesita Node.js 22.12 o superior. Desde la raíz:

```bash
npm install
cp .env.example .env
# Elegir PostgreSQL o comentar DATABASE_URL para PGlite local
npm run migrate
npm run seed
npm run dev
```

Frontend: `http://localhost:5173`. API y healthcheck: `http://localhost:3000/health`.

## Arquitectura

React consume la API Express. En el backend, las rutas validan la entrada, los servicios aplican reglas y transacciones, y los repositorios ejecutan SQL parametrizado. Las migraciones viven en `backend/src/db/migrations`; no se edita una migración ya aplicada.

`DATABASE_URL` con esquema `postgresql://` usa `pg`; vacía o `pglite://` usa PGlite. La base guarda `timestamptz` UTC; los cálculos de negocio usan `America/Argentina/Buenos_Aires`.

## Calidad

```bash
npm run typecheck
npm test
npm run test:e2e
npm run build
```

Playwright prepara una base PGlite aislada en `.e2e-pgdata` y levanta API y Vite reales. No versionar `.env`, bases locales, reportes ni claves privadas.
