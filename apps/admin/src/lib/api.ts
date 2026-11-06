import { ApiError } from '@gestionnaire/shared';

export { ApiError };

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:4000';
const PLATFORM_STORAGE_KEY = 'gestionnaire.platform_token';

export function loadPlatformToken(): string | null {
  return localStorage.getItem(PLATFORM_STORAGE_KEY);
}

export function savePlatformToken(token: string) {
  localStorage.setItem(PLATFORM_STORAGE_KEY, token);
}

export function clearPlatformToken() {
  localStorage.removeItem(PLATFORM_STORAGE_KEY);
}

export async function platformRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = loadPlatformToken();
  const headers = new Headers(options.headers);
  headers.set('Content-Type', 'application/json');
  if (token) headers.set('Authorization', `Bearer ${token}`);

  const res = await fetch(`${API_URL}${path}`, { ...options, headers });
  const isJson = res.headers.get('content-type')?.includes('application/json');
  const body = isJson ? await res.json().catch(() => null) : null;
  if (!res.ok) {
    throw new ApiError(res.status, body?.message ?? `Erreur ${res.status}`);
  }
  return body as T;
}

export const platformApi = {
  get: <T,>(path: string) => platformRequest<T>(path),
  post: <T,>(path: string, body?: unknown) =>
    platformRequest<T>(path, { method: 'POST', body: body ? JSON.stringify(body) : undefined }),
  put: <T,>(path: string, body?: unknown) =>
    platformRequest<T>(path, { method: 'PUT', body: body ? JSON.stringify(body) : undefined }),
  patch: <T,>(path: string, body?: unknown) =>
    platformRequest<T>(path, { method: 'PATCH', body: body ? JSON.stringify(body) : undefined }),
  delete: <T,>(path: string) => platformRequest<T>(path, { method: 'DELETE' }),
};

export async function platformLogin(
  email: string,
  password: string,
): Promise<{ id: string; email: string; fullName: string; role: string }> {
  const res = await fetch(`${API_URL}/platform/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new ApiError(res.status, body?.message ?? 'Identifiants administrateur invalides');
  }
  const data = await res.json();
  savePlatformToken(data.accessToken);
  return data.admin;
}
