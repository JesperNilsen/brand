import { expect, test } from "@playwright/test";
import training from "../content/ibsen-brand/training-edition.v1.json";

const fixture = training.segments.find((s) => s.id === "akt1-08")!;

/**
 * T-13: the three notices on the result page have to survive meeting.
 *
 * Each one is right on its own, and each was written as though it were the only
 * one on the page — pulling itself up under the heading with a negative margin
 * and pushing the numbers down with its own bottom margin. An abandoned session,
 * written with a text filter, in a browser that stores nothing, shows all three
 * at once: the reader is already getting bad news, and that is the moment the
 * layout gave way. The spacing now lives on one container.
 *
 * This test exists because that combination is the one nobody produces by
 * accident while clicking around.
 */
test("all three result notices can appear at once, in order and without overlapping", async ({
  page,
}) => {
  // Storage locked down, the way a private window can be: this is the unsaved
  // notice, and it must not be simulated by faking the element.
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

  // A practice form that really changes the text, so the comparability notice
  // is the app's own judgement rather than a query parameter.
  await page.goto(
    `/skriv?mode=passage&work=ibsen-brand&segment=${fixture.id}&filter=words-only`,
  );
  await page.getByTestId("typing-input").focus();
  await page.keyboard.type("Far");

  // A pause, so pauseCount > 0.
  await page.getByTestId("menu-button").click();
  await page.getByTestId("menu-resume").click();
  await page.getByTestId("menu-button").click();
  await page.getByTestId("menu-finish").click();
  await expect(page).toHaveURL(/\/resultat\//);

  const unsaved = page.getByTestId("unsaved-notice");
  const filter = page.getByText(/Skrevet med tekstformen/);
  const paused = page.getByTestId("paused-notice");
  await expect(unsaved).toBeVisible();
  await expect(filter).toBeVisible();
  await expect(paused).toBeVisible();

  const boxes = await Promise.all(
    [unsaved, filter, paused].map(async (l) => (await l.boundingBox())!),
  );
  for (const box of boxes) expect(box).not.toBeNull();

  // In the order they are written, and with real space between them: a notice
  // that starts before the previous one has ended is the collision this fixes.
  for (let i = 1; i < boxes.length; i += 1) {
    const previousEnd = boxes[i - 1].y + boxes[i - 1].height;
    expect(boxes[i].y).toBeGreaterThan(previousEnd);
  }

  // And the numbers still start below the last of them.
  const numbers = (await page.getByTestId("net-wpm").boundingBox())!;
  expect(numbers.y).toBeGreaterThan(boxes[2].y + boxes[2].height);
});
