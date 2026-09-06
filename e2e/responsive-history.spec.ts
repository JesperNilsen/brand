import { expect, test } from "@playwright/test";
import training from "../content/ibsen-brand/training-edition.v1.json";

const segment = training.segments[0];

/**
 * The history page carries nine columns. Below 640px that was a silent
 * horizontal scroll: nothing said the table moved, and the two columns a
 * reader actually scans for — the work and the speed — were the ones pushed
 * off-screen. A stacked list takes over at that width.
 *
 * Gated here rather than left to review because the swap is pure CSS: a
 * `sm:` prefix dropped in a later edit would fail silently and look fine on
 * the desktop viewport every other test runs at.
 */
async function writeOneSession(page: import("@playwright/test").Page) {
  await page.goto(
    `/skriv?mode=passage&work=ibsen-brand&segment=${segment.id}&filter=as-printed`,
  );
  await page.getByTestId("typing-input").focus();
  await page.keyboard.type(segment.text.slice(0, 12));
  await page.getByTestId("menu-button").click();
  await page.getByTestId("menu-finish").click();
  await expect(page).toHaveURL(/\/resultat\//);
}

test.describe("History layout", () => {
  test("is a stacked list on a phone and a table on a desktop", async ({ page }) => {
    await writeOneSession(page);

    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto("/historikk");
    await expect(page.getByTestId("history-list")).toBeVisible();
    await expect(page.getByTestId("history-table")).toBeHidden();
    // The work and the speed are the point of the list; both must be readable
    // without scrolling sideways.
    const list = page.getByTestId("history-list");
    await expect(list).toContainText("Ibsen");
    await expect(list).toContainText("wpm");
    const box = await list.boundingBox();
    expect(box!.width).toBeLessThanOrEqual(375);

    await page.setViewportSize({ width: 1280, height: 900 });
    await expect(page.getByTestId("history-table")).toBeVisible();
    await expect(page.getByTestId("history-list")).toBeHidden();
  });

  test("a session row on a phone still opens its result", async ({ page }) => {
    await writeOneSession(page);
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto("/historikk");
    await page.getByTestId("history-list").getByRole("link").first().click();
    await expect(page).toHaveURL(/\/resultat\//);
    await expect(page.getByTestId("result")).toBeVisible();
  });
});
