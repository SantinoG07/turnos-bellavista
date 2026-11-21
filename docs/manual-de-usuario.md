# Manual de usuario

## 1. Cliente

### Crear una cuenta

1. Abrí la aplicación y elegí **Crear cuenta**.
2. Completá nombre, email, teléfono (opcional) y contraseña. La contraseña necesita al menos
   8 caracteres, una letra y un número.
3. Al confirmar, la sesión queda iniciada y te lleva a **Mis turnos**.

Si ya tenés cuenta, usá **Ingresar**. La sesión dura 7 días; podés cerrarla con **Salir**.

### Reservar un turno

1. Entrá en **Reservar**.
2. Elegí un servicio. Vas a ver duración y precio final.
3. Elegí un barbero. Solo aparecen los que ofrecen ese servicio.
4. Seleccioná la fecha y un horario disponible. La grilla muestra huecos reales: si un horario no
   aparece, ya está tomado, bloqueado o no cumple la anticipación mínima.
5. Si querés, agregá una nota para el barbero (por ejemplo, “máquina 2 a los costados”).
6. Revisá el resumen y presioná **Confirmar turno**.

La pantalla de confirmación es tu comprobante. El precio y la duración los confirma el servidor.

### Consultar, cancelar y reprogramar

En **Mis turnos**:

- **Próximos:** turnos confirmados que todavía no ocurrieron.
- **Historial:** turnos pasados, cancelados o con ausencia.
- **Todos:** el listado completo.

Podés **cancelar** indicando un motivo o **reprogramar** a otro horario del mismo barbero hasta
**2 horas antes** del turno. Cada turno admite como máximo **2 reprogramaciones**. Si faltan menos
de 2 horas, la aplicación te pide llamar a la barbería.

Si acumulás **3 ausencias en 180 días**, la cuenta queda bloqueada para reservar durante
**30 días**. Podés seguir viendo tus turnos; la administración puede desbloquear la cuenta.

## 2. Administración

Ingresá con una cuenta administradora y abrí **Admin**.

### Agenda y métricas

- Elegí una fecha y, si hace falta, un estado (confirmados, cancelados, atendidos o ausentes).
- Cada fila muestra hora, servicio, cliente, profesional, precio y nota.
- Las métricas resumen turnos del día, confirmados, atendidos, ausentes, cancelados y próximos
  7 días.

### Acciones sobre un turno

- **Atender:** disponible desde la hora de inicio; marca el turno como completado.
- **Ausencia:** disponible 15 minutos después del inicio; cuenta para la penalización del cliente.
- **Cancelar:** exige un motivo de al menos 5 caracteres y libera el horario.

### Clientes

Buscá por nombre o email. La lista muestra ausencias en los últimos 180 días y turnos futuros.
Si un cliente está bloqueado, usá **Desbloquear** para permitirle reservar de nuevo.

### Bloqueos de agenda

En **Bloqueos de agenda** elegí profesional, fecha/hora de inicio y fin, y un motivo. El bloqueo
quita esos horarios de la disponibilidad. No se puede crear sobre turnos confirmados: primero hay
que cancelarlos. Podés quitar un bloqueo con **Quitar**.

## 3. Preguntas frecuentes

**¿Por qué no veo horarios?** El barbero puede no atender ese día, tener una pausa, un bloqueo, o
los horarios ya están tomados. Probá otra fecha o profesional.

**¿Puedo reservar para otra persona?** No en esta versión: cada cuenta reserva para sí misma.

**¿Qué pasa si llego tarde?** La administración puede marcar ausencia desde los 15 minutos. Si se
repite tres veces en 180 días, la cuenta se bloquea 30 días.

**¿Se puede pagar online?** No. El precio se muestra como referencia y se paga en el local.

**Olvidé mi contraseña.** Esta versión no incluye recuperación automática; contactá a la
administración del local.

## 4. Cuentas demo

En una instalación local con `npm run seed`:

- Cliente: `cliente@bellavista.test` / `Cliente1234`
- Admin: `admin@bellavista.test` / `Admin1234`

No uses estas credenciales en producción. Cambialas o no ejecutes el seed en el entorno público.
