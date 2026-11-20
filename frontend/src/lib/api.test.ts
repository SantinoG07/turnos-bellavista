import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError, api, clearToken, getToken, setToken } from './api';

function mockResponse(body: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: vi.fn().mockResolvedValue(body),
  } as unknown as Response;
}

describe('T09 · cliente HTTP', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('guarda, lee y borra el token', () => {
    expect(getToken()).toBeNull();
    setToken('abc');
    expect(getToken()).toBe('abc');
    clearToken();
    expect(getToken()).toBeNull();
  });

  it('hace login con POST y JSON', async () => {
    vi.mocked(fetch).mockResolvedValue(
      mockResponse({ token: 't', user: { id: '1' } }),
    );
    const result = await api.auth.login('a@b.com', 'Clave1234');
    expect(result.token).toBe('t');
    expect(fetch).toHaveBeenCalledWith(
      '/api/auth/login',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ email: 'a@b.com', password: 'Clave1234' }),
      }),
    );
  });

  it('agrega el Bearer cuando hay sesión', async () => {
    setToken('token-123');
    vi.mocked(fetch).mockResolvedValue(mockResponse({ user: { id: '1' } }));
    await api.auth.me();
    const [, options] = vi.mocked(fetch).mock.calls[0]!;
    expect(options?.headers).toMatchObject({ Authorization: 'Bearer token-123' });
  });

  it('RN-06: propaga el error 429 y su mensaje', async () => {
    vi.mocked(fetch).mockResolvedValue(
      mockResponse(
        {
          error: {
            code: 'RATE_LIMITED',
            message: 'Demasiados intentos.',
          },
        },
        429,
      ),
    );
    await expect(api.auth.login('a@b.com', 'x')).rejects.toMatchObject({
      status: 429,
      code: 'RATE_LIMITED',
      message: 'Demasiados intentos.',
    });
  });

  it('propaga los detalles de validación', async () => {
    vi.mocked(fetch).mockResolvedValue(
      mockResponse(
        {
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Revisá los datos.',
            details: { email: ['Email inválido'] },
          },
        },
        400,
      ),
    );
    try {
      await api.auth.register({
        fullName: 'A',
        email: 'mal',
        password: 'Clave1234',
      });
      expect.unreachable();
    } catch (error) {
      expect(error).toBeInstanceOf(ApiError);
      expect((error as ApiError).details).toEqual({ email: ['Email inválido'] });
    }
  });

  it('maneja una respuesta 204 sin JSON', async () => {
    vi.mocked(fetch).mockResolvedValue(mockResponse(null, 204));
    await expect(api.admin.deleteTimeOff('id')).resolves.toBeUndefined();
  });

  it('informa error de red', async () => {
    vi.mocked(fetch).mockRejectedValue(new TypeError('Failed to fetch'));
    await expect(api.catalog.services()).rejects.toMatchObject({
      code: 'NETWORK_ERROR',
    });
  });

  it('codifica los parámetros de disponibilidad', async () => {
    vi.mocked(fetch).mockResolvedValue(
      mockResponse({ date: '2026-11-24', timezone: 'x', slots: [] }),
    );
    await api.catalog.availability('pro id', 'serv id', '2026-11-24');
    expect(fetch).toHaveBeenCalledWith(
      '/api/availability?professionalId=pro%20id&serviceId=serv%20id&date=2026-11-24',
      expect.anything(),
    );
  });

  it('arma la query de filtros de administración', async () => {
    vi.mocked(fetch).mockResolvedValue(mockResponse({ appointments: [] }));
    await api.admin.appointments('2026-11-24', 'confirmed');
    expect(fetch).toHaveBeenCalledWith(
      '/api/admin/appointments?date=2026-11-24&status=confirmed',
      expect.anything(),
    );
  });
});
