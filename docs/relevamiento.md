# Relevamiento — Barbería Bellavista

## 1. Contexto

Barbería Bellavista es un local de Buenos Aires que atiende de martes a sábado con tres
profesionales. Hoy las reservas llegan por llamadas y mensajes: la administración responde
manualmente, anota en papel o en una planilla y avisa a cada barbero. El proceso funciona con poco
volumen, pero genera esperas, errores de horario y discusiones cuando un cliente falta.

## 2. Problema

- No hay una vista única de la agenda: dos personas pueden ofrecer el mismo horario.
- Fuera del horario de atención nadie confirma reservas.
- Cambios y cancelaciones dependen de que alguien lea el mensaje a tiempo.
- No existe un registro objetivo de ausencias para aplicar una política justa.
- Los bloqueos por capacitación, licencia o cierre se comunican de memoria.

## 3. Objetivos

1. Que el cliente vea disponibilidad real y reserve sin intervención humana.
2. Evitar superposiciones de profesional y de cliente, incluso con pedidos simultáneos.
3. Permitir cancelar/reprogramar con una ventana clara y un límite razonable.
4. Dar a la administración una agenda diaria, métricas y herramientas de excepción.
5. Aplicar una política automática y visible ante ausencias reiteradas.

## 4. Alcance

### Incluido

- Registro e inicio de sesión de clientes; cuenta administradora.
- Catálogo de servicios con duración y precio final.
- Disponibilidad semanal por profesional, grilla de 15 minutos, pausas y bloqueos.
- Reserva, consulta, cancelación y reprogramación de turnos.
- Ciclo de vida: confirmado, cancelado, atendido y ausente.
- Penalización: 3 ausencias en 180 días → 30 días sin poder reservar.
- Panel admin: agenda por fecha/estado, métricas, clientes, desbloqueo y bloqueos.
- API REST, base PostgreSQL, tests automatizados y documentación.

### Fuera de alcance (versión entregada)

- Cobros online, seña o facturación.
- Notificaciones por email/SMS/WhatsApp.
- Multi-sucursal y multi-tenant.
- Gestión de stock o comisiones.
- App móvil nativa.

Estas exclusiones no bloquean el objetivo: el turno se reserva y se gestiona completo en la web.

## 5. Actores y necesidades

| Actor | Necesidad | Respuesta del sistema |
| --- | --- | --- |
| Cliente | Reservar rápido y sin llamar | Flujo de tres pasos con disponibilidad real |
| Cliente | Cambiar de planes | Cancelar o reprogramar hasta 2 horas antes |
| Cliente | Entender sus límites | Aviso de bloqueo y contador de reprogramaciones |
| Administración | Ver el día de un vistazo | Agenda filtrable y métricas |
| Administración | Resolver excepciones | Cancelar con motivo, bloquear franjas, desbloquear clientes |
| Negocio | Evitar pérdidas | Sin dobles reservas y política de ausencias |

## 6. Reglas relevadas

- Atención de martes a sábado, con franjas y pausas distintas por profesional.
- Turnos en grilla de 15 minutos; la duración la define el servicio.
- Reserva entre 2 horas y 60 días de anticipación, con un máximo de 3 turnos futuros.
- Un cliente no puede tener dos turnos superpuestos; un profesional tampoco.
- Cancelación y reprogramación hasta 2 horas antes; máximo 2 reprogramaciones por turno.
- Tres ausencias en 180 días bloquean nuevas reservas durante 30 días.
- La administración puede crear bloqueos excepcionales y quitar bloqueos de clientes.
- Todas las fechas se muestran en hora de Buenos Aires; se guardan en UTC.

La especificación formal, numerada y verificable está en `docs/spec.md` (RN-01 a RN-34).

## 7. Supuestos y decisiones

- El pago se realiza en el local; el sistema solo informa el precio del servicio.
- El cliente reserva para sí mismo (no hay reservas para terceros).
- La cuenta administradora se crea por seed o por el propietario, no por autorregistro.
- No se elimina historial: cancelar cambia el estado y conserva el registro.
- El servidor es la única fuente de verdad; la UI no calcula disponibilidad definitiva.

## 8. Criterios de aceptación

1. Un cliente nuevo puede registrarse, reservar y ver su turno.
2. Dos pedidos simultáneos por el mismo horario dejan un solo turno confirmado.
3. Cancelar fuera de la ventana devuelve un error explicativo y no cambia el estado.
4. Tres ausencias bloquean nuevas reservas y la administración puede desbloquear.
5. La agenda admin refleja fecha, estado, cliente, servicio y profesional.
6. Un bloqueo de agenda quita los slots correspondientes de la disponibilidad.
7. Todos los tests, el typecheck y el build pasan; la documentación permite desplegar.
