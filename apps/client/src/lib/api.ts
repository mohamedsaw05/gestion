import { ApiError } from '@gestionnaire/shared';

export { ApiError };

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:4000';
const STORAGE_KEY = 'gestionnaire.session';

interface Session {
  tenantId: string;
  accessToken: string;
  refreshToken: string;
}

export function loadSession(): Session | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Session) : null;
  } catch {
    return null;
  }
}

function saveSession(session: Session) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
}

export function clearSession() {
  localStorage.removeItem(STORAGE_KEY);
}

let activeRefreshPromise: Promise<boolean> | null = null;

function isTokenExpiringSoon(accessToken: string): boolean {
  try {
    const parts = accessToken.split('.');
    if (parts.length !== 3) return false;
    const payload = JSON.parse(atob(parts[1]));
    if (!payload.exp) return false;
    const now = Math.floor(Date.now() / 1000);
    return payload.exp - now < 30; // Moins de 30 secondes restantes
  } catch {
    return false;
  }
}

async function tryRefreshSingleFlight(session: Session): Promise<boolean> {
  if (activeRefreshPromise) {
    return activeRefreshPromise;
  }

  activeRefreshPromise = (async () => {
    try {
      const res = await fetch(`${API_URL}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenantId: session.tenantId, refreshToken: session.refreshToken }),
      });
      if (!res.ok) return false;
      const data = await res.json();
      saveSession({ tenantId: session.tenantId, accessToken: data.accessToken, refreshToken: data.refreshToken });
      return true;
    } catch {
      return false;
    } finally {
      activeRefreshPromise = null;
    }
  })();

  return activeRefreshPromise;
}

async function request<T>(path: string, options: RequestInit = {}, allowRetry = true): Promise<T> {
  let session = loadSession();

  // Rafraîchissement proactif si le token approche de l'expiration (cf Partie 5.3)
  if (session && isTokenExpiringSoon(session.accessToken)) {
    const refreshed = await tryRefreshSingleFlight(session);
    if (refreshed) {
      session = loadSession();
    }
  }

  const headers = new Headers(options.headers);
  headers.set('Content-Type', 'application/json');
  if (session) headers.set('Authorization', `Bearer ${session.accessToken}`);

  const res = await fetch(`${API_URL}${path}`, { ...options, headers });

  if (res.status === 401 && session && allowRetry) {
    const refreshed = await tryRefreshSingleFlight(session);
    if (refreshed) return request<T>(path, options, false);
    clearSession();
    throw new ApiError(401, 'Session expirée, veuillez vous reconnecter');
  }

  const isJson = res.headers.get('content-type')?.includes('application/json');
  const body = isJson ? await res.json().catch(() => null) : null;

  if (!res.ok) {
    throw new ApiError(res.status, body?.message ?? `Erreur ${res.status}`);
  }
  return body as T;
}

export const api = {
  get: <T,>(path: string) => request<T>(path),
  post: <T,>(path: string, body?: unknown) =>
    request<T>(path, { method: 'POST', body: body ? JSON.stringify(body) : undefined }),
  patch: <T,>(path: string, body?: unknown) =>
    request<T>(path, { method: 'PATCH', body: body ? JSON.stringify(body) : undefined }),
  put: <T,>(path: string, body?: unknown) =>
    request<T>(path, { method: 'PUT', body: body ? JSON.stringify(body) : undefined }),
  delete: <T,>(path: string) => request<T>(path, { method: 'DELETE' }),
};

/** Récupère un binaire (ex: reçu PDF) en portant le token d'auth — un <a href> simple ne le peut pas. */
export async function fetchBlob(path: string): Promise<Blob> {
  const session = loadSession();
  const res = await fetch(`${API_URL}${path}`, {
    headers: session ? { Authorization: `Bearer ${session.accessToken}` } : {},
  });
  if (!res.ok) throw new ApiError(res.status, `Erreur ${res.status}`);
  return res.blob();
}

export async function login(email: string, password: string, tenantId?: string): Promise<void> {
  const payload: Record<string, string> = { email: email.trim(), password };
  if (tenantId && tenantId.trim()) {
    payload.tenantId = tenantId.trim();
  }
  const res = await fetch(`${API_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    throw new ApiError(res.status, body?.message ?? 'Échec de connexion');
  }
  const activeTenantId = body.tenantId || tenantId || 'auto-resolved';
  saveSession({ tenantId: activeTenantId, accessToken: body.accessToken, refreshToken: body.refreshToken });
  if (activeTenantId && activeTenantId !== 'auto-resolved') {
    localStorage.setItem('last_tenant_id', activeTenantId);
  }
}

export async function fetchDemoTenants(): Promise<{ id: string; name: string }[]> {
  const res = await fetch(`${API_URL}/auth/demo-tenants`);
  if (!res.ok) return [];
  return res.json();
}

