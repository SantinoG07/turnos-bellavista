import { fireEvent, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BookingPage } from './BookingPage';
import { api, ApiError } from '../lib/api';
import { makeAuth, renderWithAuth, testUser } from '../test/render';
import type { Appointment, Availability, Professional, Service } from '../types';

const services: Service[] = [
  {
    id: 's1',
    name: 'Corte clásico',
    description: 'Corte con lavado.',
    durationMin: 30,
    priceCents: 1_200_000,
  },
  {
    id: 's2',
    name: 'Coloración',
    description: 'Color completa.',
    durationMin: 90,
    priceCents: 2_500_000,
  },
];

const professionals: Professional[] = [
  { id: 'p1', name: 'Nico', bio: 'Clásicos', serviceIds: ['s1'] },
  { id: 'p2', name: 'Carla', bio: 'Color', serviceIds: ['s1', 's2'] },
];

const availability: Availability = {
  date: '2026-11-24',
  timezone: 'America/Argentina/Buenos_Aires',
  slots: [
    { startsAt: '2026-11-24T13:00:00.000Z', label: '10:00' },
    { startsAt: '2026-11-24T13:30:00.000Z', label: '10:30' },
  ],
};

const appointment: Appointment = {
  id: 'a1',
  startsAt: '2026-11-24T13:00:00.000Z',
  endsAt: '2026-11-24T13:30:00.000Z',
  status: 'confirmed',
  priceCents: 1_200_000,
  rescheduleCount: 0,
  notes: 'Máquina 2',
  cancellationReason: null,
  cancelledAt: null,
  service: { id: 's1', name: 'Corte clásico', durationMin: 30 },
  professional: { id: 'p1', name: 'Nico' },
};

async function selectService() {
  await screen.findByRole('button', { name: /Corte clásico/ });
  await userEvent.click(screen.getByRole('button', { name: /Corte clásico/ }));
  await screen.findByRole('button', { name: /Nico/ });
}

async function selectProfessional() {
  await userEvent.click(screen.getByRole('button', { name: /Nico/ }));
  await screen.findByRole('button', { name: '10:00' });
}

describe('T10 · flujo de reserva', () => {
  beforeEach(() => {
    vi.spyOn(api.catalog, 'services').mockResolvedValue({ services });
    vi.spyOn(api.catalog, 'professionals').mockResolvedValue({ professionals });
    vi.spyOn(api.catalog, 'availability').mockResolvedValue(availability);
    vi.spyOn(api.appointments, 'create').mockResolvedValue({ appointment });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('muestra servicios con duración y precio', async () => {
    renderWithAuth(<BookingPage />, { auth: makeAuth({ user: testUser }) });
    expect(await screen.findByRole('button', { name: /Corte clásico/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Coloración/ })).toHaveTextContent('1 h 30 min');
    expect(screen.getByText(/12\.000/)).toBeInTheDocument();
  });

  it('carga profesionales al elegir un servicio', async () => {
    renderWithAuth(<BookingPage />, { auth: makeAuth({ user: testUser }) });
    await selectService();
    expect(api.catalog.professionals).toHaveBeenCalledWith('s1');
    expect(screen.getByRole('button', { name: /Carla/ })).toBeInTheDocument();
  });

  it('pide disponibilidad recién al elegir profesional', async () => {
    renderWithAuth(<BookingPage />, { auth: makeAuth({ user: testUser }) });
    await selectService();
    expect(api.catalog.availability).not.toHaveBeenCalled();
    await selectProfessional();
    expect(api.catalog.availability).toHaveBeenCalledWith(
      'p1',
      's1',
      expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
    );
  });

  it('muestra los horarios disponibles', async () => {
    renderWithAuth(<BookingPage />, { auth: makeAuth({ user: testUser }) });
    await selectService();
    await selectProfessional();
    expect(screen.getByRole('button', { name: '10:00' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '10:30' })).toBeInTheDocument();
  });

  it('arma el resumen al elegir un horario', async () => {
    renderWithAuth(<BookingPage />, { auth: makeAuth({ user: testUser }) });
    await selectService();
    await selectProfessional();
    await userEvent.click(screen.getByRole('button', { name: '10:00' }));
    expect(screen.getByText('10:00 hs')).toBeInTheDocument();
    expect(screen.getAllByText('Corte clásico').length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: 'Confirmar turno' })).toBeEnabled();
  });

  it('confirma la reserva con notas y muestra el éxito', async () => {
    renderWithAuth(<BookingPage />, { auth: makeAuth({ user: testUser }) });
    await selectService();
    await selectProfessional();
    await userEvent.click(screen.getByRole('button', { name: '10:00' }));
    await userEvent.type(screen.getByLabelText(/Notas para el barbero/), 'Máquina 2');
    await userEvent.click(screen.getByRole('button', { name: 'Confirmar turno' }));
    await waitFor(() =>
      expect(api.appointments.create).toHaveBeenCalledWith({
        serviceId: 's1',
        professionalId: 'p1',
        startsAt: '2026-11-24T13:00:00.000Z',
        notes: 'Máquina 2',
      }),
    );
    expect(await screen.findByText('Te esperamos.')).toBeInTheDocument();
    expect(screen.getByText(/Nico/)).toBeInTheDocument();
  });

  it('mantiene el botón deshabilitado sin horario', async () => {
    renderWithAuth(<BookingPage />, { auth: makeAuth({ user: testUser }) });
    expect(await screen.findByRole('button', { name: 'Confirmar turno' })).toBeDisabled();
  });

  it('avisa cuando no hay horarios', async () => {
    vi.mocked(api.catalog.availability).mockResolvedValue({ ...availability, slots: [] });
    renderWithAuth(<BookingPage />, { auth: makeAuth({ user: testUser }) });
    await selectService();
    await userEvent.click(screen.getByRole('button', { name: /Nico/ }));
    expect(await screen.findByText('No hay horarios ese día')).toBeInTheDocument();
  });

  it('maneja un horario que se ocupó al confirmar', async () => {
    vi.mocked(api.appointments.create).mockRejectedValue(
      new ApiError(422, 'RULE_VIOLATION', 'Ese horario ya no está disponible. Elegí otro.'),
    );
    renderWithAuth(<BookingPage />, { auth: makeAuth({ user: testUser }) });
    await selectService();
    await selectProfessional();
    await userEvent.click(screen.getByRole('button', { name: '10:00' }));
    const callsBefore = vi.mocked(api.catalog.availability).mock.calls.length;
    await userEvent.click(screen.getByRole('button', { name: 'Confirmar turno' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('ya no está disponible');
    await waitFor(() =>
      expect(vi.mocked(api.catalog.availability).mock.calls.length).toBeGreaterThan(callsBefore),
    );
  });

  it('vuelve a pedir disponibilidad al cambiar la fecha', async () => {
    renderWithAuth(<BookingPage />, { auth: makeAuth({ user: testUser }) });
    await selectService();
    await selectProfessional();
    const dateInput = screen.getByLabelText('Fecha');
    fireEvent.change(dateInput, { target: { value: '2026-12-01' } });
    await waitFor(() =>
      expect(api.catalog.availability).toHaveBeenLastCalledWith('p1', 's1', '2026-12-01'),
    );
  });

  it('reinicia la selección al cambiar de servicio', async () => {
    renderWithAuth(<BookingPage />, { auth: makeAuth({ user: testUser }) });
    await selectService();
    await selectProfessional();
    await userEvent.click(screen.getByRole('button', { name: /Coloración/ }));
    await waitFor(() => expect(api.catalog.professionals).toHaveBeenLastCalledWith('s2'));
    expect(screen.queryByRole('button', { name: '10:00' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Confirmar turno' })).toBeDisabled();
  });

  it('informa si falla la carga del catálogo', async () => {
    vi.mocked(api.catalog.services).mockRejectedValue(new Error('red'));
    renderWithAuth(<BookingPage />, { auth: makeAuth({ user: testUser }) });
    expect(await screen.findByRole('alert')).toHaveTextContent('No pudimos cargar los servicios');
  });
});
