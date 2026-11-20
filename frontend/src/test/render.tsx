import { render } from '@testing-library/react';
import type { ReactNode } from 'react';
import { MemoryRouter, Route, Routes, type RouteObject } from 'react-router-dom';
import { vi } from 'vitest';
import { AuthContext, type AuthContextValue } from '../context/AuthContext';
import type { User } from '../types';

export const testUser: User = {
  id: 'c0000000-0000-4000-8000-000000000022',
  email: 'cliente@bellavista.test',
  fullName: 'Cliente Demo',
  phone: null,
  role: 'client',
  blockedUntil: null,
};

export const adminUser: User = {
  ...testUser,
  id: 'c0000000-0000-4000-8000-000000000021',
  email: 'admin@bellavista.test',
  fullName: 'Admin Bellavista',
  role: 'admin',
};

export function makeAuth(overrides: Partial<AuthContextValue> = {}): AuthContextValue {
  return {
    user: null,
    loading: false,
    login: vi.fn().mockResolvedValue(testUser),
    register: vi.fn().mockResolvedValue(testUser),
    logout: vi.fn(),
    refresh: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

export function renderWithAuth(
  ui: ReactNode,
  options: {
    route?: string;
    auth?: AuthContextValue;
    routes?: RouteObject[];
  } = {},
) {
  const auth = options.auth ?? makeAuth();
  const buildRoutes = (routes: RouteObject[]): ReactNode =>
    routes.map((route) => (
      <Route key={route.path} path={route.path} element={route.element}>
        {route.children ? buildRoutes(route.children) : null}
      </Route>
    ));

  return {
    auth,
    ...render(
      <AuthContext.Provider value={auth}>
        <MemoryRouter initialEntries={[options.route ?? '/']}>
          {options.routes ? <Routes>{buildRoutes(options.routes)}</Routes> : ui}
        </MemoryRouter>
      </AuthContext.Provider>,
    ),
  };
}
