import { test, expect, seedSession, widget, USERS } from "./fixtures/app";

/**
 * Queue panel lifecycle controls previously gated behind "live mode only":
 * duplicate, remove, and clear now work in demo mode too.
 */
test.describe("queue lifecycle (demo mode)", () => {
  test.beforeEach(async ({ page }) => {
    await seedSession(page, USERS.red, { demoMode: true });
    await page.goto("/red-team");
    await expect(page.getByRole("heading", { name: "Red Team Portal" })).toBeVisible();
  });

  test("duplicate, remove, and clear queue items", async ({ page }) => {
    const queue = await widget(page, "Attack Queue");
    const items = queue.locator("li", { hasText: "SQL Injection" });

    await page.getByRole("button", { name: /Add ["“]SQL Injection["”] to queue/ }).click();
    await page.keyboard.press("Escape");
    await expect(items).toHaveCount(1);

    // Duplicate → 2 queued runs of the same op.
    await items.first().getByRole("button", { name: "Duplicate" }).click();
    await expect(items).toHaveCount(2);

    // Remove one → back to a single queued run.
    await items.first().getByRole("button", { name: "Remove" }).click();
    await expect(items).toHaveCount(1);

    // Clear queue → empty state returns.
    await queue.getByRole("button", { name: "Clear queue" }).click();
    await expect(
      queue.getByText(/Configure an attack and add it to the queue to begin/),
    ).toBeVisible();
    await expect(items).toHaveCount(0);
  });
});
