import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, ApiError } from '../lib/api';
import {
  addDaysToInput,
  dateInputValue,
  formatDateLong,
  formatDuration,
  formatMoney,
  formatTime,
} from '../lib/format';
import { EmptyState, ErrorBanner, Loading } from '../components/Feedback';
import type { Appointment, Availability, Professional, Service, Slot } from '../types';

type LoadError = { message: string; details?: Record<string, string[]> };

export function BookingPage() {
  const today = dateInputValue();
  const maxDate = addDaysToInput(today, 60);

  const [services, setServices] = useState<Service[]>([]);
  const [professionals, setProfessionals] = useState<Professional[]>([]);
  const [serviceId, setServiceId] = useState('');
  const [professionalId, setProfessionalId] = useState('');
  const [date, setDate] = useState(today);
  const [availability, setAvailability] = useState<Availability | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null);
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<LoadError | null>(null);
  const [actionError, setActionError] = useState<LoadError | null>(null);
  const [loadingCatalog, setLoadingCatalog] = useState(true);
  const [loadingProfessionals, setLoadingProfessionals] = useState(false);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [created, setCreated] = useState<Appointment | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const service = useMemo(
    () => services.find((item) => item.id === serviceId) ?? null,
    [services, serviceId],
  );
  const professional = useMemo(
    () => professionals.find((item) => item.id === professionalId) ?? null,
    [professionals, professionalId],
  );

  useEffect(() => {
    api.catalog
      .services()
      .then(({ services: list }) => setServices(list))
      .catch(() => setError({ message: 'No pudimos cargar los servicios.' }))
      .finally(() => setLoadingCatalog(false));
  }, []);

  useEffect(() => {
    setProfessionalId('');
    setSelectedSlot(null);
    setAvailability(null);
    if (!serviceId) {
      setProfessionals([]);
      return;
    }
    let active = true;
    setLoadingProfessionals(true);
    api.catalog
      .professionals(serviceId)
      .then(({ professionals: list }) => {
        if (active) setProfessionals(list);
      })
      .catch(() => {
        if (active) setError({ message: 'No pudimos cargar los profesionales.' });
      })
      .finally(() => {
        if (active) setLoadingProfessionals(false);
      });
    return () => {
      active = false;
    };
  }, [serviceId]);

  useEffect(() => {
    setSelectedSlot(null);
    if (!serviceId || !professionalId) {
      setAvailability(null);
      return;
    }
    let active = true;
    setLoadingSlots(true);
    setError(null);
    api.catalog
      .availability(professionalId, serviceId, date)
      .then((result) => {
        if (active) setAvailability(result);
      })
      .catch((caught) => {
        if (!active) return;
        setAvailability(null);
        setError(
          caught instanceof ApiError
            ? { message: caught.message, details: caught.details }
            : { message: 'No pudimos cargar la disponibilidad.' },
        );
      })
      .finally(() => {
        if (active) setLoadingSlots(false);
      });
    return () => {
      active = false;
    };
  }, [professionalId, serviceId, date, refreshKey]);

  const handleConfirm = async () => {
    if (!service || !professional || !selectedSlot) return;
    setSubmitting(true);
    setError(null);
    setActionError(null);
    try {
      const { appointment } = await api.appointments.create({
        serviceId: service.id,
        professionalId: professional.id,
        startsAt: selectedSlot.startsAt,
        notes: notes.trim() || undefined,
      });
      setCreated(appointment);
    } catch (caught) {
      if (caught instanceof ApiError) {
        setActionError({ message: caught.message, details: caught.details });
      } else {
        setActionError({ message: 'No pudimos confirmar el turno.' });
      }
      setRefreshKey((value) => value + 1);
    } finally {
      setSubmitting(false);
    }
  };

  if (created) {
    return (
      <section className="section container">
        <div className="card success-card">
          <div className="success-icon" aria-hidden="true">
            ✓
          </div>
          <p className="eyebrow">Reserva confirmada</p>
          <h1>Te esperamos.</h1>
          <p className="muted">
            {created.service.name} con {created.professional.name}
          </p>
          <p>
            <strong>{formatDateLong(created.startsAt)}</strong>
            <br />
            {formatTime(created.startsAt)} hs · {formatDuration(created.service.durationMin)}
          </p>
          {created.notes && <p className="muted">Nota: {created.notes}</p>}
          <div className="hero-actions" style={{ justifyContent: 'center' }}>
            <Link className="btn btn-primary" to="/mis-turnos">
              Ver mis turnos
            </Link>
            <button className="btn btn-outline" onClick={() => window.location.reload()}>
              Reservar otro turno
            </button>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="section container">
      <div className="page-head">
        <div>
          <p className="eyebrow">Nuevo turno</p>
          <h1>Reservá en tres pasos.</h1>
          <p className="muted">
            La disponibilidad se actualiza en tiempo real. El precio y la duración los confirma
            el servidor.
          </p>
        </div>
        <Link className="btn btn-ghost btn-small" to="/mis-turnos">
          Ver mis turnos
        </Link>
      </div>

      {error && <ErrorBanner message={error.message} details={error.details} />}
      {actionError && <ErrorBanner message={actionError.message} details={actionError.details} />}

      {loadingCatalog ? (
        <Loading label="Cargando servicios…" />
      ) : (
        <div className="booking-layout">
          <div className="card booking-panel">
            <div className="booking-step">
              <div className="step-title">
                <span className="step-number">1</span>
                <h2>Elegí un servicio</h2>
              </div>
              <div className="option-grid">
                {services.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    className={`option ${serviceId === item.id ? 'selected' : ''}`}
                    aria-pressed={serviceId === item.id}
                    onClick={() => setServiceId(item.id)}
                  >
                    <strong>{item.name}</strong>
                    <small>
                      {formatDuration(item.durationMin)} · {formatMoney(item.priceCents)}
                    </small>
                  </button>
                ))}
              </div>
            </div>

            <div className="booking-step">
              <div className="step-title">
                <span className="step-number">2</span>
                <h2>Elegí tu barbero</h2>
              </div>
              {!serviceId && <p className="muted">Primero elegí un servicio.</p>}
              {serviceId && loadingProfessionals && <Loading label="Cargando barberos…" />}
              {serviceId && !loadingProfessionals && professionals.length === 0 && (
                <p className="muted">No hay barberos disponibles para este servicio.</p>
              )}
              <div className="option-grid">
                {professionals.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    className={`option ${professionalId === item.id ? 'selected' : ''}`}
                    aria-pressed={professionalId === item.id}
                    onClick={() => setProfessionalId(item.id)}
                  >
                    <strong>{item.name}</strong>
                    <small>{item.bio}</small>
                  </button>
                ))}
              </div>
            </div>

            <div className="booking-step">
              <div className="step-title">
                <span className="step-number">3</span>
                <h2>Elegí día y horario</h2>
              </div>
              <div className="date-row">
                <label className="field">
                  <span>Fecha</span>
                  <input
                    type="date"
                    value={date}
                    min={today}
                    max={maxDate}
                    onChange={(event) => setDate(event.target.value)}
                  />
                </label>
                <button
                  type="button"
                  className="btn btn-ghost btn-small"
                  onClick={() => setDate(today)}
                >
                  Hoy
                </button>
              </div>

              {!professionalId && (
                <p className="muted" style={{ marginTop: '1rem' }}>
                  Elegí un barbero para ver los horarios.
                </p>
              )}
              {professionalId && loadingSlots && <Loading label="Buscando horarios…" />}
              {professionalId && !loadingSlots && availability?.slots.length === 0 && (
                <EmptyState
                  title="No hay horarios ese día"
                  message="Probá con otra fecha. Puede que el barbero no atienda o que ya esté todo tomado."
                />
              )}
              {professionalId && !loadingSlots && availability && availability.slots.length > 0 && (
                <div className="slots" aria-label="Horarios disponibles">
                  {availability.slots.map((slot) => (
                    <button
                      key={slot.startsAt}
                      type="button"
                      className={`slot ${selectedSlot?.startsAt === slot.startsAt ? 'selected' : ''}`}
                      aria-pressed={selectedSlot?.startsAt === slot.startsAt}
                      onClick={() => setSelectedSlot(slot)}
                    >
                      {slot.label}
                    </button>
                  ))}
                </div>
              )}

              {selectedSlot && service && (
                <label className="field" style={{ marginTop: '1.2rem' }}>
                  <span>Notas para el barbero (opcional)</span>
                  <textarea
                    rows={2}
                    maxLength={500}
                    value={notes}
                    onChange={(event) => setNotes(event.target.value)}
                    placeholder="Ej.: máquina 2 a los costados"
                  />
                </label>
              )}
            </div>
          </div>

          <aside className="card summary-card" aria-label="Resumen del turno">
            <h2>Tu reserva</h2>
            <div className="summary-row">
              <span>Servicio</span>
              <strong>{service?.name ?? '—'}</strong>
            </div>
            <div className="summary-row">
              <span>Barbero</span>
              <strong>{professional?.name ?? '—'}</strong>
            </div>
            <div className="summary-row">
              <span>Fecha</span>
              <strong>{selectedSlot ? formatDateLong(selectedSlot.startsAt) : '—'}</strong>
            </div>
            <div className="summary-row">
              <span>Hora</span>
              <strong>{selectedSlot ? `${selectedSlot.label} hs` : '—'}</strong>
            </div>
            <div className="summary-row">
              <span>Duración</span>
              <strong>{service ? formatDuration(service.durationMin) : '—'}</strong>
            </div>
            <div className="summary-row summary-total">
              <span>Total</span>
              <strong>{service ? formatMoney(service.priceCents) : '—'}</strong>
            </div>
            <button
              className="btn btn-primary btn-block"
              style={{ marginTop: '1rem' }}
              disabled={!service || !professional || !selectedSlot || submitting}
              onClick={() => void handleConfirm()}
            >
              {submitting ? 'Confirmando…' : 'Confirmar turno'}
            </button>
            <p className="muted" style={{ fontSize: '0.76rem', marginTop: '0.7rem' }}>
              Podés cancelar o reprogramar hasta 2 horas antes. Si faltás 3 veces en 180 días,
              tu cuenta se bloquea 30 días.
            </p>
          </aside>
        </div>
      )}
    </section>
  );
}
