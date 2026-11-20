# Especificación funcional — Turnos Bellavista

Versión 1.0 · Proyecto Generación T

## 1. Problema y alcance

Barbería Bellavista atiende de martes a sábado con tres profesionales. Hoy los turnos se
toman por WhatsApp, lo que genera superposiciones, olvidos y discusiones por cancelaciones
tardías. Este sistema reemplaza ese proceso con una agenda online.

**Incluye:**

- Registro e inicio de sesión de clientes.
- Catálogo de servicios y profesionales.
- Disponibilidad calculada a partir de horarios semanales, bloqueos y turnos ya tomados.
- Reserva, cancelación y reprogramación de turnos.
- Panel de administración: agenda del día, métricas, bloqueos de agenda, ausencias y
  desbloqueo de clientes.
- Reglas de penalización por ausencias reiteradas.

**No incluye (fuera de alcance):** pagos online, notificaciones por email/WhatsApp,
facturación, multi-sucursal, recuperación de contraseña por correo, aplicación móvil nativa.

## 2. Actores

| Actor | Descripción |
| --- | --- |
| Visitante | Persona sin sesión. Puede ver servicios y profesionales. |
| Cliente | Usuario registrado con rol `client`. Reserva y gestiona sus propios turnos. |
| Administrador | Usuario con rol `admin`. Gestiona toda la agenda y las cuentas. |

## 3. Zona horaria, fechas y dinero

- Zona del negocio: `America/Argentina/Buenos_Aires`.
- En PostgreSQL todas las marcas de tiempo se guardan como `timestamptz` (UTC).
- La API intercambia fechas ISO 8601 en UTC (`2026-12-01T13:00:00.000Z`).
- La UI muestra días y horarios en la zona del negocio.
- El dinero se guarda en centavos (`priceCents`, entero). `$12.000` = `1200000`.

## 4. Reglas de negocio

Cada regla tiene un identificador estable. Los tests y el informe de pruebas la referencian.

### 4.1 Cuentas y seguridad

**RN-01 — Email normalizado y único.** Al registrarse, el email se recorta y se pasa a
minúsculas. No puede existir otra cuenta con el mismo email. Un duplicado responde `409`.

**RN-02 — Política de contraseña.** La contraseña debe tener al menos 8 caracteres, al menos
una letra y al menos un número. No se permiten solo espacios. Si no cumple, responde `400`.

**RN-03 — Hash de contraseña.** Las contraseñas se almacenan con `scrypt` y salt aleatorio
de 16 bytes. Nunca se guarda ni se devuelve la contraseña en texto plano. La comparación usa
tiempo constante.

**RN-04 — Sesión JWT de 7 días.** Un login exitoso devuelve un JWT firmado con `HS256`,
válido exactamente 7 días, con `sub` (id de usuario) y `role`. El token no se guarda en la
base.

**RN-05 — Autorización.** Los endpoints marcados como protegidos requieren
`Authorization: Bearer <token>` válido. Los endpoints `/api/admin/*` requieren además rol
`admin`. Un cliente que intenta usarlos recibe `403`.

**RN-06 — Límite de intentos de login.** Se permiten como máximo 10 intentos de login por IP
en una ventana de 15 minutos. El intento 11 responde `429` con el tiempo de espera. La
ventana es móvil y se reinicia al expirar.

**RN-07 — Cliente bloqueado.** Un cliente con `blockedUntil` futuro no puede crear ni
reprogramar turnos (`403`). Sí puede iniciar sesión y cancelar turnos existentes. El bloqueo
expira solo por paso del tiempo; un administrador puede levantarlo antes.

**RN-08 — Aislamiento de datos.** Un cliente solo puede ver y operar sus propios turnos.
Pedir el turno de otra persona responde `404` (no se filtra su existencia). El administrador
puede ver y operar todos.

### 4.2 Catálogo

**RN-09 — Validación de servicios.** La duración debe ser múltiplo de 15 minutos, entre 15 y
120. El precio debe ser un entero mayor o igual a 0. El nombre es único (sin distinguir
mayúsculas). Datos inválidos responden `400`; nombre duplicado, `409`.

**RN-10 — Solo entidades activas.** Solo se pueden reservar servicios y profesionales
activos. Desactivar una entidad no borra turnos históricos.

**RN-11 — Profesional habilitado.** El profesional elegido debe estar asociado al servicio
elegido. Si no lo está, responde `422`.

**RN-12 — Precio congelado.** El turno guarda el precio del servicio al momento de la
reserva. Cambios posteriores de precio no modifican turnos existentes.

### 4.3 Disponibilidad

**RN-13 — Horario semanal.** La disponibilidad surge de franjas semanales por profesional
(`weekday` 0=domingo … 6=sábado, minutos desde las 00:00 locales). Los turnos solo pueden
comenzar y terminar dentro de una franja del día local correspondiente.

**RN-14 — Grilla de 15 minutos.** El inicio del turno debe caer en un múltiplo de 15 minutos
en hora local y tener segundos y milisegundos en cero. Si no, responde `422`.

**RN-15 — Turno completo dentro de la franja.** El turno debe empezar y terminar dentro de
la misma franja de disponibilidad. No puede cruzar el mediodía si hay una pausa, ni pasar al
día siguiente.

**RN-16 — Sin superposición por profesional.** No puede haber dos turnos activos
(`confirmed`) del mismo profesional cuyos intervalos `[inicio, fin)` se superpongan. Los
turnos cancelados liberan el horario.

**RN-17 — Sin superposición por cliente.** Un cliente no puede tener dos turnos activos que
se superpongan, aunque sean con profesionales distintos.

**RN-18 — Anticipación mínima.** Un turno debe reservarse con al menos 2 horas de
anticipación y no puede empezar en el pasado.

**RN-19 — Anticipación máxima.** Un turno puede reservarse como máximo 60 días corridos
después del día local actual.

**RN-20 — Bloqueos de agenda.** Un bloqueo (`time_off`) impide reservar cualquier turno que
se superponga con el intervalo bloqueado, aunque la franja semanal esté disponible.

**RN-21 — Días sin disponibilidad.** Si el profesional no tiene una franja para ese día
local, no se ofrecen horarios y una reserva responde `422`. La ausencia de franjas no es un
error del sistema.

### 4.4 Ciclo de vida del turno

**RN-22 — Creación y cupo.** Un turno nuevo nace en estado `confirmed`. Un cliente puede
tener como máximo 3 turnos `confirmed` futuros. El cuarto responde `422`.

**RN-23 — Cancelación por el cliente.** El cliente puede cancelar hasta 2 horas antes del
inicio. La cancelación guarda fecha, actor y motivo opcional, y pasa el turno a `cancelled`.

**RN-24 — Cancelación fuera de plazo.** Si faltan menos de 2 horas (o el turno ya comenzó),
el cliente no puede cancelar: responde `422` y el turno sigue `confirmed`.

**RN-25 — Cancelación administrativa.** El administrador puede cancelar en cualquier
momento, incluso después del inicio. Debe indicar un motivo de al menos 5 caracteres. El
turno pasa a `cancelled` y registra al actor.

**RN-26 — Liberación de horario.** Al cancelar, el intervalo deja de bloquear la agenda y
vuelve a ofrecerse si sigue cumpliendo las demás reglas.

**RN-27 — Reprogramación.** Reprogramar cambia únicamente `startsAt`/`endsAt` y vuelve a
validar todas las reglas de disponibilidad (RN-13 a RN-21) y de cupo. Conserva `id`, servicio,
profesional y precio.

**RN-28 — Límite de reprogramaciones.** Un turno puede reprogramarse como máximo 2 veces.
El tercer intento responde `422`. Solo se pueden reprogramar turnos `confirmed` y con al
menos 2 horas de anticipación.

**RN-29 — Turno atendido.** Solo un administrador puede marcar `completed`, y solo desde el
inicio del turno en adelante. Un turno cancelado no puede marcarse atendido.

**RN-30 — Ausencia.** Solo un administrador puede marcar `no_show`, y solo desde 15 minutos
después del inicio. Un turno cancelado o atendido no puede marcarse como ausencia.

**RN-31 — Penalización por ausencias.** Al registrar una ausencia se cuentan las ausencias
del cliente en los últimos 180 días. Si llega a 3, el cliente queda bloqueado 30 días
(`blockedUntil = ahora + 30 días`). El bloqueo se aplica con RN-07.

**RN-32 — Estados terminales.** `cancelled`, `completed` y `no_show` son terminales. Ninguna
operación puede sacar un turno de esos estados; los intentos responden `409`.

**RN-33 — Datos derivados en el servidor.** El cliente no puede enviar `endsAt`, `status` ni
`priceCents`: si lo hace, se ignoran. El servidor calcula `endsAt = startsAt + duración` y
toma el precio del servicio.

**RN-34 — UTC en tránsito, Buenos Aires en pantalla.** La API devuelve y acepta ISO UTC. La
UI y la generación de franjas usan `America/Argentina/Buenos_Aires`. Un turno de las 10:00
locales se guarda como las 13:00Z (o 13:00Z/14:00Z según el offset vigente).

## 5. Modelo de datos

```
users (id, email, password_hash, full_name, phone, role, blocked_until, created_at)
services (id, name, description, duration_min, price_cents, active, created_at)
professionals (id, name, bio, active, created_at)
professional_services (professional_id, service_id)
availability_rules (id, professional_id, weekday, start_minute, end_minute)
time_off (id, professional_id, starts_at, ends_at, reason, created_by, created_at)
appointments (id, client_id, professional_id, service_id, starts_at, ends_at,
              status, price_cents, reschedule_count, notes,
              cancelled_at, cancelled_by, cancellation_reason, created_at, updated_at)
appointment_events (id, appointment_id, type, actor_id, metadata, created_at)
```

Restricciones destacadas:

- `users.email` único; `services.name` único con índice `lower(name)`.
- `duration_min` múltiplo de 15 y entre 15 y 120; `price_cents >= 0`.
- `availability_rules.end_minute > start_minute`.
- `appointments.ends_at > starts_at`; `status` en la lista permitida.
- Índices por profesional/inicio, cliente/inicio, estado y fecha.

La no superposición se valida dentro de una transacción que bloquea la fila del profesional
(y del cliente) antes de consultar e insertar. Esto evita condiciones de carrera. No se usa
una constraint de exclusión para mantener compatibilidad con PGlite en los tests.

## 6. API REST

Base: `/api`. Formato JSON. Errores:

```json
{ "error": { "code": "RULE_VIOLATION", "message": "Texto para el usuario", "details": {} } }
```

### 6.1 Autenticación

| Método | Ruta | Auth | Descripción |
| --- | --- | --- | --- |
| POST | `/auth/register` | — | `{fullName,email,password,phone?}` → `201 {token,user}` |
| POST | `/auth/login` | — | `{email,password}` → `200 {token,user}` |
| GET | `/auth/me` | Bearer | Devuelve el usuario de la sesión. |

`user` = `{id,email,fullName,phone,role,blockedUntil}`.

### 6.2 Catálogo y disponibilidad

| Método | Ruta | Auth | Descripción |
| --- | --- | --- | --- |
| GET | `/services` | — | Servicios activos. |
| GET | `/professionals?serviceId=` | — | Profesionales activos; si hay `serviceId`, solo los habilitados. |
| GET | `/availability?professionalId=&serviceId=&date=YYYY-MM-DD` | — | `{date,timezone,slots:[{startsAt,label}]}`. |

### 6.3 Turnos del cliente

| Método | Ruta | Auth | Descripción |
| --- | --- | --- | --- |
| POST | `/appointments` | Bearer | `{serviceId,professionalId,startsAt,notes?}` → `201`. |
| GET | `/appointments/mine?scope=upcoming\|past\|all` | Bearer | Turnos propios con servicio y profesional. |
| GET | `/appointments/:id` | Bearer | Detalle propio (o cualquiera si admin). |
| PATCH | `/appointments/:id/cancel` | Bearer | `{reason?}`. |
| PATCH | `/appointments/:id/reschedule` | Bearer | `{startsAt}`. |

### 6.4 Administración

| Método | Ruta | Auth | Descripción |
| --- | --- | --- | --- |
| GET | `/admin/metrics?date=YYYY-MM-DD` | admin | Totales del día y próximos 7 días. |
| GET | `/admin/appointments?date=&status=` | admin | Agenda filtrada. |
| PATCH | `/admin/appointments/:id/cancel` | admin | `{reason}` obligatorio. |
| PATCH | `/admin/appointments/:id/complete` | admin | Marca atendido. |
| PATCH | `/admin/appointments/:id/no-show` | admin | Marca ausencia y aplica RN-31. |
| GET | `/admin/clients?query=` | admin | Clientes con estado de bloqueo. |
| PATCH | `/admin/clients/:id/unblock` | admin | Levanta el bloqueo. |
| GET | `/admin/time-off?from=&to=` | admin | Bloqueos de agenda. |
| POST | `/admin/time-off` | admin | `{professionalId,startsAt,endsAt,reason}`. |
| DELETE | `/admin/time-off/:id` | admin | Elimina un bloqueo futuro. |

Códigos usados: `400` datos inválidos, `401` sin sesión/token inválido, `403` sin permiso o
cliente bloqueado, `404` no encontrado, `409` conflicto/estado terminal, `422` regla de
negocio, `429` rate limit, `500` error inesperado.

## 7. Criterios de aceptación

1. Un visitante puede registrarse, iniciar sesión y reservar un turno disponible.
2. La agenda nunca muestra ni acepta un horario superpuesto, bloqueado o fuera de horario.
3. Un cliente puede cancelar o reprogramar dentro de los plazos; fuera de plazo no.
4. La administración ve la agenda del día, atiende, marca ausencias y bloquea agenda.
5. Tres ausencias en 180 días bloquean al cliente 30 días.
6. Todas las reglas RN-01 a RN-34 tienen al menos un test automatizado que las nombra.
7. El sistema corre con PostgreSQL real y no contiene secretos en el repositorio.
