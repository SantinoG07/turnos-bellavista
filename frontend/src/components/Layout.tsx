import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { initials } from '../lib/format';

export function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  return (
    <div className="app-shell">
      <header className="site-header">
        <div className="container header-inner">
          <Link to="/" className="brand" aria-label="Turnos Bellavista, inicio">
            <span className="brand-mark">B</span>
            <span>
              <strong>Bellavista</strong>
              <small>Barbería · Buenos Aires</small>
            </span>
          </Link>

          <nav className="main-nav" aria-label="Navegación principal">
            <NavLink to="/" end>
              Inicio
            </NavLink>
            <NavLink to="/reservar">Reservar</NavLink>
            {user && <NavLink to="/mis-turnos">Mis turnos</NavLink>}
            {user?.role === 'admin' && <NavLink to="/admin">Admin</NavLink>}
          </nav>

          <div className="header-actions">
            {user ? (
              <>
                <span className="user-chip" title={user.email}>
                  <span className="avatar">{initials(user.fullName)}</span>
                  <span className="user-name">{user.fullName.split(' ')[0]}</span>
                </span>
                <button className="btn btn-ghost btn-small" onClick={handleLogout}>
                  Salir
                </button>
              </>
            ) : (
              <>
                <Link className="btn btn-ghost btn-small" to="/login">
                  Ingresar
                </Link>
                <Link className="btn btn-primary btn-small" to="/registro">
                  Crear cuenta
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      {user?.blockedUntil && new Date(user.blockedUntil) > new Date() && (
        <div className="alert alert-warning container" role="alert">
          Tu cuenta está bloqueada para reservar hasta{' '}
          {new Date(user.blockedUntil).toLocaleDateString('es-AR')} por ausencias reiteradas.
          Podés cancelar turnos existentes o contactar a la barbería.
        </div>
      )}

      <main>
        <Outlet />
      </main>

      <footer className="site-footer">
        <div className="container footer-inner">
          <div>
            <strong>Barbería Bellavista</strong>
            <p>Av. Siempre Viva 1234, Buenos Aires · Martes a sábado</p>
          </div>
          <p className="footer-note">
            Proyecto Generación T · <Link to="/reservar">Reservá online</Link>
          </p>
        </div>
      </footer>
    </div>
  );
}
