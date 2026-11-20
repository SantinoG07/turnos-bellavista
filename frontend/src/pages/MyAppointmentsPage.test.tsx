import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MyAppointmentsPage } from './MyAppointmentsPage';
import { api, ApiError } from '../lib/api';
import { makeAuth, renderWithAuth, testUser } from '../test/render';
import type { Appointment } from '../types';

const now = Date.now();
const inDays = (days: number) => new Date(now + days * 86_400_000).toISOString();

const upcoming: Appointment = {
  id: 'a1',
  startsAt: inDays(3),
  endsAt: inDays(3),
  status: 'confirmed',
  priceCents: 1_200_000,
  rescheduleCount: 0,
  notes: 'Máquina 2',
  cancellationReason: null,
  cancelledAt: null,
  service: { id: 's1', name: 'Corte clásico', durationMin: 30 },
  professional: { id: 'p1', name: 'Nico' },
};

const past: Appointment = {
  ...upcoming,
  id: 'a2',
  startsAt: inDays(-5),
  status: 'completed',
};

const soon: Appointment = {
  ...upcoming,
  id: 'a3',
  startsAt: new Date(now + 60 * 60_000).toISOString(),
};

describe('T11 · mis turnos', () => {
  beforeEach(() => {
    vi.spyOn(api.appointments, 'mine').mockResolvedValue({ appointments: [upcoming] });
    vi.spyOn(api.catalog, 'availability').mockResolvedValue({
      date: '2026-11-24',
      timezone: 'America/Argentina/Buenos_Aires',
      slots: [{ startsAt: inDays(4), label: '10:00' }],
    });
    vi.spyOn(api.appointments, 'cancel').mockResolvedValue({
      appointment: { ...upcoming, status: 'cancelled' },
    });
    vi.spyOn(api.appointments, 'reschedule').mockResolvedValue({
      appointment: { ...upcoming, rescheduleCount: 1 },
    });
  });

  afterEach(() => vi.restoreAllMocks());

  it('lista los próximos turnos con su detalle', async () => {
    renderWithAuth(<MyAppointmentsPage />, { auth: makeAuth({ user: testUser }) });
    expect(await screen.findByText('Corte clásico')).toBeInTheDocument();
    expect(screen.getByText(/con Nico/)).toBeInTheDocument();
    expect(screen.getByText(/Máquina 2/)).toBeInTheDocument();
    expect(screen.getByText('Confirmado')).toBeInTheDocument();
  });

  it('pide el scope por defecto upcoming', async () => {
    renderWithAuth(<MyAppointmentsPage />, { auth: makeAuth({ user: testUser }) });
    await waitFor(() => expect(api.appointments.mine).toHaveBeenCalledWith('upcoming'));
  });

  it('cambia de pestaña y vuelve a consultar', async () => {
    renderWithAuth(<MyAppointmentsPage />, { auth: makeAuth({ user: testUser }) });
    await screen.findByText('Corte clásico');
    vi.mocked(api.appointments.mine).mockResolvedValue({ appointments: [past] });
    await userEvent.click(screen.getByRole('tab', { name: 'Historial' }));
    await waitFor(() => expect(api.appointments.mine).toHaveBeenLastCalledWith('past'));
    expect(await screen.findByText('Atendido')).toBeInTheDocument();
  });

  it('muestra un estado vacío cuando no hay turnos', async () => {
    vi.mocked(api.appointments.mine).mockResolvedValue({ appointments: [] });
    renderWithAuth(<MyAppointmentsPage />, { auth: makeAuth({ user: testUser }) });
    expect(await screen.findByText('No tenés turnos próximos')).toBeInTheDocument();
  });

  it('RN-23: oculta acciones si faltan menos de 2 horas', async () => {
    vi.mocked(api.appointments.mine).mockResolvedValue({ appointments: [soon] });
    renderWithAuth(<MyAppointmentsPage />, { auth: makeAuth({ user: testUser }) });
    await screen.findByText('Corte clásico');
    expect(screen.queryByRole('button', { name: 'Cancelar' })).not.toBeInTheDocument();
    expect(screen.getByText(/menos de 2 horas/)).toBeInTheDocument();
  });

  it('cancela el turno con un motivo y refresca', async () => {
    renderWithAuth(<MyAppointmentsPage />, { auth: makeAuth({ user: testUser }) });
    await screen.findByText('Corte clásico');
    await userEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    const dialog = within(screen.getByRole('dialog'));
    await userEvent.type(dialog.getByLabelText(/Motivo/), 'Me surgió un viaje');
    await userEvent.click(dialog.getByRole('button', { name: 'Confirmar cancelación' }));
    await waitFor(() =>
      expect(api.appointments.cancel).toHaveBeenCalledWith('a1', 'Me surgió un viaje'),
    );
    expect(await screen.findByText(/Turno cancelado/)).toBeInTheDocument();
  });

  it('RN-26: reprograma a un nuevo horario', async () => {
    renderWithAuth(<MyAppointmentsPage />, { auth: makeAuth({ user: testUser }) });
    await screen.findByText('Corte clásico');
    await userEvent.click(screen.getByRole('button', { name: 'Reprogramar' }));
    const dialog = within(await screen.findByRole('dialog'));
    await userEvent.click(await dialog.findByRole('button', { name: '10:00' }));
    await userEvent.click(dialog.getByRole('button', { name: 'Confirmar nuevo horario' }));
    await waitFor(() => expect(api.appointments.reschedule).toHaveBeenCalledWith('a1', inDays(4)));
    expect(await screen.findByText(/Turno reprogramado/)).toBeInTheDocument();
  });

  it('RN-27: deshabilita reprogramar al llegar a 2', async () => {
    vi.mocked(api.appointments.mine).mockResolvedValue({
      appointments: [{ ...upcoming, rescheduleCount: 2 }],
    });
    renderWithAuth(<MyAppointmentsPage />, { auth: makeAuth({ user: testUser }) });
    await userEvent.click(await screen.findByRole('button', { name: 'Reprogramar' }));
    const dialog = within(await screen.findByRole('dialog'));
    expect(dialog.getByText(/máximo de 2 reprogramaciones/)).toBeInTheDocument();
    await userEvent.click(await dialog.findByRole('button', { name: '10:00' }));
    expect(dialog.getByRole('button', { name: 'Confirmar nuevo horario' })).toBeDisabled();
  });

  it('muestra el error del servidor al cancelar', async () => {
    vi.mocked(api.appointments.cancel).mockRejectedValue(
      new ApiError(422, 'RULE_VIOLATION', 'No podés cancelar con menos de 2 horas.'),
    );
    renderWithAuth(<MyAppointmentsPage />, { auth: makeAuth({ user: testUser }) });
    await screen.findByText('Corte clásico');
    await userEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    const dialog = within(screen.getByRole('dialog'));
    await userEvent.click(dialog.getByRole('button', { name: 'Confirmar cancelación' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('menos de 2 horas');
  });

  it('informa si falla la carga', async () => {
    vi.mocked(api.appointments.mine).mockRejectedValue(new Error('red'));
    renderWithAuth(<MyAppointmentsPage />, { auth: makeAuth({ user: testUser }) });
    expect(await screen.findByText(/No pudimos cargar tus turnos/)).toBeInTheDocument();
  });
});
