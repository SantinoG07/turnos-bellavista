import { useCallback, useEffect, useMemo, useState } from 'react';
import { api, ApiError } from '../lib/api';
import {
  addDaysToInput,
  canComplete,
  canMarkNoShow,
  dateInputValue,
  formatDateLong,
  formatMoney,
  formatTime,
  statusClass,
  statusLabel,
} from '../lib/format';
import type { Appointment, Client, Metrics, Professional, Service, TimeOff } from '../types';
import { EmptyState, ErrorBanner, Loading } from '../components/Feedback';

const STATUS_OPTIONS = [
  ['', 'Todos'],
  ['confirmed', 'Confirmados'],
  ['cancelled', 'Cancelados'],
  ['completed', 'Atendidos'],
  ['no_show', 'Ausentes'],
] as const;

function toLocalDatetimeInput(iso: string): string {
  // Devuelve YYYY-MM-DDTHH:mm en la zona del negocio para datetime-local.
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Argentina/Buenos_Aires',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(new Date(iso));
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? '00';
  return `${get('year')}-${get('month')}-${get('day')}T${get('hour')}:${get('minute')}`;
}

export function AdminPage() {
  const today = dateInputValue();
  const [date, setDate] = useState(today);
  const [status, setStatus] = useState('');
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [clients, setClients] = useState<Client[]>([]);
  const [clientQuery, setClientQuery] = useState('');
  const [timeOff, setTimeOff] = useState<TimeOff[]>([]);
  const [professionals, setProfessionals] = useState<Professional[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const [cancelTarget, setCancelTarget] = useState<Appointment | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [blockProfessional, setBlockProfessional] = useState('');
  const [blockStart, setBlockStart] = useState('');
  const [blockEnd, setBlockEnd] = useState('');
  const [blockReason, setBlockReason] = useState('');

  const reload = useCallback(() => setReloadKey((value) => value + 1), []);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    Promise.all([
      api.admin.appointments(date, status || undefined),
      api.admin.metrics(date),
      api.admin.timeOff(date, addDaysToInput(date, 60)),
    ])
      .then(([agenda, metricResult, timeOffResult]) => {
        if (!active) return;
        setAppointments(agenda.appointments);
        setMetrics(metricResult.metrics);
        setTimeOff(timeOffResult.timeOff);
      })
      .catch(() => {
        if (active) setError('No pudimos cargar la agenda. Intentá de nuevo.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [date, status, reloadKey]);

  useEffect(() => {
    let active = true;
    Promise.all([api.admin.clients(clientQuery), api.catalog.services(), api.catalog.professionals()])
      .then(([clientList, serviceList, professionalList]) => {
        if (!active) return;
        setClients(clientList.clients);
        setServices(serviceList.services);
        setProfessionals(professionalList.professionals);
      })
      .catch(() => {
        if (active) setActionError('No pudimos cargar clientes y profesionales.');
      });
    return () => {
      active = false;
    };
  }, [clientQuery, reloadKey]);

  const runAction = async (action: () => Promise<unknown>, message: string) => {
    setActionError(null);
    try {
      await action();
      setNotice(message);
      reload();
    } catch (caught) {
      setActionError(caught instanceof Error ? caught.message : 'No pudimos completar la acción.');
    }
  };

  const confirmCancel = async () => {
    if (!cancelTarget) return;
    await runAction(
      () => api.admin.cancel(cancelTarget.id, cancelReason.trim()),
      'Turno cancelado.',
    );
    setCancelTarget(null);
    setCancelReason('');
  };

  const handleCreateBlock = async (event: React.FormEvent) => {
    event.preventDefault();
    setActionError(null);
    try {
      await api.admin.createTimeOff({
        professionalId: blockProfessional,
        startsAt: new Date(`${blockStart}:00-03:00`).toISOString(),
        endsAt: new Date(`${blockEnd}:00-03:00`).toISOString(),
        reason: blockReason,
      });
      setNotice('Bloqueo de agenda creado.');
      setBlockStart('');
      setBlockEnd('');
      setBlockReason('');
      reload();
    } catch (caught) {
      setActionError(caught instanceof ApiError ? caught.message : 'No pudimos crear el bloqueo.');
    }
  };

  const serviceName = useMemo(
    () => (id: string) => services.find((service) => service.id === id)?.name ?? 'Servicio',
    [services],
  );

  return (
    <section className="section container">
      <div className="page-head">
        <div>
          <p className="eyebrow">Administración</p>
          <h1>Agenda del local</h1>
          <p className="muted">Gestioná turnos, clientes y bloqueos desde un solo lugar.</p>
        </div>
        <button className="btn btn-ghost btn-small" onClick={reload}>
          Actualizar
        </button>
      </div>

      {notice && (
        <div className="alert alert-success" role="status">
          {notice}
        </div>
      )}
      {error && <ErrorBanner message={error} />}
      {actionError && <ErrorBanner message={actionError} />}

      {metrics && (
        <div className="metrics-grid" aria-label="Métricas del día">
          {[
            ['Turnos', metrics.total],
            ['Confirmados', metrics.confirmed],
            ['Atendidos', metrics.completed],
            ['Ausentes', metrics.noShow],
            ['Cancelados', metrics.cancelled],
            ['Próximos 7 días', metrics.upcoming7Days],
          ].map(([label, value]) => (
            <div className="card metric" key={label}>
              <span>{label}</span>
              <strong>{value}</strong>
            </div>
          ))}
        </div>
      )}

      <div className="filter-bar">
        <label className="field">
          <span>Fecha</span>
          <input type="date" value={date} onChange={(event) => setDate(event.target.value)} />
        </label>
        <label className="field">
          <span>Estado</span>
          <select value={status} onChange={(event) => setStatus(event.target.value)}>
            {STATUS_OPTIONS.map(([value, label]) => (
              <option key={value || 'all'} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="admin-layout">
        <div className="card admin-panel">
          <h2>Turnos · {formatDateLong(`${date}T12:00:00.000Z`)}</h2>
          {loading ? (
            <Loading label="Cargando agenda…" />
          ) : appointments.length === 0 ? (
            <EmptyState title="Sin turnos" message="No hay turnos para la fecha y el filtro elegidos." />
          ) : (
            <div className="admin-table">
              {appointments.map((appointment) => {
                const start = appointment.startsAt;
                return (
                  <div className="admin-row" key={appointment.id}>
                    <time dateTime={start}>{formatTime(start)}</time>
                    <div>
                      <h3>{appointment.service.name}</h3>
                      <p>
                        {appointment.client?.name ?? 'Cliente'} ·{' '}
                        {appointment.professional.name} · {formatMoney(appointment.priceCents)}
                      </p>
                      {appointment.notes && <p>Nota: {appointment.notes}</p>}
                    </div>
                    <div className="row-actions">
                      <span className={statusClass(appointment.status)}>
                        {statusLabel(appointment.status)}
                      </span>
                      {appointment.status === 'confirmed' && (
                        <>
                          {canComplete(start) && (
                            <button
                              className="btn btn-outline btn-small"
                              onClick={() =>
                                void runAction(
                                  () => api.admin.complete(appointment.id),
                                  'Turno marcado como atendido.',
                                )
                              }
                            >
                              Atender
                            </button>
                          )}
                          {canMarkNoShow(start) && (
                            <button
                              className="btn btn-ghost btn-small"
                              onClick={() =>
                                void runAction(
                                  () => api.admin.noShow(appointment.id),
                                  'Ausencia registrada.',
                                )
                              }
                            >
                              Ausencia
                            </button>
                          )}
                          <button
                            className="btn btn-ghost btn-small"
                            onClick={() => setCancelTarget(appointment)}
                          >
                            Cancelar
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <aside style={{ display: 'grid', gap: '1.2rem' }}>
          <div className="card admin-panel">
            <h2>Clientes</h2>
            <label className="field">
              <span>Buscar por nombre o email</span>
              <input
                type="search"
                value={clientQuery}
                onChange={(event) => setClientQuery(event.target.value)}
                placeholder="Ej.: cliente@bellavista.test"
              />
            </label>
            {clients.length === 0 ? (
              <p className="muted">No encontramos clientes.</p>
            ) : (
              <ul className="list-plain">
                {clients.map((client) => {
                  const blocked = client.blockedUntil && new Date(client.blockedUntil) > new Date();
                  return (
                    <li key={client.id}>
                      <div className="row">
                        <div>
                          <strong>{client.fullName}</strong>
                          <p className="muted" style={{ fontSize: '0.78rem', margin: 0 }}>
                            {client.email} · {client.noShowCount} ausencias
                          </p>
                        </div>
                        {blocked ? (
                          <button
                            className="btn btn-outline btn-small"
                            onClick={() =>
                              void runAction(
                                () => api.admin.unblock(client.id),
                                'Cliente desbloqueado.',
                              )
                            }
                          >
                            Desbloquear
                          </button>
                        ) : (
                          <span className="muted" style={{ fontSize: '0.76rem' }}>
                            Activo
                          </span>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          <div className="card admin-panel">
            <h2>Bloqueos de agenda</h2>
            <form onSubmit={handleCreateBlock}>
              <label className="field">
                <span>Profesional</span>
                <select
                  required
                  value={blockProfessional}
                  onChange={(event) => setBlockProfessional(event.target.value)}
                >
                  <option value="">Elegí un profesional</option>
                  {professionals.map((professional) => (
                    <option key={professional.id} value={professional.id}>
                      {professional.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span>Desde</span>
                <input
                  type="datetime-local"
                  required
                  value={blockStart}
                  onChange={(event) => setBlockStart(event.target.value)}
                />
              </label>
              <label className="field">
                <span>Hasta</span>
                <input
                  type="datetime-local"
                  required
                  value={blockEnd}
                  onChange={(event) => setBlockEnd(event.target.value)}
                />
              </label>
              <label className="field">
                <span>Motivo</span>
                <input
                  required
                  minLength={3}
                  value={blockReason}
                  onChange={(event) => setBlockReason(event.target.value)}
                />
              </label>
              <button className="btn btn-primary btn-block" type="submit">
                Crear bloqueo
              </button>
            </form>

            {timeOff.length > 0 && (
              <ul className="list-plain" style={{ marginTop: '1rem' }}>
                {timeOff.map((block) => (
                  <li key={block.id}>
                    <div className="row">
                      <div>
                        <strong>{block.professionalName}</strong>
                        <p className="muted" style={{ fontSize: '0.78rem', margin: 0 }}>
                          {toLocalDatetimeInput(block.startsAt).replace('T', ' ')} →{' '}
                          {toLocalDatetimeInput(block.endsAt).slice(11)}
                        </p>
                        <p style={{ margin: 0, fontSize: '0.78rem' }}>{block.reason}</p>
                      </div>
                      <button
                        className="btn btn-ghost btn-small"
                        onClick={() =>
                          void runAction(
                            () => api.admin.deleteTimeOff(block.id),
                            'Bloqueo eliminado.',
                          )
                        }
                      >
                        Quitar
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </aside>
      </div>

      {cancelTarget && (
        <div className="modal-backdrop" role="presentation">
          <div className="modal" role="dialog" aria-modal="true" aria-label="Cancelar turno">
            <div className="modal-head">
              <h2>Cancelar turno</h2>
              <button
                className="btn btn-ghost btn-small"
                aria-label="Cerrar"
                onClick={() => setCancelTarget(null)}
              >
                ✕
              </button>
            </div>
            <p className="muted">
              {serviceName(cancelTarget.service.id)} ·{' '}
              {cancelTarget.client?.name ?? 'Cliente'} · {formatTime(cancelTarget.startsAt)} hs
            </p>
            <label className="field">
              <span>Motivo</span>
              <textarea
                rows={3}
                required
                minLength={5}
                value={cancelReason}
                onChange={(event) => setCancelReason(event.target.value)}
              />
            </label>
            <div className="modal-actions">
              <button className="btn btn-ghost" onClick={() => setCancelTarget(null)}>
                Volver
              </button>
              <button
                className="btn btn-danger"
                disabled={cancelReason.trim().length < 5}
                onClick={() => void confirmCancel()}
              >
                Cancelar turno
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
