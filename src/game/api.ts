/**
 * Thin API client for the VoxQuest Laravel backend.
 *
 * - Bearer token auth (Laravel Sanctum). The token lives in localStorage so it
 *   survives reloads; it is the only credential the PWA holds.
 * - `apiFetch` retries transient failures (network error, 429, 5xx) with
 *   exponential backoff and honours `Retry-After`.
 * - 4xx (except 429) throw `ApiError` immediately — the caller decides.
 */

export const API_BASE: string =
  (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/+$/, "") ??
  "http://localhost:8000/api/v1";

const TOKEN_KEY = "voxquest:token";

export function getToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setToken(token: string): void {
  try {
    localStorage.setItem(TOKEN_KEY, token);
  } catch {
    /* private mode: token stays in memory only for this session */
  }
}

export function clearToken(): void {
  try {
    localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* ignore */
  }
}

export function isAuthenticated(): boolean {
  return getToken() !== null;
}

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public payload?: unknown
  ) {
    super(message);
    this.name = "ApiError";
  }

  /** Field -> messages, for 422 responses. */
  get validationErrors(): Record<string, string[]> {
    const p = this.payload as { errors?: Record<string, string[]> } | undefined;
    return p?.errors ?? {};
  }
}

interface FetchOptions {
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  body?: unknown;
  /** attempts for transient failures (default 4) */
  retries?: number;
  signal?: AbortSignal;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function apiFetch<T = unknown>(path: string, opts: FetchOptions = {}): Promise<T> {
  const { method = "GET", body, retries = 4, signal } = opts;
  const url = path.startsWith("http") ? path : `${API_BASE}${path}`;

  let attempt = 0;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    attempt++;
    let res: Response;
    try {
      res = await fetch(url, {
        method,
        signal,
        headers: {
          Accept: "application/json",
          ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
          ...(getToken() ? { Authorization: `Bearer ${getToken()}` } : {})
        },
        body: body !== undefined ? JSON.stringify(body) : undefined
      });
    } catch (err) {
      // network error / offline
      if (attempt > retries) throw new ApiError(0, "Sin conexion con el servidor.", err);
      await sleep(backoff(attempt));
      continue;
    }

    if (res.status === 401) {
      clearToken();
      throw new ApiError(401, "Sesion expirada.");
    }

    if (res.status === 429 || res.status >= 500) {
      if (attempt > retries) {
        throw new ApiError(res.status, `El servidor respondio ${res.status}.`);
      }
      const retryAfter = Number(res.headers.get("Retry-After"));
      await sleep(Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : backoff(attempt));
      continue;
    }

    const text = await res.text();
    const json = text ? safeJson(text) : null;

    if (!res.ok) {
      throw new ApiError(res.status, (json as { message?: string })?.message ?? res.statusText, json);
    }

    return json as T;
  }
}

function backoff(attempt: number): number {
  const base = Math.min(1000 * 2 ** (attempt - 1), 15_000);
  return base + Math.random() * 400; // jitter
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

/* ----------------------------- Auth endpoints ----------------------------- */

export interface AuthUser {
  id: number;
  name: string;
  email: string;
  email_verified: boolean;
  onboarded: boolean;
  xp_total: number;
  level: number;
}

interface AuthResponse {
  token: string;
  user: AuthUser;
}

export const auth = {
  async register(input: {
    name: string;
    email: string;
    password: string;
    password_confirmation: string;
  }): Promise<AuthUser> {
    const r = await apiFetch<AuthResponse>("/auth/register", {
      method: "POST",
      body: { ...input, device_name: deviceName() },
      retries: 1
    });
    setToken(r.token);
    return r.user;
  },

  async login(email: string, password: string): Promise<AuthUser> {
    const r = await apiFetch<AuthResponse>("/auth/login", {
      method: "POST",
      body: { email, password, device_name: deviceName() },
      retries: 1
    });
    setToken(r.token);
    return r.user;
  },

  async logout(): Promise<void> {
    try {
      await apiFetch("/auth/logout", { method: "POST", retries: 1 });
    } finally {
      clearToken();
    }
  },

  async me(): Promise<{ data: AuthUser }> {
    return apiFetch("/auth/me");
  }
};

/** Push local (client-detected) profile fields to the server. */
export async function updateProfile(patch: {
  name?: string;
  voice_type_key?: string | null;
  voice_type_label?: string | null;
  range_low_midi?: number | null;
  range_high_midi?: number | null;
  mark_onboarded?: boolean;
}): Promise<void> {
  await apiFetch("/profile", { method: "PATCH", body: patch, retries: 2 });
}

function deviceName(): string {
  const ua = navigator.userAgent;
  const browser = /Edg\//.test(ua) ? "Edge" : /Chrome\//.test(ua) ? "Chrome" : /Firefox\//.test(ua) ? "Firefox" : /Safari\//.test(ua) ? "Safari" : "PWA";
  return `${browser} · ${navigator.platform || "web"}`.slice(0, 64);
}
