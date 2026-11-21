import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AdminPage } from './AdminPage';
import { api, ApiError } from '../lib/api';
import { adminUser, makeAuth, renderWithAuth } from '../test/render';
import type { Appointment, Client, Metrics, Professional, Service, TimeOff } from '../types';

const now = Date.now();
const hoursFromNow = (hours: number) => new Date(now + hours * 3_600_000).toISOString();

const services: Service[] = [
  {
    id: 's1',
    name: 'Corte clásico',
    description: 'Corte con lavado.',
    durationMin: 30,
    priceCents: 1_200_000,
  },
];

const professionals: Professional[] = [
  { id: 'p1', name: 'Nico', bio: 'Clásicos', serviceIds: ['s1'] },
];

const appointment: Appointment = {
  id: 'a1',
  startsAt: hoursFromNow(-1),
  endsAt: hoursFromNow(-0.5),
  status: 'confirmed',
  priceCents: 1_200_000,
  rescheduleCount: 0,
  notes: 'Máquina 2',
  cancellationReason: null,
  cancelledAt: null,
  service: { id: 's1', name: 'Corte clásico', durationMin: 30 },
  professional: { id: 'p1', name: 'Nico' },
  client: { id: 'c1', name: 'Cliente Demo', email: 'cliente@bellavista.test', phone: null },
};

const client: Client = {
  id: 'c1',
  email: 'cliente@bellavista.test',
  fullName: 'Cliente Demo',
  phone: null,
  blockedUntil: new Date(now + 86_400_000).toISOString(),
  noShowCount: 3,
  upcomingCount: 1,
  createdAt: new Date(now - 86_400_000).toISOString(),
};

const metrics: Metrics = {
  date: '2026-11-20',
  total: 6,
  confirmed: 2,
  cancelled: 1,
  completed: 2,
  noShow: 1,
  upcoming7Days: 4,
};

const timeOff: TimeOff = {
  id: 't1',
  professionalId: 'p1',
  professionalName: 'Nico',
  startsAt: hoursFromNow(24),
  endsAt: hoursFromNow(25),
  reason: 'Trámite',
};

function mockApis() {
  vi.spyOn(api.admin, 'appointments').mockResolvedValue({ appointments: [appointment] });
  vi.spyOn(api.admin, 'metrics').mockResolvedValue({ metrics });
  vi.spyOn(api.admin, 'timeOff').mockResolvedValue({ timeOff: [timeOff] });
  vi.spyOn(api.admin, 'clients').mockResolvedValue({ clients: [client] });
  vi.spyOn(api.admin, 'complete').mockResolvedValue({ appointment });
  vi.spyOn(api.admin, 'noShow').mockResolvedValue({ appointment });
  vi.spyOn(api.admin, 'cancel').mockResolvedValue({ appointment });
  vi.spyOn(api.admin, 'unblock').mockResolvedValue({ ok: true });
  vi.spyOn(api.admin, 'createTimeOff').mockResolvedValue({ timeOff });
  vi.spyOn(api.admin, 'deleteTimeOff').mockResolvedValue(undefined);
  vi.spyOn(api.catalog, 'services').mockResolvedValue({ services });
  vi.spyOn(api.catalog, 'professionals').mockResolvedValue({ professionals });
}

describe('T12 · panel de administración', () => {
  beforeEach(() => {
    mockApis();
  });

  afterEach(() => vi.restoreAllMocks());

  it('muestra las métricas del día', async () => {
    renderWithAuth(<AdminPage />, { auth: makeAuth({ user: adminUser }) });
    const grid = await screen.findByLabelText('Métricas del día');
    expect(within(grid).getByText('Turnos').parentElement).toHaveTextContent('6');
    expect(within(grid).getByText('Próximos 7 días').parentElement).toHaveTextContent('4');
  });

  it('lista la agenda con cliente, servicio y precio', async () => {
    renderWithAuth(<AdminPage />, { auth: makeAuth({ user: adminUser }) });
    expect(await screen.findByText('Corte clásico')).toBeInTheDocument();
    expect(screen.getAllByText(/Cliente Demo/).length).toBeGreaterThan(0);
    expect(screen.getByText(/12\.000/)).toBeInTheDocument();
  });

  it('filtra por fecha y estado', async () => {
    renderWithAuth(<AdminPage />, { auth: makeAuth({ user: adminUser }) });
    await screen.findByText('Corte clásico');
    await userEvent.selectOptions(screen.getByLabelText('Estado'), 'no_show');
    await waitFor(() =>
      expect(api.admin.appointments).toHaveBeenLastCalledWith(expect.any(String), 'no_show'),
    );
  });

  it('marca un turno como atendido', async () => {
    renderWithAuth(<AdminPage />, { auth: makeAuth({ user: adminUser }) });
    await userEvent.click(await screen.findByRole('button', { name: 'Atender' }));
    await waitFor(() => expect(api.admin.complete).toHaveBeenCalledWith('a1'));
    expect(await screen.findByText('Turno marcado como atendido.')).toBeInTheDocument();
  });

  it('registra una ausencia', async () => {
    renderWithAuth(<AdminPage />, { auth: makeAuth({ user: adminUser }) });
    await userEvent.click(await screen.findByRole('button', { name: 'Ausencia' }));
    await waitFor(() => expect(api.admin.noShow).toHaveBeenCalledWith('a1'));
    expect(await screen.findByText('Ausencia registrada.')).toBeInTheDocument();
  });

  it('cancela con motivo obligatorio', async () => {
    renderWithAuth(<AdminPage />, { auth: makeAuth({ user: adminUser }) });
    await userEvent.click(await screen.findByRole('button', { name: 'Cancelar' }));
    const dialog = within(screen.getByRole('dialog'));
    const confirm = dialog.getByRole('button', { name: 'Cancelar turno' });
    expect(confirm).toBeDisabled();
    await userEvent.type(dialog.getByLabelText('Motivo'), 'El barbero se enfermó');
    await userEvent.click(confirm);
    await waitFor(() =>
      expect(api.admin.cancel).toHaveBeenCalledWith('a1', 'El barbero se enfermó'),
    );
  });

  it('desbloquea un cliente con ausencias', async () => {
    renderWithAuth(<AdminPage />, { auth: makeAuth({ user: adminUser }) });
    await userEvent.click(await screen.findByRole('button', { name: 'Desbloquear' }));
    await waitFor(() => expect(api.admin.unblock).toHaveBeenCalledWith('c1'));
    expect(await screen.findByText('Cliente desbloqueado.')).toBeInTheDocument();
  });

  it('busca clientes por texto', async () => {
    renderWithAuth(<AdminPage />, { auth: makeAuth({ user: adminUser }) });
    await screen.findByText('Cliente Demo');
    await userEvent.type(screen.getByLabelText('Buscar por nombre o email'), 'demo');
    await waitFor(() => expect(api.admin.clients).toHaveBeenLastCalledWith('demo'));
  });

  it('crea un bloqueo de agenda', async () => {
    renderWithAuth(<AdminPage />, { auth: makeAuth({ user: adminUser }) });
    await screen.findByRole('option', { name: 'Nico' });
    await userEvent.selectOptions(screen.getByLabelText('Profesional'), 'p1');
    await userEvent.type(screen.getByLabelText('Desde'), '2026-12-01T10:00');
    await userEvent.type(screen.getByLabelText('Hasta'), '2026-12-01T12:00');
    await userEvent.type(screen.getByLabelText('Motivo'), 'Congreso');
    await userEvent.click(screen.getByRole('button', { name: 'Crear bloqueo' }));
    await waitFor(() =>
      expect(api.admin.createTimeOff).toHaveBeenCalledWith({
        professionalId: 'p1',
        startsAt: '2026-12-01T13:00:00.000Z',
        endsAt: '2026-12-01T15:00:00.000Z',
        reason: 'Congreso',
      }),
    );
    expect(await screen.findByText('Bloqueo de agenda creado.')).toBeInTheDocument();
  });

  it('elimina un bloqueo existente', async () => {
    renderWithAuth(<AdminPage />, { auth: makeAuth({ user: adminUser }) });
    await userEvent.click(await screen.findByRole('button', { name: 'Quitar' }));
    await waitFor(() => expect(api.admin.deleteTimeOff).toHaveBeenCalledWith('t1'));
    expect(await screen.findByText('Bloqueo eliminado.')).toBeInTheDocument();
  });

  it('muestra el error del backend al crear un bloqueo en conflicto', async () => {
    vi.mocked(api.admin.createTimeOff).mockRejectedValue(
      new ApiError(409, 'CONFLICT', 'El bloqueo se superpone con turnos confirmados.'),
    );
    renderWithAuth(<AdminPage />, { auth: makeAuth({ user: adminUser }) });
    await screen.findByRole('option', { name: 'Nico' });
    await userEvent.selectOptions(screen.getByLabelText('Profesional'), 'p1');
    await userEvent.type(screen.getByLabelText('Desde'), '2026-12-01T10:00');
    await userEvent.type(screen.getByLabelText('Hasta'), '2026-12-01T12:00');
    await userEvent.type(screen.getByLabelText('Motivo'), 'Cierre');
    await userEvent.click(screen.getByRole('button', { name: 'Crear bloqueo' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('se superpone');
  });

  it('muestra un estado vacío si la agenda no tiene turnos', async () => {
    vi.mocked(api.admin.appointments).mockResolvedValue({ appointments: [] });
    renderWithAuth(<AdminPage />, { auth: makeAuth({ user: adminUser }) });
    expect(await screen.findByText('Sin turnos')).toBeInTheDocument();
  });

  it('informa si falla la carga de la agenda', async () => {
    vi.mocked(api.admin.metrics).mockRejectedValue(new Error('red'));
    renderWithAuth(<AdminPage />, { auth: makeAuth({ user: adminUser }) });
    expect(await screen.findByRole('alert')).toHaveTextContent('No pudimos cargar la agenda');
  });
});
