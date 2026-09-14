import { test as base } from "@playwright/test";
import type { Locator, Page } from "@playwright/test";
import { BACKEND_URL } from "../../playwright.config";
import type { AuthUser } from "../../src/services/api-client";

/**
 * Known seeded accounts (cyber-defense-backend/seed_users.py).
 * Passwords are all `Admin123`.
 */
export const USERS: Record<"admin" | "blue" | "red", AuthUser> = {
  admin: {
    id: 4,
    username: "admin",
    email: "nikhilprajapati1411@gmail.com",
    role: "admin",
  },
  blue: {
    id: 5,
    username: "blueteam",
    email: "nikhil141107@gmail.com",
    role: "blue",
  },
  red: {
    id: 6,
    username: "redteam",
    email: "112215139@cse.iiitp.ac.in",
    role: "red",
  },
};

export const PASSWORD = "Admin123";

/** Default platform settings used by every seeded session. */
const DEFAULT_SETTINGS = {
  simulationSpeed: 1,
  autoReplay: false,
  demoModeEnabled: true,
  widgetRefreshInterval: 5000,
  notificationsEnabled: true,
  notificationSound: false,
  themeAccent: "blue",
};

/**
 * Seed session storage so the app boots straight into the workspace without
 * the login screen (the SSR shell renders the login view and hydrates into the
 * authed app once localStorage is present).
 */
export async function seedSession(
  page: Page,
  user: AuthUser,
  { demoMode = true, seedToken = false }: { demoMode?: boolean; seedToken?: boolean } = {},
): Promise<void> {
  await page.addInitScript(
    ({ user, demoMode, seedToken, role }) => {
      window.localStorage.setItem("ngfw.auth.user", JSON.stringify(user));
      if (seedToken) window.localStorage.setItem("ngfw.auth.token", "seeded-e2e-token");
      window.localStorage.setItem("ngfw.role", role);
      window.localStorage.setItem(
        "ngfw.platform.settings",
        JSON.stringify({ ...DEFAULT_SETTINGS, demoModeEnabled: demoMode }),
      );
    },
    { user, demoMode, seedToken, role: user.role ?? "blue" },
  );
}

/** Seed only platform settings (no user/token). */
export async function seedSettings(page: Page, opts: { demoMode?: boolean } = {}): Promise<void> {
  await page.addInitScript(
    ({ demoMode }) => {
      window.localStorage.setItem(
        "ngfw.platform.settings",
        JSON.stringify({ ...DEFAULT_SETTINGS, demoModeEnabled: demoMode }),
      );
    },
    { demoMode: opts.demoMode ?? false },
  );
}

/**
 * Authenticate against the real FastAPI backend and seed a LIVE session with
 * the actual JWT (no login-screen interaction required).
 */
export async function loginViaApi(page: Page, user: AuthUser): Promise<void> {
  const response = await fetch(`${BACKEND_URL}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: user.email, password: PASSWORD }),
  });
  if (!response.ok) {
    throw new Error(`Backend login failed for ${user.email}: HTTP ${response.status}`);
  }
  const data = (await response.json()) as { access_token?: string };
  const token = data.access_token;
  if (!token) throw new Error(`Backend login returned no access_token for ${user.email}`);
  // Seed settings + auth in ONE init script so a live (demoModeEnabled:false)
  // session always boots. (Split scripts proved unreliable: the settings seed
  // silently never landed, leaving demo mode enabled and the pcap launch a no-op.)
  await page.addInitScript(
    ({ user, token, role, settings }) => {
      window.localStorage.setItem("ngfw.auth.user", JSON.stringify(user));
      window.localStorage.setItem("ngfw.auth.token", token);
      window.localStorage.setItem("ngfw.role", role);
      window.localStorage.setItem(
        "ngfw.platform.settings",
        JSON.stringify({ ...settings, demoModeEnabled: false }),
      );
    },
    {
      user,
      token,
      role: user.role ?? "blue",
      settings: DEFAULT_SETTINGS,
    },
  );
}

/** Probe the FastAPI backend health endpoint with a small timeout. */
export async function backendReachable(): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 2500);
    const response = await fetch(`${BACKEND_URL}/health`, { signal: controller.signal });
    clearTimeout(timer);
    return response.ok;
  } catch {
    return false;
  }
}

/** Scope a WidgetCard by its h3 title (WidgetCard renders `.glass-panel`). */
export async function widget(page: Page, title: string): Promise<Locator> {
  return page
    .getByRole("heading", { name: title })
    .locator("xpath=ancestor::div[contains(@class,'glass-panel')]");
}

/** Queue items named `attackName`, scoped to the Attack Queue widget. */
export async function queueItems(page: Page, attackName: string): Promise<Locator> {
  const queue = await widget(page, "Attack Queue");
  return queue.locator("ul li", { hasText: attackName });
}

export { expect } from "@playwright/test";

export const test = base;
