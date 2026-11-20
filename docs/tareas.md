# Tareas — Turnos Bellavista

Cada tarea tiene un commit propio. El mensaje del commit empieza con el identificador.
Se tilda una tarea solo cuando su código, sus tests y su documentación están completos.

## T01 — Bootstrap, especificación y plan

- [x] Repo Git, `.gitignore`, `.editorconfig`, workspaces npm y `tsconfig` base.
- [x] `AGENTS.md` con stack, arquitectura y convenciones.
- [x] `docs/spec.md` con 34 reglas numeradas (RN-01 a RN-34) y contrato de API.
- [x] `docs/plan.md` con fases, arquitectura, riesgos y Definition of Done.
- [x] `.env.example` sin secretos.
- Commit: `T01: bootstrap del repo, especificación y plan`

## T02 — Esquema, migraciones y datos demo

- [x] Migración `001_init.sql` con todas las tablas, checks e índices.
- [x] Runner de migraciones para PostgreSQL y PGlite.
- [x] Seed idempotente: admin, servicios, profesionales, horarios.
- [x] Scripts `migrate` y `seed`.
- [x] Tests del esquema (restricciones y seed).
- Commit: `T02: esquema PostgreSQL, migraciones y seed`

## T03 — Esqueleto del backend

- [x] Configuración por entorno y validación de variables.
- [x] Fábrica de base de datos (`pg` y PGlite) y transacciones.
- [x] App Express 5, healthcheck, manejo central de errores y CORS.
- [x] Repositorios base y utilidades de fecha/dinero.
- [x] Tests de healthcheck y errores.
- Commit: `T03: esqueleto Express, configuración y acceso a datos`

## T04 — Autenticación y seguridad

- [x] Registro y login con scrypt, JWT de 7 días y validaciones RN-01/02/03/04.
- [x] Middleware de autenticación y autorización RN-05/08.
- [x] Rate limit de login RN-06.
- [x] Bloqueo de clientes RN-07.
- [x] Tests de auth, token, roles y rate limit.
- Commit: `T04: autenticación scrypt, JWT y rate limit`

## T05 — Catálogo y disponibilidad

- [x] Endpoints de servicios y profesionales.
- [x] Validaciones de catálogo RN-09/10/11.
- [x] Motor de disponibilidad RN-13 a RN-21 con Luxon.
- [x] Endpoint de slots y tests de huecos, pausas, bloqueos y anticipación.
- Commit: `T05: catálogo y cálculo de disponibilidad`

## T06 — Reserva de turnos

- [x] Servicio transaccional de creación RN-16/17/22/33.
- [x] Snapshot de precio RN-12.
- [x] Prevención de dobles reservas concurrentes.
- [x] Endpoint `POST /appointments` y tests de todas las reglas de reserva.
- Commit: `T06: reserva de turnos con reglas y transacción`

## T07 — Cancelación, reprogramación y ausencias

- [x] Cancelación de cliente y admin RN-23/24/25/26.
- [x] Reprogramación con revalidación y límite RN-27/28.
- [x] Atendido, ausencia, penalización y estados terminales RN-29 a RN-32.
- [x] Historial de eventos del turno.
- [x] Tests de plazos, carreras de estado y bloqueo por ausencias.
- Commit: `T07: ciclo de vida del turno y penalizaciones`

## T08 — API de administración

- [x] Agenda por fecha/estado y métricas.
- [x] Clientes, desbloqueo y bloqueos de agenda.
- [x] Autorización admin en todos los endpoints.
- [x] Tests de administración y aislamiento.
- Commit: `T08: API de administración y agenda`

## T09 — Frontend base y autenticación

- [x] Vite + React + TS, router, layout y estilos.
- [x] Cliente HTTP con token, manejo de errores y sesión.
- [x] Pantallas de login/registro y contexto de auth.
- [x] Tests de formularios, token y rutas protegidas.
- Commit: `T09: frontend base, login y registro`

## T10 — Flujo de reserva

- [x] Selección de servicio, profesional, fecha y horario.
- [x] Confirmación con resumen, notas y estados de carga/error.
- [x] Manejo de slots que se ocupan mientras se navega.
- [x] Tests del flujo completo y de errores de disponibilidad.
- Commit: `T10: flujo de reserva de turnos en React`

## T11 — Mis turnos

- [x] Listado próximo/pasado, detalle y estados.
- [x] Cancelación con confirmación y motivo.
- [x] Reprogramación con selección de nuevo horario.
- [x] Tests de cancelación, reprogramación y mensajes.
- Commit: `T11: pantalla de mis turnos con cancelación y reprogramación`

## T12 — Panel de administración

- [x] Agenda del día, filtros y métricas.
- [x] Acciones: atender, ausencia, cancelar con motivo.
- [x] Bloqueos de agenda y desbloqueo de clientes.
- [x] Tests de panel y permisos.
- Commit: `T12: panel de administración`

## T13 — Pruebas de punta a punta

- [x] Playwright con backend y frontend reales.
- [x] Flujos: registro, reserva, cancelación, reprogramación y admin.
- [x] Al menos 44 comprobaciones E2E.
- [x] Corrección de defectos encontrados.
- Commit: `T13: pruebas E2E en navegador real`

## T14 — Informe de pruebas y manuales

- [x] `docs/informe-de-pruebas.md` con matriz RN → test → resultado.
- [x] `docs/relevamiento.md`.
- [x] `docs/manual-de-usuario.md` y `docs/manual-tecnico.md`.
- [x] `docs/guia-de-despliegue.md`.
- Commit: `T14: informe de pruebas y manuales`

## T15 — Despliegue, README y auditoría final

- [x] Configuración Netlify, Render y Neon documentada.
- [x] README con problema, arquitectura, stack, enlaces y cómo correr.
- [x] Revisión de secretos, historial, tests y checklist.
- [ ] Enlaces públicos y verificación final (requiere cuentas de despliegue del propietario).
- Commit: `T15: despliegue, README y auditoría final`
