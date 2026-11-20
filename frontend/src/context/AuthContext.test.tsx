import { act, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthProvider, useAuth } from './AuthContext';
import { api, clearToken, setToken } from '../lib/api';
import { testUser } from '../test/render';

function Probe() {
  const { user, loading, login, register, logout, refresh } = useAuth();
  return (
    <div>
      <span>{loading ? 'cargando' : user?.email ?? 'anonimo'}</span>
      <button onClick={() => void login('cliente@bellavista.test', 'Cliente1234')}>login</button>
      <button
        onClick={() =>
          void register({
            fullName: 'Nuevo',
            email: 'nuevo@test.com',
            password: 'Cliente1234',
          })
        }
      >
        register
      </button>
      <button onClick={logout}>logout</button>
      <button onClick={() => void refresh()}>refresh</button>
    </div>
  );
}

describe('T09 · contexto de autenticación', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('arranca sin sesión si no hay token', async () => {
    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    );
    await waitFor(() => expect(screen.getByText('anonimo')).toBeInTheDocument());
  });

  it('usa el usuario inicial sin llamar a la API', async () => {
    const me = vi.spyOn(api.auth, 'me');
    render(
      <AuthProvider initialUser={testUser}>
        <Probe />
      </AuthProvider>,
    );
    expect(screen.getByText(testUser.email)).toBeInTheDocument();
    expect(me).not.toHaveBeenCalled();
  });

  it('recupera la sesión guardada con /me', async () => {
    setToken('token-guardado');
    vi.spyOn(api.auth, 'me').mockResolvedValue({ user: testUser });
    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    );
    await waitFor(() => expect(screen.getByText(testUser.email)).toBeInTheDocument());
  });

  it('descarta un token vencido', async () => {
    setToken('token-vencido');
    vi.spyOn(api.auth, 'me').mockRejectedValue(new Error('401'));
    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    );
    await waitFor(() => expect(screen.getByText('anonimo')).toBeInTheDocument());
    expect(localStorage.getItem('turnos_bellavista_token')).toBeNull();
  });

  it('login guarda el token y el usuario', async () => {
    vi.spyOn(api.auth, 'login').mockResolvedValue({ token: 'nuevo-token', user: testUser });
    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    );
    await act(async () => {
      screen.getByText('login').click();
    });
    await waitFor(() => expect(screen.getByText(testUser.email)).toBeInTheDocument());
    expect(localStorage.getItem('turnos_bellavista_token')).toBe('nuevo-token');
  });

  it('register guarda la sesión', async () => {
    vi.spyOn(api.auth, 'register').mockResolvedValue({ token: 'registro-token', user: testUser });
    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    );
    await act(async () => {
      screen.getByText('register').click();
    });
    await waitFor(() => expect(screen.getByText(testUser.email)).toBeInTheDocument());
    expect(localStorage.getItem('turnos_bellavista_token')).toBe('registro-token');
  });

  it('logout limpia el token y el usuario', async () => {
    setToken('algo');
    render(
      <AuthProvider initialUser={testUser}>
        <Probe />
      </AuthProvider>,
    );
    await act(async () => {
      screen.getByText('logout').click();
    });
    await waitFor(() => expect(screen.getByText('anonimo')).toBeInTheDocument());
    expect(localStorage.getItem('turnos_bellavista_token')).toBeNull();
  });

  it('refresh vuelve a pedir el usuario', async () => {
    const updated = { ...testUser, fullName: 'Nombre Actualizado' };
    vi.spyOn(api.auth, 'me').mockResolvedValue({ user: updated });
    render(
      <AuthProvider initialUser={testUser}>
        <Probe />
      </AuthProvider>,
    );
    expect(screen.getByText(testUser.email)).toBeInTheDocument();
    await act(async () => {
      screen.getByText('refresh').click();
    });
    expect(api.auth.me).toHaveBeenCalled();
  });

  it('clearToken es idempotente', () => {
    clearToken();
    expect(localStorage.length).toBe(0);
  });
});
