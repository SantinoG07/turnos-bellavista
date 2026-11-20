import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Layout } from './Layout';
import { adminUser, makeAuth, renderWithAuth, testUser } from '../test/render';
import { MemoryRouter } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import { render } from '@testing-library/react';

describe('T09 · layout y navegación', () => {
  it('muestra acciones de visitante', () => {
    renderWithAuth(<Layout />);
    expect(screen.getByRole('link', { name: 'Ingresar' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Crear cuenta' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Admin' })).not.toBeInTheDocument();
  });

  it('muestra mis turnos y salir a un cliente', () => {
    renderWithAuth(<Layout />, { auth: makeAuth({ user: testUser }) });
    expect(screen.getByRole('link', { name: 'Mis turnos' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Salir' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Admin' })).not.toBeInTheDocument();
  });

  it('muestra el enlace de administración solo al admin', () => {
    renderWithAuth(<Layout />, { auth: makeAuth({ user: adminUser }) });
    expect(screen.getByRole('link', { name: 'Admin' })).toBeInTheDocument();
  });

  it('cierra sesión desde el botón salir', async () => {
    const auth = makeAuth({ user: testUser });
    render(
      <AuthContext.Provider value={auth}>
        <MemoryRouter>
          <Layout />
        </MemoryRouter>
      </AuthContext.Provider>,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Salir' }));
    expect(auth.logout).toHaveBeenCalled();
  });

  it('muestra el aviso de cuenta bloqueada', () => {
    const blocked = {
      ...testUser,
      blockedUntil: new Date(Date.now() + 86_400_000).toISOString(),
    };
    renderWithAuth(<Layout />, { auth: makeAuth({ user: blocked }) });
    expect(screen.getByRole('alert')).toHaveTextContent('bloqueada para reservar');
  });
});
