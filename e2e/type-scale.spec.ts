import { expect, test } from "@playwright/test";

/**
 * T-14: the scale in DESIGN.md is what the browser actually renders.
 *
 * `check:design` proves the components name the tokens and that the document's
 * counts are true. It cannot prove the names resolve: `text-headnig` is a
 * class that generates nothing, and the heading would quietly inherit body
 * size — a mechanical migration's characteristic failure, invisible in a diff
 * and invisible to a static gate.
 *
 * Root is 17px, so a token in rem lands on these pixel values.
 */
const EXPECTED = {
  title: 17 * 1.9,
  heading: 17 * 1.5,
  section: 17 * 1.25,
  lead: 17 * 1.125,
};

async function fontSize(page: import("@playwright/test").Page, selector: string) {
  return page
    .locator(selector)
    .first()
    .evaluate((el) => Number.parseFloat(getComputedStyle(el).fontSize));
}

test("the headings render at the sizes DESIGN.md declares", async ({ page }) => {
  await page.goto("/");
  expect(await fontSize(page, "h1")).toBeCloseTo(EXPECTED.title, 1);
  expect(await fontSize(page, "a.card span")).toBeCloseTo(EXPECTED.lead, 1);

  await page.goto("/om");
  expect(await fontSize(page, "h1")).toBeCloseTo(EXPECTED.heading, 1);
  expect(await fontSize(page, "h2")).toBeCloseTo(EXPECTED.section, 1);
});
