# Relevamiento — Barbería Bellavista

## Problema

La barbería recibe reservas por mensajes y llamadas. Eso obliga a responder fuera de horario,
ocasiona dobles reservas y hace difícil llevar el registro de ausencias. El sistema centraliza la
agenda y permite que el cliente gestione sus turnos.

## Actores y necesidades

| Actor | Necesidad |
| --- | --- |
| Cliente | Ver disponibilidad real, reservar, cancelar y reprogramar sin llamar. |
| Administración | Consultar la agenda, atender o marcar ausencia, cancelar, bloquear franjas y desbloquear clientes. |
| Negocio | Evitar superposiciones, respetar horarios/pausas y aplicar una política objetiva ante ausencias. |

## Decisiones relevadas

- Atención de martes a sábado, con franjas y pausas distintas por profesional.
- La disponibilidad se muestra en hora de Buenos Aires; la API y la base guardan UTC.
- Se admite cancelar o reprogramar hasta dos horas antes y hasta dos reprogramaciones.
- Tres ausencias en 180 días bloquean nuevas reservas durante 30 días.
- La administración puede crear bloqueos excepcionales (capacitación, licencia o cierre).

La especificación formal y verificable de estas decisiones está en `docs/spec.md`.
