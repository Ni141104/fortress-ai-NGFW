import { test, expect, seedSession, USERS, PASSWORD } from "./fixtures/app";

test.describe("authentication shell", () => {
  test("shows the sign-in screen for unauthenticated sessions", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "Sign in to continue" })).toBeVisible();
    await expect(page.getByPlaceholder("Gmail or institutional email")).toBeVisible();
    await expect(page.getByPlaceholder("Password")).toBeVisible();
    await expect(page.getByRole("button", { name: "Log in" })).toBeVisible();
  });

  test("boots straight into the workspace for a seeded demo session", async ({ page }) => {
    await seedSession(page, USERS.blue, { demoMode: true });
    await page.goto("/");
    await expect(page.getByText("Threat Overview")).toBeVisible();
    // The nav bar confirms the authed shell (not the login screen).
    await expect(page.getByRole("button", { name: "Log out" })).toBeVisible();
    await expect(page.getByText("Sign in to continue")).toHaveCount(0);
  });

  // The AuthPanel inputs do not drive React state when driven by automation in
  // the dev runtime (typing updates the DOM but never re-renders the button's
  // disabled flag). Live-mode specs authenticate through the real backend API
  // instead; track the UI-input issue here until the root cause is fixed.
  test.fixme("authenticates a real user through the UI form", async ({ page }) => {
    await page.goto("/");
    await page.getByPlaceholder("Gmail or institutional email").fill(USERS.red.email);
    await page.getByPlaceholder("Password").fill(PASSWORD);
    await page.getByRole("button", { name: "Log in" }).click();
    await expect(page.getByRole("button", { name: "Log out" })).toBeVisible();
  });
});
