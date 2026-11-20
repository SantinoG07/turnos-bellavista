import { screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi, afterEach } from 'vitest';
import { HomePage } from './HomePage';
import { api } from '../lib/api';
import { makeAuth, renderWithAuth, testUser } from '../test/render';

const services = [
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

describe('T09 · página de inicio', () => {
  afterEach(() => vi.restoreAllMocks());

  it('muestra los servicios que devuelve la API', async () => {
    vi.spyOn(api.catalog, 'services').mockResolvedValue({ services });
    renderWithAuth(<HomePage />);
    expect(await screen.findByText('Corte clásico')).toBeInTheDocument();
    expect(screen.getByText('Coloración')).toBeInTheDocument();
    expect(screen.getByText('1 h 30 min')).toBeInTheDocument();
  });

  it('invita a reservar a un visitante', async () => {
    vi.spyOn(api.catalog, 'services').mockResolvedValue({ services: [] });
    renderWithAuth(<HomePage />);
    expect(screen.getByRole('link', { name: 'Reservar turno' })).toHaveAttribute(
      'href',
      '/reservar',
    );
    expect(screen.getByRole('link', { name: 'Ya tengo cuenta' })).toBeInTheDocument();
  });

  it('muestra mis turnos a un usuario logueado', async () => {
    vi.spyOn(api.catalog, 'services').mockResolvedValue({ services: [] });
    renderWithAuth(<HomePage />, { auth: makeAuth({ user: testUser }) });
    expect(screen.getByRole('link', { name: 'Ver mis turnos' })).toHaveAttribute(
      'href',
      '/mis-turnos',
    );
  });

  it('avisa si falla la carga de servicios', async () => {
    vi.spyOn(api.catalog, 'services').mockRejectedValue(new Error('red'));
    renderWithAuth(<HomePage />);
    await waitFor(() =>
      expect(screen.getByText(/No pudimos cargar los servicios/)).toBeInTheDocument(),
    );
  });
});
