import { Link } from 'react-router-dom';

export function NotFoundPage() {
  return (
    <section className="section container narrow center">
      <p className="eyebrow">404</p>
      <h1>Esa página no existe.</h1>
      <p className="muted">Puede que el enlace esté viejo o que hayas escrito mal la dirección.</p>
      <Link className="btn btn-primary" to="/">
        Volver al inicio
      </Link>
    </section>
  );
}
