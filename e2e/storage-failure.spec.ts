import { expect, test } from "@playwright/test";
import training from "../content/ibsen-brand/training-edition.v1.json";

const fixture = training.segments.find((s) => s.id === "akt1-08")!;

/**
 * The failure this covers is invisible by construction: the session finishes,
 * the write fails, and the user lands on a page that says the session does not
 * exist. Nothing in the interface admits that storage is the problem.
 */
test.describe("Storage failure", () => {
  test("a finished session still shows its result when the write fails", async ({ page }) => {
    // Break opening the database before any app code runs, the way a browser
    // with storage locked down does.
    await page.addInitScript(() => {
      Object.defineProperty(window, "indexedDB", {
        configurable: true,
        get: () => ({
          open() {
            throw new DOMException("storage disabled", "SecurityError");
          },
        }),
      });
    });

    await page.goto(
      `/skriv?mode=passage&work=ibsen-brand&segment=${fixture.id}&filter=as-printed`,
    );
    await page.getByTestId("typing-input").focus();
    for (const ch of Array.from(fixture.text)) {
      if (ch === "\n") await page.keyboard.press("Enter");
      else await page.keyboard.type(ch);
    }

    await expect(page).toHaveURL(/\/resultat\//);
    const result = page.getByTestId("result");
    // The numbers survive.
    await expect(result).toBeVisible();
    await expect(page.getByTestId("accuracy")).toHaveText(/100/);
    await expect(result).not.toContainText("Fant ikke denne økten");
    // And the app admits what happened.
    await expect(page.getByTestId("unsaved-notice")).toBeVisible();
  });

  test("history says so when nothing can be stored", async ({ page }) => {
    await page.addInitScript(() => {
      // Remove IndexedDB entirely: the app falls back to memory.
      Object.defineProperty(window, "indexedDB", { get: () => undefined });
    });
    await page.goto("/historikk");
    await expect(page.getByTestId("no-storage-notice")).toBeVisible();
  });
});
