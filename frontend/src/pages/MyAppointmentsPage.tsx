import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import {
  canCancel,
  formatDateLong,
  formatMoney,
  formatTime,
  statusClass,
  statusLabel,
} from '../lib/format';
import type { Appointment } from '../types';
import { EmptyState, Loading } from '../components/Feedback';
import { CancelModal, RescheduleModal } from '../components/AppointmentModals';

type Scope = 'upcoming' | 'past' | 'all';
type ModalState = { type: 'cancel' | 'reschedule'; appointment: Appointment } | null;

export function MyAppointmentsPage() {
  const [scope, setScope] = useState<Scope>('upcoming');
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [modal, setModal] = useState<ModalState>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    api.appointments
      .mine(scope)
      .then(({ appointments: list }) => {
        if (active) setAppointments(list);
      })
      .catch(() => {
        if (active) setError('No pudimos cargar tus turnos. Intentá de nuevo.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [scope, reloadKey]);

  const reload = useCallback(() => setReloadKey((value) => value + 1), []);

  const handleDone = (message: string) => {
    setModal(null);
    setNotice(message);
    reload();
  };

  return (
    <section className="section container">
      <div className="page-head">
        <div>
          <p className="eyebrow">Tu agenda</p>
          <h1>Mis turnos</h1>
          <p className="muted">
            Cancelá o reprogramá hasta 2 horas antes. Los turnos pasados quedan en tu historial.
          </p>
        </div>
        <Link className="btn btn-primary" to="/reservar">
          Reservar otro turno
        </Link>
      </div>

      {notice && (
        <div className="alert alert-success" role="status">
          {notice}
        </div>
      )}
      {error && <div className="alert alert-error">{error}</div>}

      <div className="tabs" role="tablist" aria-label="Filtrar turnos">
        {(
          [
            ['upcoming', 'Próximos'],
            ['past', 'Historial'],
            ['all', 'Todos'],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            role="tab"
            aria-selected={scope === value}
            className={`tab ${scope === value ? 'active' : ''}`}
            onClick={() => setScope(value)}
          >
            {label}
          </button>
        ))}
      </div>

      {loading ? (
        <Loading label="Cargando turnos…" />
      ) : appointments.length === 0 ? (
        <EmptyState
          title={scope === 'upcoming' ? 'No tenés turnos próximos' : 'No hay turnos para mostrar'}
          message={
            scope === 'upcoming'
              ? 'Reservá tu próximo corte y aparecerá acá.'
              : 'Cuando tengas turnos en este filtro, los vas a ver acá.'
          }
          action={
            scope === 'upcoming' ? (
              <Link className="btn btn-primary" to="/reservar">
                Reservar turno
              </Link>
            ) : undefined
          }
        />
      ) : (
        <div className="appointment-list">
          {appointments.map((appointment) => {
            const start = new Date(appointment.startsAt);
            const canModify = appointment.status === 'confirmed' && canCancel(appointment.startsAt);
            return (
              <article className="card appointment-card" key={appointment.id}>
                <div className="appointment-date">
                  <strong>
                    {new Intl.DateTimeFormat('es-AR', {
                      timeZone: 'America/Argentina/Buenos_Aires',
                      day: '2-digit',
                    }).format(start)}
                  </strong>
                  <span>
                    {new Intl.DateTimeFormat('es-AR', {
                      timeZone: 'America/Argentina/Buenos_Aires',
                      month: 'short',
                    }).format(start)}
                  </span>
                </div>
                <div className="appointment-body">
                  <div className="service-card-head">
                    <h3>{appointment.service.name}</h3>
                    <span className={statusClass(appointment.status)}>
                      {statusLabel(appointment.status)}
                    </span>
                  </div>
                  <p className="appointment-meta">
                    {formatDateLong(appointment.startsAt)} · {formatTime(appointment.startsAt)} hs
                    · con {appointment.professional.name}
                  </p>
                  <p className="appointment-meta">
                    {formatMoney(appointment.priceCents)} · {appointment.service.durationMin} min
                    {appointment.rescheduleCount > 0 &&
                      ` · ${appointment.rescheduleCount} reprogramación(es)`}
                  </p>
                  {appointment.notes && (
                    <p className="appointment-meta">Nota: {appointment.notes}</p>
                  )}
                  {appointment.cancellationReason && (
                    <p className="appointment-meta">
                      Motivo: {appointment.cancellationReason}
                    </p>
                  )}
                  {appointment.status === 'confirmed' && !canModify && (
                    <p className="appointment-meta">
                      Faltan menos de 2 horas: para cambios llamá a la barbería.
                    </p>
                  )}
                </div>
                <div className="appointment-actions">
                  {canModify && (
                    <>
                      <button
                        className="btn btn-outline btn-small"
                        onClick={() => setModal({ type: 'reschedule', appointment })}
                      >
                        Reprogramar
                      </button>
                      <button
                        className="btn btn-ghost btn-small"
                        onClick={() => setModal({ type: 'cancel', appointment })}
                      >
                        Cancelar
                      </button>
                    </>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}

      {modal?.type === 'cancel' && (
        <CancelModal
          appointment={modal.appointment}
          onClose={() => setModal(null)}
          onDone={handleDone}
        />
      )}
      {modal?.type === 'reschedule' && (
        <RescheduleModal
          appointment={modal.appointment}
          onClose={() => setModal(null)}
          onDone={handleDone}
        />
      )}
    </section>
  );
}
