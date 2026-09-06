import { expect, test } from "@playwright/test";

const PASSAGE = "/skriv?mode=passage&work=ibsen-brand&segment=akt1-01&filter=as-printed";

test.describe("Session menu", () => {
  test("Escape opens the menu and returns to the text", async ({ page }) => {
    await page.goto(PASSAGE);
    const input = page.getByTestId("typing-input");
    await input.focus();
    await input.press("H");

    await page.keyboard.press("Escape");
    await expect(page.getByTestId("session-menu")).toBeVisible();
    // The writing surface must not take keystrokes behind an open menu.
    await expect(input).toBeDisabled();

    await page.keyboard.press("Escape");
    await expect(page.getByTestId("session-menu")).toHaveCount(0);
    // Focus comes back with the text, so typing can simply continue.
    await expect(input).toBeFocused();
    await input.press("v");
  });

  test("the clock stops while the menu is open", async ({ page }) => {
    await page.goto(PASSAGE);
    const input = page.getByTestId("typing-input");
    await input.focus();
    await input.press("H");

    await page.getByTestId("menu-button").click();
    await expect(page.getByTestId("session-menu")).toBeVisible();
    const meter = page.getByTestId("live-meter");
    const frozen = await meter.textContent();
    await page.waitForTimeout(1500);
    expect(await meter.textContent()).toBe(frozen);

    await page.getByTestId("menu-resume").click();
    await expect(page.getByTestId("session-menu")).toHaveCount(0);
  });

  test("finishing from the menu stores the session and marks it as paused", async ({
    page,
  }) => {
    await page.goto(PASSAGE);
    const input = page.getByTestId("typing-input");
    await input.focus();
    await input.press("H");

    await page.getByTestId("menu-button").click();
    await page.waitForTimeout(1100);
    await page.getByTestId("menu-finish").click();

    await expect(page.getByTestId("result")).toBeVisible();
    await expect(page.getByTestId("paused-notice")).toContainText("Pauset 1 gang");
    // The pause is subtracted, not counted as very slow typing.
    await expect(page.getByTestId("paused-notice")).toContainText("trukket fra");

    await page.goto("/historikk");
    await expect(page.getByTestId("history-paused").first()).toBeVisible();
  });

  test("leaving without saving stores nothing", async ({ page }) => {
    await page.goto(PASSAGE);
    const input = page.getByTestId("typing-input");
    await input.focus();
    await input.press("H");

    await page.getByTestId("menu-button").click();
    await page.getByTestId("menu-discard").click();

    await expect(page).toHaveURL(/\/$/);
    await page.goto("/historikk");
    // Nothing from this session: the discard is a real discard.
    await expect(page.getByTestId("history-table")).toHaveCount(0);
    await expect(page.getByText("Ingen økter ennå.")).toBeVisible();
  });
});
