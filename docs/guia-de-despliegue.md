# Guía de despliegue

La aplicación tiene tres piezas: PostgreSQL en Neon, la API Express en Render y el frontend
estático en Netlify. El repositorio ya incluye `render.yaml`, `netlify.toml` y los scripts de
migración/seed. Ningún secreto se guarda en Git: las conexiones se cargan como variables de
entorno en cada proveedor.

## 0. Requisitos

- Repositorio publicado en GitHub.
- Cuenta en [Neon](https://neon.tech), [Render](https://render.com) y [Netlify](https://netlify.com).
- Node.js 22.12 o superior para ejecutar migraciones desde una máquina local.
- Este proyecto ya tiene un proyecto Neon llamado `turnos-bellavista`
  (`little-dream-60365122`, región `aws-us-east-2`) con las migraciones aplicadas y el seed
  cargado. Se puede reutilizar o crear uno nuevo.

## 1. Base de datos (Neon)

1. Crear el proyecto o abrir el existente. Copiar la cadena **pooled** con SSL
   (`postgresql://...@...neon.tech/neondb?sslmode=require`).
2. Aplicar el esquema desde la raíz del repo:

   ```bash
   DATABASE_URL='postgresql://...' npm run migrate
   DATABASE_URL='postgresql://...' npm run seed   # opcional: datos demo
   ```

   `seed` es idempotente. Si no se quieren cuentas demo en producción, no ejecutarlo y crear el
   administrador con el flujo de alta o un script propio.
3. Verificar que existan las tablas `users`, `services`, `professionals`, `appointments`,
   `availability_rules`, `time_off` y `appointment_events`.

La API usa `pg` cuando `DATABASE_URL` empieza con `postgresql://` y PGlite en caso contrario.
En producción siempre debe estar definida.

## 2. API (Render)

1. En Render, **New → Blueprint** y conectar el repositorio. Render lee `render.yaml`:
   - Build: `npm ci && npm run build -w backend`
   - Start: `npm run start -w backend`
   - Health check: `/api/health`
2. Cargar las variables marcadas como manuales:

   | Variable | Valor |
   | --- | --- |
   | `DATABASE_URL` | URL de Neon del paso 1 |
   | `CORS_ORIGIN` | URL pública de Netlify, por ejemplo `https://turnos-bellavista.netlify.app` |
   | `JWT_SECRET` | Render lo genera; si se define a mano, usar 32+ caracteres aleatorios |
   | `NODE_ENV` | `production` |
   | `TZ` | `America/Argentina/Buenos_Aires` |

3. Desplegar y comprobar `https://<api>.onrender.com/api/health`. Debe responder `200` con
   `{ "status": "ok" }`.
4. Si se cambia el dominio de Netlify, actualizar `CORS_ORIGIN` y reiniciar el servicio. Sin esto
   el navegador bloquea las llamadas por CORS.

## 3. Frontend (Netlify)

1. **Add new site → Import an existing project** y elegir el repositorio.
2. `netlify.toml` ya define:
   - Base: raíz del repo.
   - Build: `npm ci --include=dev && npm run build -w frontend`.
   - Publish: `frontend/dist`.
   - Redirect SPA `/* → /index.html`.
3. Agregar la variable de entorno `VITE_API_URL` con la URL HTTPS de Render, sin barra final
   (ejemplo: `https://turnos-bellavista-api.onrender.com`). Vite la incorpora en el build; si se
   cambia, hay que volver a desplegar.
4. Publicar y abrir la URL. Recorrer login, reserva, mis turnos y admin.

## 4. Verificación de aceptación

- `GET /api/health` responde 200.
- Registro e inicio de sesión funcionan desde el dominio de Netlify.
- La disponibilidad muestra horarios en hora de Buenos Aires.
- Se puede reservar, cancelar con motivo y reprogramar (hasta 2 horas antes).
- El panel admin lista la agenda, marca atendido/ausente y crea/quita bloqueos.
- Recargar `/login`, `/reservar`, `/mis-turnos` y `/admin` no devuelve 404 (redirect SPA).
- La consola del navegador no muestra errores de CORS ni de red.

## 5. Operación y seguridad

- Rotar `JWT_SECRET` invalida todas las sesiones; hacerlo solo con aviso previo.
- No commitear `.env`, `.env.local`, dumps ni URLs con contraseña. El repo solo incluye
  `.env.example`.
- Las contraseñas se guardan con scrypt y salt aleatorio. El login tiene límite de 10 intentos
  cada 15 minutos por IP.
- Los turnos se guardan en UTC (`timestamptz`); la zona del negocio se aplica en servicios y UI.
- Antes de una entrega, ejecutar `npm run typecheck && npm test && npm run test:e2e && npm run build`.

## 6. Problemas frecuentes

| Síntoma | Causa probable | Solución |
| --- | --- | --- |
| `Falta la variable de entorno JWT_SECRET` | Producción sin secreto | Definir `JWT_SECRET` en Render |
| Error CORS en el navegador | `CORS_ORIGIN` no coincide con Netlify | Corregir la variable y reiniciar |
| 404 al recargar una ruta | Falta el redirect SPA | Verificar `netlify.toml` |
| `relation ... does not exist` | Migraciones no aplicadas | `DATABASE_URL=... npm run migrate` |
| El frontend llama a `localhost` | `VITE_API_URL` ausente o build viejo | Definirla y redeployar Netlify |

## 7. URLs públicas

Las URLs definitivas dependen de las cuentas del propietario. Una vez desplegado, reemplazar esta
sección y el bloque “Estado de entrega” del `README.md`:

```text
Frontend: https://<sitio>.netlify.app
API:      https://<servicio>.onrender.com
Base:     Neon · proyecto turnos-bellavista
```
