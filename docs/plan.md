# Plan de trabajo — Turnos Bellavista

## 1. Objetivo de la entrega

Publicar un sistema de turnos funcional con reglas de negocio reales, frontend, backend y
base de datos en internet, documentación completa, tests automatizados y un historial de Git
con un commit por tarea.

## 2. Enfoque

Trabajo por fases verticales: cada tarea deja algo verificable (una migración, un endpoint,
una pantalla o un informe). Las reglas se escriben primero en `docs/spec.md` y después se
implementan y testean. No se avanza con tests rojos.

### Fases

1. **Base (T01–T03):** repo, especificación, esquema, esqueleto del backend y conexión a
   PostgreSQL/PGlite.
2. **Núcleo del negocio (T04–T08):** autenticación, catálogo, disponibilidad, reservas,
   cancelaciones, penalizaciones y administración.
3. **Interfaz (T09–T12):** login, flujo de reserva, mis turnos y panel admin.
4. **Calidad y entrega (T13–T15):** E2E, informe de pruebas, manuales, despliegue y
   auditoría final de la checklist.

## 3. Arquitectura

```
Navegador
  │  React + Vite (Netlify)
  ▼  fetch HTTPS / JSON
API Express 5 (Render)
  │  controllers → services → repositories
  ▼  SQL parametrizado
PostgreSQL (Neon)
```

Decisiones:

- **Sin ORM:** SQL explícito y parametrizado para controlar las consultas y demostrar SQL.
- **PGlite en tests:** es PostgreSQL compilado a WebAssembly. Permite tests de integración
  reales sin depender de un servicio externo ni de Docker en CI. En producción se usa `pg`
  contra Neon.
- **Reloj inyectable:** los servicios reciben `now()` para poder testear anticipación,
  cancelaciones y penalizaciones sin esperar.
- **Transacciones con bloqueo:** la reserva bloquea la fila del profesional y del cliente
  para evitar dobles reservas concurrentes.
- **Precio en centavos:** evita errores de punto flotante.
- **JWT stateless:** no se guarda sesión en la base; el token dura 7 días. El logout es del
  lado del cliente. Para un sistema con revocación inmediata se necesitaría una tabla de
  sesiones, fuera de alcance.
- **Rate limit en memoria:** suficiente para una sola instancia. En un despliegue con varias
  instancias habría que usar Redis o el rate limit del proveedor.

## 4. Entornos

| Entorno | Frontend | Backend | DB |
| --- | --- | --- | --- |
| Local | Vite `:5173` | Express `:3000` | PGlite o PostgreSQL Docker |
| Test | jsdom | Vitest + Supertest + PGlite | PGlite en memoria |
| Producción | Netlify | Render | Neon |

Variables: ver `.env.example`. Ningún secreto se versiona.

## 5. Riesgos y mitigaciones

| Riesgo | Mitigación |
| --- | --- |
| Doble reserva por concurrencia | Transacción + `SELECT ... FOR UPDATE` sobre profesional y cliente. |
| Diferencias de zona horaria | Todo UTC en DB/API; Luxon para convertir desde/hacia Buenos Aires. |
| Rate limit por IP detrás de proxy | `trust proxy` configurable y documentado en la guía de despliegue. |
| PGlite no soporta alguna función de PG | Se usan funciones estándar; los tests corren contra el mismo SQL. |
| Cold start de Render | Healthcheck y reintento en el frontend; plan gratuito documentado. |
| Pérdida de datos en Neon | Backups automáticos y migraciones idempotentes. |
| Cuentas demo en producción | El seed es explícito y usa variables de entorno; se documenta cambiar la clave. |

## 6. Definition of Done

- [ ] `npm run typecheck` sin errores.
- [ ] `npm test` verde (backend y frontend).
- [ ] `npm run test:e2e` verde.
- [ ] Las 34 reglas con test y fila en la matriz.
- [ ] `npm run build` genera ambos artefactos.
- [ ] Sin secretos: solo `.env.example`; `git grep` no encuentra claves.
- [ ] README con enlaces públicos y guía de despliegue.
- [ ] Un commit por tarea, tareas tildadas.
- [ ] Deploy verificado de punta a punta con un turno real de prueba.

## 7. Cronograma sugerido

| Semana | Tareas |
| --- | --- |
| 1 | T01–T03: base, esquema y esqueleto. |
| 2 | T04–T06: auth, catálogo, disponibilidad y reserva. |
| 3 | T07–T09: ciclo del turno, admin y frontend base. |
| 4 | T10–T12: flujo de reserva, mis turnos y panel admin. |
| 5 | T13–T15: E2E, documentación, deploy y auditoría. |
| Buffer | Correcciones, revisión de la checklist y presentación. |

Entrega: **31/12**.
