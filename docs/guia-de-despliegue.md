# Guía de despliegue

## 1. Neon

1. Crear un proyecto PostgreSQL y copiar la URL de conexión con SSL.
2. En Render definir `DATABASE_URL` con esa URL y ejecutar una vez `npm run migrate -w backend` con las mismas variables.
3. Cargar datos iniciales solo si se desean cuentas demo: `npm run seed -w backend`. Cambiar luego las credenciales demo o no exponerlas.

## 2. Render (API)

Conectar el repositorio y crear un Blueprint desde `render.yaml`, o un Web Service con los mismos comandos. Definir `DATABASE_URL`, `CORS_ORIGIN` (URL final de Netlify) y dejar que Render genere `JWT_SECRET`. Confirmar `GET /health` y guardar la URL pública.

## 3. Netlify (frontend)

Importar el repositorio; `netlify.toml` ya define base, build y el redirect SPA. Agregar la variable `VITE_API_URL` con la URL HTTPS de Render, sin barra final. Publicar y verificar que `/login`, `/reservar`, `/mis-turnos` y `/admin` se recargan sin 404.

## 4. Verificación final

- Registrar un cliente real de prueba en el frontend publicado.
- Reservar, cancelar y reprogramar un turno.
- Ingresar como admin, consultar agenda y crear/quitar un bloqueo.
- Revisar `health`, CORS y la consola del navegador.
- Cargar las URLs resultantes en el README antes de entregar.

No se incluyen URLs ni secretos de proveedores en el repositorio: el despliegue requiere acceso a las cuentas del propietario.
