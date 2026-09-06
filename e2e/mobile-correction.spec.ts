import { devices, expect, test, type Page } from "@playwright/test";
import training from "../content/ibsen-brand/training-edition.v1.json";

const segment = training.segments[0];
const prefix = segment.text.slice(0, 2);
const nextChar = segment.text.slice(2, 3);
const wrongChar = nextChar === "x" ? "z" : "x";

/**
 * Correction on a phone.
 *
 * A hardware Backspace is a key event, and Blink turns it into a delete
 * command whether or not the field holds anything, so the desktop path never
 * cared that the hidden textarea was empty. A soft keyboard sends no key. It
 * asks the field to delete what sits behind the caret — Android's
 * `InputConnection.deleteSurroundingText`, and the same editing pipeline on
 * iOS — so an empty field produced no event at all and correction was simply
 * unreachable on a phone while typing worked.
 *
 * Playwright cannot run a real IME: `keyboard.press("Backspace")` is a
 * hardware key on every device descriptor, which is exactly the path that was
 * never broken, so a test written that way passes against the bug.
 * `execCommand("delete")` is the editing command the IME route ends in, and it
 * is the only handle on that route from a test. It reproduces the reported
 * symptom against the unfixed code — the mistyped character stays — and is
 * what this test turns on.
 */
async function openPassage(page: Page) {
  await page.goto(
    `/skriv?mode=passage&work=ibsen-brand&segment=${segment.id}&filter=as-printed`,
  );
  await page.getByTestId("typing-input").focus();
}

/** What a soft keyboard's backspace does: delete behind the caret, no key. */
async function softKeyboardDelete(page: Page) {
  await page.evaluate(() => document.execCommand("delete"));
}

const correct = (page: Page) => page.locator(".ch-correct");
const incorrect = (page: Page) => page.locator(".ch-incorrect");

// File-level, not inside the describe: a device descriptor carries
// `defaultBrowserType`, and Playwright refuses that in a describe group
// because it forces a new worker.
test.use({ ...devices["Pixel 5"] });

test.describe("Correction on a phone", () => {
  test("a soft keyboard's backspace erases the mistyped character", async ({
    page,
  }) => {
    await openPassage(page);
    await page.keyboard.type(prefix + wrongChar);
    await expect(correct(page)).toHaveCount(2);
    await expect(incorrect(page)).toHaveCount(1);

    await softKeyboardDelete(page);
    await expect(incorrect(page)).toHaveCount(0);
    await expect(correct(page)).toHaveCount(2);

    // Typing carries on from the corrected position rather than from wherever
    // the delete happened to leave the hidden field's caret.
    await page.keyboard.type(nextChar);
    await expect(correct(page)).toHaveCount(3);
    await expect(incorrect(page)).toHaveCount(0);
  });

  test("repeated soft-keyboard backspaces keep working", async ({ page }) => {
    // The field is corrected by giving the keyboard filler to bite into, so
    // the failure this guards against is the filler running out: the first
    // delete works and a later one silently stops doing anything.
    await openPassage(page);
    await page.keyboard.type(segment.text.slice(0, 12));
    await expect(correct(page)).toHaveCount(12);

    for (let remaining = 11; remaining >= 0; remaining -= 1) {
      await softKeyboardDelete(page);
      await expect(correct(page)).toHaveCount(remaining);
    }
  });

  test("a hardware backspace still corrects at phone size", async ({ page }) => {
    // Phones take external keyboards, and the desktop path must survive
    // the fix regardless.
    await openPassage(page);
    await page.keyboard.type(prefix + wrongChar);
    await expect(incorrect(page)).toHaveCount(1);
    await page.keyboard.press("Backspace");
    await expect(incorrect(page)).toHaveCount(0);
    await expect(correct(page)).toHaveCount(2);
  });
});
