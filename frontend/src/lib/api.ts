const TOKEN_KEY = 'turnos_bellavista_token';

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}

export interface ApiErrorDetails {
  [field: string]: string[];
}

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details?: ApiErrorDetails,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

const BASE_URL = (import.meta.env.VITE_API_URL ?? '').replace(/\/$/, '');

async function request<T>(
  path: string,
  options: { method?: string; body?: unknown } = {},
): Promise<T> {
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (options.body !== undefined) headers['Content-Type'] = 'application/json';
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  let response: Response;
  try {
    response = await fetch(`${BASE_URL}${path}`, {
      method: options.method ?? 'GET',
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
    });
  } catch {
    throw new ApiError(0, 'NETWORK_ERROR', 'No pudimos conectarnos con el servidor.');
  }

  if (response.status === 204) return undefined as T;

  const payload = (await response.json().catch(() => null)) as
    | { error?: { code?: string; message?: string; details?: ApiErrorDetails } }
    | null;

  if (!response.ok) {
    throw new ApiError(
      response.status,
      payload?.error?.code ?? 'ERROR',
      payload?.error?.message ?? 'Ocurrió un error inesperado.',
      payload?.error?.details,
    );
  }
  return payload as T;
}

export const api = {
  auth: {
    login: (email: string, password: string) =>
      request<{ token: string; user: import('../types.js').User }>('/api/auth/login', {
        method: 'POST',
        body: { email, password },
      }),
    register: (input: { fullName: string; email: string; password: string; phone?: string }) =>
      request<{ token: string; user: import('../types.js').User }>('/api/auth/register', {
        method: 'POST',
        body: input,
      }),
    me: () => request<{ user: import('../types.js').User }>('/api/auth/me'),
  },
  catalog: {
    services: () => request<{ services: import('../types.js').Service[] }>('/api/services'),
    professionals: (serviceId?: string) =>
      request<{ professionals: import('../types.js').Professional[] }>(
        `/api/professionals${serviceId ? `?serviceId=${encodeURIComponent(serviceId)}` : ''}`,
      ),
    availability: (professionalId: string, serviceId: string, date: string) =>
      request<import('../types.js').Availability>(
        `/api/availability?professionalId=${encodeURIComponent(professionalId)}&serviceId=${encodeURIComponent(serviceId)}&date=${encodeURIComponent(date)}`,
      ),
  },
  appointments: {
    create: (input: {
      serviceId: string;
      professionalId: string;
      startsAt: string;
      notes?: string;
    }) =>
      request<{ appointment: import('../types.js').Appointment }>('/api/appointments', {
        method: 'POST',
        body: input,
      }),
    mine: (scope: 'upcoming' | 'past' | 'all' = 'upcoming') =>
      request<{ appointments: import('../types.js').Appointment[] }>(
        `/api/appointments/mine?scope=${scope}`,
      ),
    get: (id: string) =>
      request<{ appointment: import('../types.js').Appointment }>(`/api/appointments/${id}`),
    cancel: (id: string, reason?: string) =>
      request<{ appointment: import('../types.js').Appointment }>(
        `/api/appointments/${id}/cancel`,
        { method: 'PATCH', body: { reason: reason ?? null } },
      ),
    reschedule: (id: string, startsAt: string) =>
      request<{ appointment: import('../types.js').Appointment }>(
        `/api/appointments/${id}/reschedule`,
        { method: 'PATCH', body: { startsAt } },
      ),
  },
  admin: {
    appointments: (date: string, status?: string) =>
      request<{ appointments: import('../types.js').Appointment[] }>(
        `/api/admin/appointments?date=${encodeURIComponent(date)}${status ? `&status=${status}` : ''}`,
      ),
    metrics: (date: string) =>
      request<{ metrics: import('../types.js').Metrics }>(
        `/api/admin/metrics?date=${encodeURIComponent(date)}`,
      ),
    clients: (query = '') =>
      request<{ clients: import('../types.js').Client[] }>(
        `/api/admin/clients?query=${encodeURIComponent(query)}`,
      ),
    unblock: (id: string) =>
      request<{ ok: boolean }>(`/api/admin/clients/${id}/unblock`, { method: 'PATCH' }),
    timeOff: (from: string, to: string) =>
      request<{ timeOff: import('../types.js').TimeOff[] }>(
        `/api/admin/time-off?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`,
      ),
    createTimeOff: (input: {
      professionalId: string;
      startsAt: string;
      endsAt: string;
      reason: string;
    }) =>
      request<{ timeOff: import('../types.js').TimeOff }>('/api/admin/time-off', {
        method: 'POST',
        body: input,
      }),
    deleteTimeOff: (id: string) =>
      request<void>(`/api/admin/time-off/${id}`, { method: 'DELETE' }),
    cancel: (id: string, reason: string) =>
      request<{ appointment: import('../types.js').Appointment }>(
        `/api/admin/appointments/${id}/cancel`,
        { method: 'PATCH', body: { reason } },
      ),
    complete: (id: string) =>
      request<{ appointment: import('../types.js').Appointment }>(
        `/api/admin/appointments/${id}/complete`,
        { method: 'PATCH' },
      ),
    noShow: (id: string) =>
      request<{ appointment: import('../types.js').Appointment }>(
        `/api/admin/appointments/${id}/no-show`,
        { method: 'PATCH' },
      ),
  },
};
