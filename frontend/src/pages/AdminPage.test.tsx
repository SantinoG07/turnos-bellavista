import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AdminPage } from './AdminPage';
import { api } from '../lib/api';
import { adminUser, makeAuth, renderWithAuth } from '../test/render';
import type { Appointment, Client, Professional } from '../types';

const appointment: Appointment = {
  id: 'a0000000-0000-4000-8000-000000000001',
  startsAt: '2026-11-20T14:00:00.000Z',
  endsAt: '2026-11-20T14:30:00.000Z',
  status: 'confirmed',
  priceCents: 1200000,
  rescheduleCount: 0,
  notes: 'Máquina 2',
  cancellationReason: null,
  cancelledAt: null,
  service: { id: 's0000000-0000-4000-8000-000000000001', name: 'Corte clásico', durationMin: 30 },
  professional: { id: 'p0000000-0000-4000-8000-000000000001', name: 'Nico' },
  client: { id: 'c0000000-0000-4000-8000-000000000001', name: 'Cliente Demo', email: 'cliente@test.com', phone: null },
};

const client: Client = {
  id: appointment.client!.id,
  email: appointment.client!.email,
  fullName: appointment.client!.name,
  phone: null,
  blockedUntil: '2026-12-01T00:00:00.000Z',
  noShowCount: 2,
  upcomingCount: 0,
  createdAt: '2026-01-01T00:00:00.000Z',
};

const professional: Professional = {
  id: appointment.professional.id,
  name: 'Nico',
  bio: 'Barbero',
  serviceIds: [appointment.service.id],
};

describe('T12 · panel de administración', () => {
  beforeEach(() => {
    vi.spyOn(api.admin, 'appointments').mockResolvedValue({ appointments: [appointment] });
    vi.spyOn(api.admin, 'metrics').mockResolvedValue({ metrics: { date: '2026-11-20', total: 1, confirmed: 1, completed: 0, noShow: 0, cancelled: 0, upcoming7Days: 1 } });
    vi.spyOn(api.admin, 'timeOff').mockResolvedValue({ timeOff: [] });
    vi.spyOn(api.admin, 'clients').mockResolvedValue({ clients: [client] });
    vi.spyOn(api.catalog, 'services').mockResolvedValue({ services: [{ id: appointment.service.id, name: 'Corte clásico', description: '', durationMin: 30, priceCents: 1200000 }] });
    vi.spyOn(api.catalog, 'professionals').mockResolvedValue({ professionals: [professional] });
    vi.spyOn(api.admin, 'complete').mockResolvedValue({ appointment: { ...appointment, status: 'completed' } });
    vi.spyOn(api.admin, 'noShow').mockResolvedValue({ appointment: { ...appointment, status: 'no_show' } });
    vi.spyOn(api.admin, 'cancel').mockResolvedValue({ appointment: { ...appointment, status: 'cancelled' } });
    vi.spyOn(api.admin, 'unblock').mockResolvedValue({ ok: true });
    vi.spyOn(api.admin, 'createTimeOff').mockResolvedValue({ timeOff: { id: 't1', professionalId: professional.id, professionalName: 'Nico', startsAt: '2026-11-20T14:00:00.000Z', endsAt: '2026-11-20T15:00:00.000Z', reason: 'Capacitación' } });
    vi.spyOn(api.admin, 'deleteTimeOff').mockResolvedValue(undefined);
  });

  afterEach(() => vi.restoreAllMocks());

  function renderPage() {
    return renderWithAuth(<AdminPage />, { auth: makeAuth({ user: adminUser }) });
  }

  it('muestra agenda, métricas y filtros', async () => {
    renderPage();
    expect(await screen.findByText('Corte clásico')).toBeInTheDocument();
    expect(screen.getByLabelText('Métricas del día')).toHaveTextContent('Confirmados');
    expect(api.admin.appointments).toHaveBeenCalledWith(expect.any(String), undefined);
  });

  it('filtra la agenda por estado', async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText('Corte clásico');
    await user.selectOptions(screen.getByLabelText('Estado'), 'cancelled');
    await waitFor(() => expect(api.admin.appointments).toHaveBeenLastCalledWith(expect.any(String), 'cancelled'));
  });

  it('marca un turno como atendido', async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(await screen.findByRole('button', { name: 'Atender' }));
    await waitFor(() => expect(api.admin.complete).toHaveBeenCalledWith(appointment.id));
    expect(await screen.findByText('Turno marcado como atendido.')).toBeInTheDocument();
  });

  it('cancela con un motivo obligatorio', async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(await screen.findByRole('button', { name: 'Cancelar' }));
    const dialog = screen.getByRole('dialog');
    await user.type(within(dialog).getByLabelText('Motivo'), 'El local cerrará temprano');
    await user.click(within(dialog).getByRole('button', { name: 'Cancelar turno' }));
    await waitFor(() => expect(api.admin.cancel).toHaveBeenCalledWith(appointment.id, 'El local cerrará temprano'));
  });

  it('desbloquea clientes bloqueados', async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(await screen.findByRole('button', { name: 'Desbloquear' }));
    await waitFor(() => expect(api.admin.unblock).toHaveBeenCalledWith(client.id));
  });

  it('crea un bloqueo de agenda', async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText('Bloqueos de agenda');
    await user.selectOptions(screen.getByLabelText('Profesional'), professional.id);
    await user.type(screen.getByLabelText('Desde'), '2026-11-25T10:00');
    await user.type(screen.getByLabelText('Hasta'), '2026-11-25T11:00');
    await user.type(screen.getByLabelText('Motivo'), 'Capacitación');
    await user.click(screen.getByRole('button', { name: 'Crear bloqueo' }));
    await waitFor(() => expect(api.admin.createTimeOff).toHaveBeenCalled());
  });
});
