import { expect, test } from '@playwright/test';

const suffix = () => `${Date.now()}${Math.floor(Math.random() * 10_000)}`;

async function registerAndBook(page: import('@playwright/test').Page) {
  const email = `e2e-${suffix()}@bellavista.test`;
  await page.goto('/registro');
  await page.getByLabel('Nombre completo').fill('Cliente E2E');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Contraseña').fill('Cliente1234');
  await page.getByLabel('Repetir contraseña').fill('Cliente1234');
  await page.getByRole('button', { name: 'Crear cuenta' }).click();
  await expect(page).toHaveURL(/mis-turnos/);
  await expect(page.getByRole('heading', { name: 'Mis turnos' })).toBeVisible();
  await page.getByRole('link', { name: 'Reservar turno' }).click();
  await page.getByRole('button', { name: /Corte clásico/ }).click();
  await page.getByRole('button', { name: 'Nico' }).click();
  await expect(page.getByLabel('Horarios disponibles')).toBeVisible();
  await page.getByLabel('Horarios disponibles').getByRole('button').first().click();
  await page.getByLabel('Notas para el barbero (opcional)').fill('Prueba e2e');
  await page.getByRole('button', { name: 'Confirmar turno' }).click();
  await expect(page.getByText('Reserva confirmada')).toBeVisible();
  await expect(page.getByText('Te esperamos.')).toBeVisible();
  return email;
}

test('registro, reserva y cancelación desde el navegador', async ({ page }) => {
  await registerAndBook(page);
  await expect(page.getByText('Corte clásico')).toBeVisible();
  await expect(page.getByText('Prueba e2e')).toBeVisible();
  await page.getByRole('link', { name: 'Ver mis turnos' }).click();
  await expect(page.getByText('Confirmado')).toBeVisible();
  await page.getByRole('button', { name: 'Cancelar' }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.getByLabel('Motivo').fill('No puedo asistir por trabajo');
  await page.getByRole('button', { name: 'Confirmar cancelación' }).click();
  await expect(page.getByText('Turno cancelado.')).toBeVisible();
});

test('reprograma una reserva a un nuevo horario', async ({ page }) => {
  await registerAndBook(page);
  await page.getByRole('link', { name: 'Ver mis turnos' }).click();
  await page.getByRole('button', { name: 'Reprogramar' }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText(/Elegí otro horario/)).toBeVisible();
  await dialog.getByRole('button').filter({ hasText: /^\d{2}:\d{2}$/ }).first().click();
  await expect(dialog.getByRole('button', { name: 'Confirmar nuevo horario' })).toBeEnabled();
  await dialog.getByRole('button', { name: 'Confirmar nuevo horario' }).click();
  await expect(page.getByText('Turno reprogramado.')).toBeVisible();
});

test('admin consulta agenda y crea un bloqueo', async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel('Email').fill('admin@bellavista.test');
  await page.getByLabel('Contraseña').fill('Admin1234');
  await page.getByRole('button', { name: 'Entrar' }).click();
  await page.getByRole('link', { name: 'Admin' }).click();
  await expect(page.getByRole('heading', { name: 'Agenda del local' })).toBeVisible();
  await expect(page.getByLabel('Métricas del día')).toBeVisible();
  await expect(page.getByText('Bloqueos de agenda')).toBeVisible();
  await page.getByLabel('Profesional').selectOption({ label: 'Nico' });
  const inputs = page.locator('input[type="datetime-local"]');
  await inputs.nth(0).fill('2026-12-01T10:00');
  await inputs.nth(1).fill('2026-12-01T11:00');
  await page.getByLabel('Motivo').fill('Capacitación interna');
  await page.getByRole('button', { name: 'Crear bloqueo' }).click();
  await expect(page.getByText('Bloqueo de agenda creado.')).toBeVisible();
  await expect(page.getByText('Capacitación interna')).toBeVisible();
});

test('la portada comunica servicios y reglas antes de iniciar sesión', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle(/Bellavista/i);
  await expect(page.getByRole('heading', { name: 'Tu estilo, con turno y sin esperas.' })).toBeVisible();
  await expect(page.getByText('Martes a sábado · Buenos Aires')).toBeVisible();
  await expect(page.getByText('3', { exact: true })).toBeVisible();
  await expect(page.getByText('barberos', { exact: true })).toBeVisible();
  await expect(page.getByText('4', { exact: true })).toBeVisible();
  await expect(page.getByText('servicios', { exact: true })).toBeVisible();
  await expect(page.getByText('2 h', { exact: true })).toBeVisible();
  await expect(page.getByText('anticipación mínima', { exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Reservar turno' }).first()).toBeVisible();
  await expect(page.getByRole('link', { name: 'Ya tengo cuenta' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Elegí cómo querés salir.' })).toBeVisible();
  await expect(page.getByText('Corte clásico')).toBeVisible();
  await expect(page.getByText('Corte + barba')).toBeVisible();
  await expect(page.getByText('Afeitado tradicional')).toBeVisible();
  await expect(page.getByText('Coloración')).toBeVisible();
  await expect(page.getByText('Corte de cabello con lavado y peinado.')).toBeVisible();
  await expect(page.getByText('Coloración completa con tratamiento.')).toBeVisible();
  await expect(page.getByText('Precios finales. La duración la calcula el sistema al reservar.')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Reservar es simple.' })).toBeVisible();
  await expect(page.getByText('Elegí servicio y barbero')).toBeVisible();
  await expect(page.getByText('Seleccioná día y horario')).toBeVisible();
  await expect(page.getByText('Confirmá y listo')).toBeVisible();
  await expect(page.getByText('Disponibilidad real, con pausas y bloqueos incluidos.')).toBeVisible();
  await expect(page.getByText('Av. Siempre Viva 1234, Buenos Aires · Martes a sábado')).toBeVisible();
});
