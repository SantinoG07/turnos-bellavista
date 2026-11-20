import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import { formatDuration, formatMoney } from '../lib/format';
import { useAuth } from '../context/AuthContext';
import type { Service } from '../types';

export function HomePage() {
  const { user } = useAuth();
  const [services, setServices] = useState<Service[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.catalog
      .services()
      .then(({ services: list }) => setServices(list))
      .catch(() => setError('No pudimos cargar los servicios. Intentá de nuevo en un rato.'));
  }, []);

  return (
    <>
      <section className="hero">
        <div className="container hero-inner">
          <div>
            <p className="eyebrow">Martes a sábado · Buenos Aires</p>
            <h1>Tu estilo, con turno y sin esperas.</h1>
            <p className="hero-lead">
              Reservá online en Barbería Bellavista. Elegí servicio, barbero y horario;
              nosotros nos ocupamos del resto.
            </p>
            <div className="hero-actions">
              <Link className="btn btn-primary" to="/reservar">
                Reservar turno
              </Link>
              {user ? (
                <Link className="btn btn-outline" to="/mis-turnos">
                  Ver mis turnos
                </Link>
              ) : (
                <Link className="btn btn-outline" to="/login">
                  Ya tengo cuenta
                </Link>
              )}
            </div>
            <dl className="hero-stats">
              <div>
                <dt>3</dt>
                <dd>barberos</dd>
              </div>
              <div>
                <dt>4</dt>
                <dd>servicios</dd>
              </div>
              <div>
                <dt>2 h</dt>
                <dd>anticipación mínima</dd>
              </div>
            </dl>
          </div>
          <div className="hero-card" aria-hidden="true">
            <div className="hero-card-top">
              <span>Próximo turno</span>
              <span className="badge badge-confirmed">Confirmado</span>
            </div>
            <h2>Corte + barba</h2>
            <p>Con Nico · 45 min</p>
            <div className="hero-slot">Sábado 10:30</div>
            <div className="hero-card-footer">
              <span>Av. Siempre Viva 1234</span>
              <strong>$ 18.000</strong>
            </div>
          </div>
        </div>
      </section>

      <section className="section" id="servicios">
        <div className="container">
          <div className="section-head">
            <div>
              <p className="eyebrow">Servicios</p>
              <h2>Elegí cómo querés salir.</h2>
            </div>
            <p className="muted">Precios finales. La duración la calcula el sistema al reservar.</p>
          </div>

          {error && <div className="alert alert-error">{error}</div>}

          <div className="service-grid">
            {services.map((service) => (
              <article className="card service-card" key={service.id}>
                <div className="service-card-head">
                  <h3>{service.name}</h3>
                  <strong>{formatMoney(service.priceCents)}</strong>
                </div>
                <p>{service.description}</p>
                <div className="service-card-foot">
                  <span>{formatDuration(service.durationMin)}</span>
                  <Link className="link-arrow" to="/reservar">
                    Reservar →
                  </Link>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="section section-alt">
        <div className="container split">
          <div>
            <p className="eyebrow">Cómo funciona</p>
            <h2>Reservar es simple.</h2>
            <p className="muted">
              La agenda se actualiza en tiempo real. Si un horario no aparece, es porque ya está
              tomado, bloqueado o no cumple las reglas de anticipación.
            </p>
          </div>
          <ol className="steps">
            <li>
              <span>01</span>
              <div>
                <strong>Elegí servicio y barbero</strong>
                <p>Cada profesional tiene sus especialidades.</p>
              </div>
            </li>
            <li>
              <span>02</span>
              <div>
                <strong>Seleccioná día y horario</strong>
                <p>Disponibilidad real, con pausas y bloqueos incluidos.</p>
              </div>
            </li>
            <li>
              <span>03</span>
              <div>
                <strong>Confirmá y listo</strong>
                <p>Podés cancelar o reprogramar hasta 2 horas antes.</p>
              </div>
            </li>
          </ol>
        </div>
      </section>
    </>
  );
}
