import { expect, test } from "@playwright/test";

const EDITION_URL = "**/content/editions/*.json";

/**
 * T-16: the segment list has a waiting state, and does not flash one.
 *
 * DESIGN.md requires four states of every async view and never `null`. Since
 * fase 3 the list is a real network wait, and since Q-002 the Nonstop chooser
 * waits too. But bars that appear and vanish inside a hundred milliseconds read
 * as a fault rather than as work — so the rule here is two-sided, and both
 * sides are tested.
 */
test.describe("The chooser while the text is on its way", () => {
  for (const mode of ["passage", "nonstop"] as const) {
    test(`${mode}: a slow text is named as a wait, not left blank`, async ({ page }) => {
      let release = () => {};
      const held = new Promise<void>((resolve) => {
        release = resolve;
      });
      await page.route(EDITION_URL, async (route) => {
        await held;
        await route.continue();
      });

      await page.goto(`/velg/${mode}?work=ibsen-brand`);
      // The page is not blank while it waits, and the wait is announced.
      await expect(page.getByTestId("loading")).toBeVisible();
      await expect(page.getByText("Henter teksten …")).toBeVisible();
      // Nothing pretends to be a list yet.
      await expect(page.locator("a[data-segment-id]")).toHaveCount(0);

      release();
      await expect(page.locator("a[data-segment-id]").first()).toBeVisible();
      await expect(page.getByTestId("loading")).toHaveCount(0);
    });
  }

  test("a text that arrives at once never shows the bars", async ({ page }) => {
    // The ordinary case: served locally, well inside the delay. A flash here is
    // the failure this delay exists to prevent, and it would be invisible in a
    // test that only waited for the list.
    const seen: boolean[] = [];
    await page.goto("/velg/passage?work=ibsen-brand");
    for (let i = 0; i < 5; i += 1) {
      seen.push((await page.getByTestId("loading").count()) > 0);
      await page.waitForTimeout(40);
    }
    await expect(page.locator("a[data-segment-id]").first()).toBeVisible();
    expect(seen).not.toContain(true);
  });

  test("a failed text shows the error, not a wait that never ends", async ({ page }) => {
    await page.route(EDITION_URL, (route) => route.abort("failed"));
    await page.goto("/velg/nonstop?work=ibsen-brand");
    await expect(page.getByTestId("choose-error")).toBeVisible();
    await expect(page.getByTestId("loading")).toHaveCount(0);
  });
});
