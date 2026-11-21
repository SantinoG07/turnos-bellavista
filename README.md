# Turnos Bellavista

Aplicación web de reservas para una barbería de Buenos Aires, creada como proyecto final de Generación T. Resuelve disponibilidad real por profesional, evita superposiciones, permite gestionar cambios y ofrece una agenda administrativa.

## Estado de entrega

La aplicación, sus migraciones, documentación y pruebas están incluidas en este repositorio. La configuración para Netlify, Render y Neon está lista. Las URLs públicas no se publican hasta que el dueño conecte sus cuentas y cargue sus variables; ver [guía de despliegue](docs/guia-de-despliegue.md).

## Reglas de negocio destacadas

- Horarios semanales, grilla de 15 minutos, pausas y bloqueos excepcionales.
- Sin doble reserva para profesional ni cliente, incluso ante concurrencia.
- Reserva entre 2 horas y 60 días de anticipación; máximo 3 turnos futuros.
- Cancelación/reprogramación hasta 2 horas antes; máximo 2 reprogramaciones.
- Tres ausencias en 180 días bloquean nuevas reservas durante 30 días.

La especificación completa tiene 34 reglas numeradas en [docs/spec.md](docs/spec.md).

## Arquitectura y stack

```text
React + Vite (Netlify) → Express 5 + TypeScript (Render) → PostgreSQL (Neon)
                                  │
                    services → repositories → SQL parametrizado
```

- Frontend: React 19, Vite, TypeScript y React Router.
- Backend: Node.js >= 22.12, Express 5, Zod, JWT y scrypt.
- Datos: PostgreSQL en producción; PGlite para desarrollo y pruebas.
- Calidad: Vitest, Supertest, React Testing Library y Playwright.

## Ejecutar localmente

```bash
npm install
cp .env.example .env
npm run migrate
npm run seed
npm run dev
```

El frontend abre en `http://localhost:5173` y la API en `http://localhost:3000`. Sin `DATABASE_URL`, el backend usa PGlite. Nunca subir `.env`.

## Calidad

```bash
npm run typecheck
npm test
npm run test:e2e
npm run build
```

Resultado de cierre: 86 pruebas backend, 88 frontend y 4 flujos Playwright con 44 comprobaciones de navegador. Ver [informe de pruebas](docs/informe-de-pruebas.md).

## Documentación

- [Especificación funcional y API](docs/spec.md)
- [Plan y Definition of Done](docs/plan.md)
- [Tareas y commits](docs/tareas.md)
- [Relevamiento](docs/relevamiento.md)
- [Manual de usuario](docs/manual-de-usuario.md)
- [Manual técnico](docs/manual-tecnico.md)
- [Guía de despliegue](docs/guia-de-despliegue.md)
- [Instrucciones para colaboradores/agentes](AGENTS.md)
