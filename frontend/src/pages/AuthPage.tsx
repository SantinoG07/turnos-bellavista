import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { ApiError } from '../lib/api';
import { ErrorBanner } from '../components/Feedback';

export function AuthPage({ mode }: { mode: 'login' | 'register' }) {
  const isRegister = mode === 'register';
  const { user, login, register } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const next = params.get('next') ?? '/mis-turnos';

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<ApiError | Error | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (user) navigate(next, { replace: true });
  }, [user, navigate, next]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);

    if (isRegister) {
      if (fullName.trim().length < 2) {
        setError(new Error('Ingresá tu nombre completo.'));
        return;
      }
      if (!/[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]/.test(password) || !/\d/.test(password) || password.length < 8) {
        setError(new Error('La contraseña debe tener al menos 8 caracteres, una letra y un número.'));
        return;
      }
      if (password !== confirm) {
        setError(new Error('Las contraseñas no coinciden.'));
        return;
      }
    }

    setSubmitting(true);
    try {
      if (isRegister) {
        await register({ fullName, email, password, phone: phone || undefined });
      } else {
        await login(email, password);
      }
      navigate(next, { replace: true });
    } catch (caught) {
      setError(caught instanceof Error ? caught : new Error('No pudimos completar la operación.'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="auth-page">
      <div className="auth-aside">
        <p className="eyebrow">Barbería Bellavista</p>
        <h1>{isRegister ? 'Tu próxima visita empieza acá.' : 'Bienvenido de nuevo.'}</h1>
        <p>
          Reservá en segundos, elegí tu barbero y gestioná tus turnos sin llamar por teléfono.
        </p>
        <ul className="ticks">
          <li>Disponibilidad real, sin superposiciones.</li>
          <li>Cancelá o reprogramá hasta 2 horas antes.</li>
          <li>Tu historial siempre a mano.</li>
        </ul>
      </div>

      <div className="auth-card card">
        <h2>{isRegister ? 'Crear cuenta' : 'Iniciar sesión'}</h2>
        <p className="muted">
          {isRegister ? 'Es rápido y gratis.' : 'Usá el email con el que te registraste.'}
        </p>

        {error && (
          <ErrorBanner
            message={error.message}
            details={error instanceof ApiError ? error.details : undefined}
          />
        )}

        <form onSubmit={handleSubmit} noValidate>
          {isRegister && (
            <label className="field">
              <span>Nombre completo</span>
              <input
                name="fullName"
                autoComplete="name"
                value={fullName}
                onChange={(event) => setFullName(event.target.value)}
                required
              />
            </label>
          )}

          <label className="field">
            <span>Email</span>
            <input
              name="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
          </label>

          {isRegister && (
            <label className="field">
              <span>Teléfono (opcional)</span>
              <input
                name="phone"
                autoComplete="tel"
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
              />
            </label>
          )}

          <label className="field">
            <span>Contraseña</span>
            <input
              name="password"
              type="password"
              autoComplete={isRegister ? 'new-password' : 'current-password'}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
            {isRegister && <small>Mínimo 8 caracteres, con una letra y un número.</small>}
          </label>

          {isRegister && (
            <label className="field">
              <span>Repetir contraseña</span>
              <input
                name="confirm"
                type="password"
                autoComplete="new-password"
                value={confirm}
                onChange={(event) => setConfirm(event.target.value)}
                required
              />
            </label>
          )}

          <button className="btn btn-primary btn-block" type="submit" disabled={submitting}>
            {submitting ? 'Un segundo…' : isRegister ? 'Crear cuenta' : 'Entrar'}
          </button>
        </form>

        <p className="auth-switch">
          {isRegister ? (
            <>
              ¿Ya tenés cuenta? <Link to="/login">Iniciá sesión</Link>
            </>
          ) : (
            <>
              ¿Primera vez? <Link to="/registro">Creá tu cuenta</Link>
            </>
          )}
        </p>

        {!isRegister && (
          <div className="demo-hint">
            <strong>Cuentas demo</strong>
            <span>Cliente: cliente@bellavista.test / Cliente1234</span>
            <span>Admin: admin@bellavista.test / Admin1234</span>
          </div>
        )}
      </div>
    </section>
  );
}
