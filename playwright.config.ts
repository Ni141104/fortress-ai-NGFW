import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright e2e configuration for the AI-NGFW console.
 *
 * Most specs run against the frontend alone in demo mode (seeded session
 * storage, no backend required). The `live-*` specs additionally need the
 * FastAPI backend on :8000 with the seeded account set; they self-skip when
 * the health endpoint is unreachable.
 */
const BACKEND_URL = process.env.VITE_API_BASE_URL ?? "http://127.0.0.1:8000/api";

export default defineConfig({
  testDir: "./e2e",
  timeout: 45_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: "http://localhost:8080",
    viewport: { width: 1440, height: 900 },
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  webServer: {
    command: "npm run dev",
    port: 8080,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});

export { BACKEND_URL };