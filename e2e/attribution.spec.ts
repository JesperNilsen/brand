/**
 * The attribution line is on the writing surface, not only on /om.
 *
 * The claim that needs a browser is placement: a unit test can prove the
 * sentence is correct (tests/content/attribution.test.ts) but not that anyone
 * ever sees it. Delete the `<p>` from SessionView and everything else in the
 * suite still passes — this is the test that goes red.
 */
import { expect, test } from "@playwright/test";
import training from "../content/ibsen-brand/training-edition.v1.json";
import work from "../content/ibsen-brand/original.json";

const first = [...training.segments].sort((a, b) => a.order - b.order)[0];
const printed = (work as { work: { source: { digitalEdition: string } } }).work.source
  .digitalEdition;

test.describe("Attribution on the writing surface", () => {
  test("names the Brand standard and the printed edition it rests on", async ({ page }) => {
    await page.goto(`/skriv?mode=passage&work=ibsen-brand&segment=${first.id}`);
    const attribution = page.getByTestId("attribution");
    await expect(attribution).toBeVisible();
    await expect(attribution).toContainText("Språklig bearbeidet etter Brand-standarden.");
    // The printed edition, quoted rather than summarised — and with it the year.
    await expect(attribution).toContainText(printed.replace(/\.$/, ""));
    await expect(attribution).toContainText(/\b(1[6-9]|20)\d{2}\b/);
  });

  test("does not claim adaptation when the original is what is being typed", async ({
    page,
  }) => {
    await page.goto(
      `/skriv?mode=passage&work=ibsen-brand&edition=ibsen-brand.original&segment=${first.id}`,
    );
    const attribution = page.getByTestId("attribution");
    await expect(attribution).toBeVisible();
    await expect(attribution).toContainText("Originaltekst, uendret.");
    await expect(attribution).not.toContainText("bearbeidet");
  });
});
