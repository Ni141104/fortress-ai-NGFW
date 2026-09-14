const API_BASE = (import.meta.env["VITE_API_BASE_URL"] ?? "http://localhost:8000/api").replace(
  /\/$/,
  "",
);
const TOKEN_KEY = "ngfw.auth.token";
const USER_KEY = "ngfw.auth.user";

export interface AuthUser {
  id: number;
  username: string;
  email: string;
  role?: "admin" | "blue" | "red";
}

export class ApiError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

export function getToken(): string | null {
  return typeof window === "undefined" ? null : window.localStorage.getItem(TOKEN_KEY);
}

export function getStoredUser(): AuthUser | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as AuthUser;
  } catch {
    return null;
  }
}

export function clearSession(): void {
  window.localStorage.removeItem(TOKEN_KEY);
  window.localStorage.removeItem(USER_KEY);
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const isFormData = init.body instanceof FormData;
  const headers = new Headers(init.headers);
  if (!isFormData) headers.set("Content-Type", "application/json");
  const token = getToken();
  if (token) headers.set("Authorization", `Bearer ${token}`);

  const response = await fetch(`${API_BASE}${path}`, { ...init, headers });
  if (!response.ok) {
    let message = `FastAPI request failed (${response.status})`;
    try {
      const body = (await response.json()) as { detail?: string };
      if (body.detail) message = body.detail;
    } catch {
      // Preserve the HTTP status when the server did not return JSON.
    }
    if (response.status === 401) clearSession();
    throw new ApiError(response.status, message);
  }
  return (await response.json()) as T;
}

export async function login(email: string, password: string): Promise<AuthUser> {
  const result = await request<{ access_token: string; user: AuthUser }>("/auth/login", {
    method: "POST",
    body: JSON.stringify({ username: email, password }),
  });
  window.localStorage.setItem(TOKEN_KEY, result.access_token);
  window.localStorage.setItem(USER_KEY, JSON.stringify(result.user));
  return result.user;
}

export async function register(
  username: string,
  email: string,
  password: string,
): Promise<AuthUser> {
  const result = await request<{ access_token: string; user: AuthUser }>("/auth/register", {
    method: "POST",
    body: JSON.stringify({ username, email, password }),
  });
  window.localStorage.setItem(TOKEN_KEY, result.access_token);
  window.localStorage.setItem(USER_KEY, JSON.stringify(result.user));
  return result.user;
}

export function apiRequest<T>(path: string, init?: RequestInit): Promise<T> {
  return request<T>(path, init);
}

export function websocketUrl(path: string): string {
  const url = new URL(`${API_BASE}${path}`);
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
  const token = getToken();
  if (token) url.searchParams.set("token", token);
  return url.toString();
}

export { API_BASE };
