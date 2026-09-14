import { test, expect, seedSession, widget, USERS } from "./fixtures/app";

/**
 * Full red-team operation in demo mode: pick a real threat, tune it, queue it,
 * launch, and let the engine run the red/blue pipeline to a terminal verdict.
 */
test.describe("red team full operation (demo mode)", () => {
  test.beforeEach(async ({ page }) => {
    await seedSession(page, USERS.red, { demoMode: true });
    await page.goto("/red-team");
    await expect(page.getByRole("heading", { name: "Red Team Portal" })).toBeVisible();
  });

  test("queues an SQL Injection op and runs it to completion", async ({ page }) => {
    test.setTimeout(150_000);

    // SQL Injection is the default catalog selection; configure it.
    const target = page.getByLabel("Target");
    await expect(target).toBeVisible();
    await target.fill("10.0.5.99");

    // Shorten the run so a terminal verdict is reachable in-test.
    await page.locator("#cfg-rate").fill("10");
    await page.locator("#cfg-duration").fill("10");

    await page.getByRole("button", { name: /Add ["“]SQL Injection["”] to queue/ }).click();

    // In demo mode the journey sheet opens on enqueue and ARIA-hides the page.
    await expect(page.getByRole("dialog", { name: /Attack Journey/ })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog", { name: /Attack Journey/ })).toHaveCount(0);

    // The attack shows up in the queue widget.
    const queue = await widget(page, "Attack Queue");
    await expect(queue.locator("li", { hasText: "SQL Injection" }).first()).toBeVisible();

    await queue.getByRole("button", { name: "Launch" }).click();
    await page.keyboard.press("Escape");

    // The engine runs the staged pipeline to a terminal verdict.
    await expect(page.getByText(/Simulation completed/)).toBeVisible({
      timeout: 60_000,
    });

    // A terminal badge on the queue item confirms the verdict settled.
    await expect(
      queue
        .locator("li", { hasText: "SQL Injection" })
        .locator("span", { hasText: /^(block|allow|degraded|offline)$/i }),
    ).toBeVisible();

    // The configured target surfaced in the operation feed.
    await expect(page.getByText("10.0.5.99").first()).toBeVisible();
  });
});
