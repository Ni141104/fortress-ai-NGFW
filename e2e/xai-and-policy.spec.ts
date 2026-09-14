import { test, expect, seedSession, widget, USERS } from "./fixtures/app";

/**
 * Previously the RL "Explain" and policy "Rollback" buttons were dead:
 * `openXai` returned `undefined` and the rollback call errored or was not wired.
 * These assertions confirm the buttons now open the XAI drawer and the policy
 * widget displays a deterministic success/error notice.
 */
test.describe("XAI + policy controls (demo mode)", () => {
  test("RL Explain opens the detection-rationale drawer", async ({ page }) => {
    await seedSession(page, USERS.blue, { demoMode: true, seedToken: false });
    await page.goto("/dashboard");
    await expect(page.getByText("Threat Overview")).toBeVisible();

    const rlWidget = await widget(page, "Reinforcement Learning");
    await rlWidget.scrollIntoViewIfNeeded();

    // The "Explain" header button was dead in the prior commit; confirm it now
    // opens the drawer by observing the always-present rationale content.
    await rlWidget.getByRole("button", { name: "Explain" }).click();

    await expect(page.getByText("Detection rationale")).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText("Why detected")).toBeVisible();
    await expect(page.getByText("Model scores")).toBeVisible();
    await expect(page.getByText("Isolation Forest score")).toBeVisible();

    await page.keyboard.press("Escape");
    await expect(page.getByText("Detection rationale")).toHaveCount(0);
  });

  test("policy Rollback offline path shows login notice without a session token", async ({
    page,
  }) => {
    await seedSession(page, USERS.blue, { demoMode: true, seedToken: false });
    await page.goto("/dashboard");
    await expect(page.getByText("Threat Overview")).toBeVisible();

    const policyWidget = await widget(page, "Tier-0 Policy Repository");
    await policyWidget.scrollIntoViewIfNeeded();
    await policyWidget.getByRole("button", { name: "Rollback" }).click();

    await expect(page.getByText(/log in before rolling back the policy/i)).toBeVisible({
      timeout: 10_000,
    });
  });
});
