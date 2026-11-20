import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ProtectedRoute } from './ProtectedRoute';
import { adminUser, makeAuth, renderWithAuth, testUser } from '../test/render';
import type { RouteObject } from 'react-router-dom';

const routes: RouteObject[] = [
  {
    path: '/privado',
    element: <ProtectedRoute />,
    children: [{ path: '', element: <div>Contenido privado</div> }],
  },
  {
    path: '/solo-admin',
    element: <ProtectedRoute adminOnly />,
    children: [{ path: '', element: <div>Panel admin</div> }],
  },
  { path: '/login', element: <div>Pantalla login</div> },
  { path: '/', element: <div>Inicio público</div> },
];

describe('T09 · rutas protegidas', () => {
  it('redirige al login si no hay sesión', () => {
    renderWithAuth(null, { route: '/privado', auth: makeAuth(), routes });
    expect(screen.getByText('Pantalla login')).toBeInTheDocument();
  });

  it('muestra el contenido con sesión de cliente', () => {
    renderWithAuth(null, { route: '/privado', auth: makeAuth({ user: testUser }), routes });
    expect(screen.getByText('Contenido privado')).toBeInTheDocument();
  });

  it('impide que un cliente entre al panel admin', () => {
    renderWithAuth(null, {
      route: '/solo-admin',
      auth: makeAuth({ user: testUser }),
      routes,
    });
    expect(screen.getByText('Inicio público')).toBeInTheDocument();
  });

  it('permite el panel a un administrador', () => {
    renderWithAuth(null, {
      route: '/solo-admin',
      auth: makeAuth({ user: adminUser }),
      routes,
    });
    expect(screen.getByText('Panel admin')).toBeInTheDocument();
  });

  it('espera mientras carga la sesión', () => {
    renderWithAuth(null, {
      route: '/privado',
      auth: makeAuth({ loading: true }),
      routes,
    });
    expect(screen.getByRole('status')).toHaveTextContent('Cargando tu sesión');
  });
});
