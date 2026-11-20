import { useEffect, useState } from 'react';
import { api, ApiError } from '../lib/api';
import {
  addDaysToInput,
  dateInputValue,
  formatDateLong,
  formatMoney,
  formatTime,
  statusClass,
  statusLabel,
} from '../lib/format';
import type { Appointment, Slot } from '../types';
import { ErrorBanner, Loading } from './Feedback';

interface ModalBaseProps {
  appointment: Appointment;
  onClose: () => void;
  onDone: (message: string) => void;
}

function ModalShell({
  title,
  children,
  onClose,
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
}) {
  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="modal-head">
          <h2>{title}</h2>
          <button className="btn btn-ghost btn-small" onClick={onClose} aria-label="Cerrar">
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function CancelModal({ appointment, onClose, onDone }: ModalBaseProps) {
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    setSubmitting(true);
    setError(null);
    try {
      await api.appointments.cancel(appointment.id, reason.trim() || undefined);
      onDone('Turno cancelado. El horario volvió a quedar disponible.');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'No pudimos cancelar el turno.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ModalShell title="Cancelar turno" onClose={onClose}>
      <p className="muted">
        {appointment.service.name} · {formatDateLong(appointment.startsAt)} a las{' '}
        {formatTime(appointment.startsAt)} hs.
      </p>
      {error && <ErrorBanner message={error} />}
      <label className="field">
        <span>Motivo (opcional)</span>
        <textarea
          rows={3}
          maxLength={300}
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          placeholder="Contanos por qué cancelás"
        />
      </label>
      <p className="muted" style={{ fontSize: '0.8rem' }}>
        Recordá que solo podés cancelar hasta 2 horas antes del turno.
      </p>
      <div className="modal-actions">
        <button className="btn btn-ghost" onClick={onClose} disabled={submitting}>
          Volver
        </button>
        <button className="btn btn-danger" onClick={() => void submit()} disabled={submitting}>
          {submitting ? 'Cancelando…' : 'Confirmar cancelación'}
        </button>
      </div>
    </ModalShell>
  );
}

export function RescheduleModal({ appointment, onClose, onDone }: ModalBaseProps) {
  const today = dateInputValue();
  const maxDate = addDaysToInput(today, 60);
  const [date, setDate] = useState(today);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [selected, setSelected] = useState<Slot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setSelected(null);
    setError(null);
    api.catalog
      .availability(appointment.professional.id, appointment.service.id, date)
      .then((result) => {
        if (active) setSlots(result.slots);
      })
      .catch((caught) => {
        if (active) {
          setSlots([]);
          setError(caught instanceof Error ? caught.message : 'No pudimos cargar horarios.');
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [appointment, date, refreshKey]);

  const submit = async () => {
    if (!selected) return;
    setSubmitting(true);
    setError(null);
    try {
      await api.appointments.reschedule(appointment.id, selected.startsAt);
      onDone('Turno reprogramado. Te esperamos en el nuevo horario.');
    } catch (caught) {
      if (caught instanceof ApiError) {
        setError(caught.message);
      } else {
        setError('No pudimos reprogramar el turno.');
      }
      setRefreshKey((value) => value + 1);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ModalShell title="Reprogramar turno" onClose={onClose}>
      <p className="muted">
        {appointment.service.name} con {appointment.professional.name}. Elegí un nuevo horario.
      </p>
      {appointment.rescheduleCount >= 2 && (
        <div className="alert alert-warning">
          Este turno ya alcanzó el máximo de 2 reprogramaciones.
        </div>
      )}
      {error && <ErrorBanner message={error} />}
      <label className="field">
        <span>Nueva fecha</span>
        <input
          type="date"
          value={date}
          min={today}
          max={maxDate}
          onChange={(event) => setDate(event.target.value)}
        />
      </label>
      {loading && <Loading label="Buscando horarios…" />}
      {!loading && slots.length === 0 && (
        <p className="muted">No hay horarios disponibles ese día. Probá otra fecha.</p>
      )}
      {!loading && slots.length > 0 && (
        <div className="slots" aria-label="Nuevos horarios disponibles">
          {slots.map((slot) => (
            <button
              key={slot.startsAt}
              type="button"
              className={`slot ${selected?.startsAt === slot.startsAt ? 'selected' : ''}`}
              aria-pressed={selected?.startsAt === slot.startsAt}
              onClick={() => setSelected(slot)}
            >
              {slot.label}
            </button>
          ))}
        </div>
      )}
      <div className="modal-actions">
        <button className="btn btn-ghost" onClick={onClose} disabled={submitting}>
          Volver
        </button>
        <button
          className="btn btn-primary"
          onClick={() => void submit()}
          disabled={!selected || submitting || appointment.rescheduleCount >= 2}
        >
          {submitting ? 'Guardando…' : 'Confirmar nuevo horario'}
        </button>
      </div>
    </ModalShell>
  );
}
