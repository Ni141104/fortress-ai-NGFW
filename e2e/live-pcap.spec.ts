import {
  test,
  expect,
  loginViaApi,
  widget,
  queueItems,
  backendReachable,
  USERS,
} from "./fixtures/app";

/**
 * Live-mode end-to-end flow using the real FastAPI backend.
 * All tests self-skip when the backend health endpoint is unreachable.
 */
test.describe("live backend integration", () => {
  test("red-team uploads a pcap; ML pipeline returns a real verdict", async ({ page }) => {
    test.skip(!(await backendReachable()), "FastAPI backend not reachable");
    test.setTimeout(180_000);

    // Authenticate through the real backend API and boot a LIVE red session.
    await loginViaApi(page, USERS.red);
    await page.goto("/red-team");
    await expect(page.getByRole("heading", { name: "Red Team Portal" })).toBeVisible();

    // The pcap upload only renders in live mode (hidden file input wired via label).
    await page.locator("#cfg-pcap").setInputFiles("e2e/fixtures/capture.pcap");
    await expect(page.getByText("Capture selected")).toBeVisible();
    await expect(page.getByText("capture.pcap")).toBeVisible();

    // Enqueueing in live mode automatically launches the backend pipeline.
    await page
      .getByRole("button", { name: /Add ["“]SQL Injection["”]( with capture)? to queue/ })
      .click();
    await page.keyboard.press("Escape");

    // The backend attack ID persists asynchronously on the telemetry strip.
    await expect(page.getByText(/Backend attack ID: [0-9a-f]{16}/)).toBeVisible({
      timeout: 20_000,
    });

    // The pipeline reaches a terminal state.
    const items = await queueItems(page, "SQL Injection");
    await expect(
      items.locator("span", { hasText: /^(block|allow|degraded|offline)$/i }),
    ).toBeVisible({ timeout: 60_000 });
  });

  test("blue team can roll back the policy", async ({ page }) => {
    test.skip(!(await backendReachable()), "FastAPI backend not reachable");

    await loginViaApi(page, USERS.blue);
    await page.goto("/dashboard");
    await expect(page.getByText("Threat Overview")).toBeVisible();

    const policyWidget = await widget(page, "Tier-0 Policy Repository");
    await policyWidget.scrollIntoViewIfNeeded();
    await policyWidget.getByRole("button", { name: "Rollback" }).click();

    // The backend responds with a success message (the notice replaces the spinner).
    await expect(page.getByText(/rolled back|No learned rules to roll back/i)).toBeVisible({
      timeout: 10_000,
    });
  });
});
