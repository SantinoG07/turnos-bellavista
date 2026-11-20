import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { AuthPage } from './AuthPage';
import { ApiError } from '../lib/api';
import { makeAuth, renderWithAuth, testUser } from '../test/render';
import type { RouteObject } from 'react-router-dom';

const routes: RouteObject[] = [
  { path: '/login', element: <AuthPage mode="login" /> },
  { path: '/registro', element: <AuthPage mode="register" /> },
  { path: '/mis-turnos', element: <div>Mis turnos OK</div> },
  { path: '/reservar', element: <div>Reservar OK</div> },
];

describe('T09 · pantalla de login y registro', () => {
  it('inicia sesión y navega a mis turnos', async () => {
    const auth = makeAuth();
    renderWithAuth(null, { route: '/login', auth, routes });
    await userEvent.type(screen.getByLabelText('Email'), 'cliente@bellavista.test');
    await userEvent.type(screen.getByLabelText(/^Contraseña/), 'Cliente1234');
    await userEvent.click(screen.getByRole('button', { name: 'Entrar' }));
    await waitFor(() => expect(screen.getByText('Mis turnos OK')).toBeInTheDocument());
    expect(auth.login).toHaveBeenCalledWith('cliente@bellavista.test', 'Cliente1234');
  });

  it('respeta el parámetro next', async () => {
    const auth = makeAuth();
    renderWithAuth(null, { route: '/login?next=%2Freservar', auth, routes });
    await userEvent.type(screen.getByLabelText('Email'), 'cliente@bellavista.test');
    await userEvent.type(screen.getByLabelText(/^Contraseña/), 'Cliente1234');
    await userEvent.click(screen.getByRole('button', { name: 'Entrar' }));
    await waitFor(() => expect(screen.getByText('Reservar OK')).toBeInTheDocument());
  });

  it('muestra el error de credenciales', async () => {
    const auth = makeAuth({
      login: vi.fn().mockRejectedValue(new ApiError(401, 'UNAUTHORIZED', 'Email o contraseña incorrectos.')),
    });
    renderWithAuth(null, { route: '/login', auth, routes });
    await userEvent.type(screen.getByLabelText('Email'), 'mal@test.com');
    await userEvent.type(screen.getByLabelText(/^Contraseña/), 'Incorrecta1');
    await userEvent.click(screen.getByRole('button', { name: 'Entrar' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('incorrectos');
  });

  it('valida una contraseña débil en el registro', async () => {
    const auth = makeAuth();
    renderWithAuth(null, { route: '/registro', auth, routes });
    await userEvent.type(screen.getByLabelText('Nombre completo'), 'Ana Pérez');
    await userEvent.type(screen.getByLabelText('Email'), 'ana@test.com');
    await userEvent.type(screen.getByLabelText(/^Contraseña/), 'sololetras');
    await userEvent.type(screen.getByLabelText(/^Repetir contraseña/), 'sololetras');
    await userEvent.click(screen.getByRole('button', { name: 'Crear cuenta' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('una letra y un número');
    expect(auth.register).not.toHaveBeenCalled();
  });

  it('valida que las contraseñas coincidan', async () => {
    const auth = makeAuth();
    renderWithAuth(null, { route: '/registro', auth, routes });
    await userEvent.type(screen.getByLabelText('Nombre completo'), 'Ana Pérez');
    await userEvent.type(screen.getByLabelText('Email'), 'ana@test.com');
    await userEvent.type(screen.getByLabelText(/^Contraseña/), 'Clave1234');
    await userEvent.type(screen.getByLabelText(/^Repetir contraseña/), 'Otra12345');
    await userEvent.click(screen.getByRole('button', { name: 'Crear cuenta' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('no coinciden');
    expect(auth.register).not.toHaveBeenCalled();
  });

  it('registra con los datos completos', async () => {
    const auth = makeAuth();
    renderWithAuth(null, { route: '/registro', auth, routes });
    await userEvent.type(screen.getByLabelText('Nombre completo'), 'Ana Pérez');
    await userEvent.type(screen.getByLabelText('Email'), 'ana@test.com');
    await userEvent.type(screen.getByLabelText('Teléfono (opcional)'), '11 5555-1234');
    await userEvent.type(screen.getByLabelText(/^Contraseña/), 'Clave1234');
    await userEvent.type(screen.getByLabelText(/^Repetir contraseña/), 'Clave1234');
    await userEvent.click(screen.getByRole('button', { name: 'Crear cuenta' }));
    await waitFor(() =>
      expect(auth.register).toHaveBeenCalledWith({
        fullName: 'Ana Pérez',
        email: 'ana@test.com',
        password: 'Clave1234',
        phone: '11 5555-1234',
      }),
    );
  });

  it('muestra las cuentas demo solo en login', () => {
    const { unmount } = renderWithAuth(null, { route: '/login', routes });
    expect(screen.getByText(/cliente@bellavista\.test/)).toBeInTheDocument();
    unmount();
    renderWithAuth(null, { route: '/registro', routes });
    expect(screen.queryByText(/Cuentas demo/)).not.toBeInTheDocument();
  });

  it('redirige si ya hay sesión', async () => {
    renderWithAuth(null, {
      route: '/login',
      auth: makeAuth({ user: testUser }),
      routes,
    });
    await waitFor(() => expect(screen.getByText('Mis turnos OK')).toBeInTheDocument());
  });

  it('ofrece el enlace para cambiar de modo', () => {
    renderWithAuth(null, { route: '/login', routes });
    expect(screen.getByRole('link', { name: 'Creá tu cuenta' })).toHaveAttribute(
      'href',
      '/registro',
    );
  });
});
