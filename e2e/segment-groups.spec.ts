import { expect, test, type Page } from "@playwright/test";
// The edition the chooser actually serves: the newest training edition of the
// pack. Following the default rather than pinning v2 is the point — this suite
// is about how a work with parts is listed, not about one version of one work.
import noveletter from "../content/kielland-noveletter/training-edition.v3.json";
import { waitForCompletedSegments } from "./support/progress";

/**
 * Q-007: the segment index is grouped by part, and only where there is one.
 *
 * `kielland-noveletter` is two novellas today and five after Q-006 — around four
 * hundred segments, which is why this exists at all. `ibsen-brand` is one act,
 * and must look exactly as it did: grouping one group is structure over
 * nothing, and Q-002 rejected it for that reason when it was true of every work.
 */
const PARTS = [...new Set(noveletter.segments.map((s) => (s as { part?: string }).part))];

async function groupTitles(page: Page): Promise<string[]> {
  await expect(page.getByTestId("segment-groups")).toBeVisible();
  return page.locator("[data-part]").evaluateAll((els) => els.map((e) => e.getAttribute("data-part")!));
}

test.describe("Segment groups", () => {
  for (const mode of ["passage", "nonstop"] as const) {
    test(`${mode}: a work with parts lists them as named groups, in reading order`, async ({
      page,
    }) => {
      await page.goto(`/velg/${mode}?work=kielland-noveletter`);
      expect(await groupTitles(page)).toEqual(PARTS);

      // Every segment is still there, still in the edition's own order — the
      // grouping must not drop or reorder a single one.
      const listed = await page
        .locator("a[data-segment-id]")
        .evaluateAll((els) => els.map((e) => e.getAttribute("data-segment-id")!));
      expect(listed).toEqual(noveletter.segments.map((s) => s.id));

      // The heading says what it contains, in words.
      await expect(page.locator(`[data-part="${PARTS[0]}"] h3`)).toContainText(PARTS[0]!);
    });
  }

  test("a work with one part is untouched: no groups, one flat list", async ({ page }) => {
    await page.goto("/velg/passage?work=ibsen-brand");
    await expect(page.locator("a[data-segment-id]").first()).toBeVisible();
    await expect(page.getByTestId("segment-groups")).toHaveCount(0);
    await expect(page.locator("[data-part]")).toHaveCount(0);
  });

  test("a group counts what is written in it, and the marks survive grouping", async ({
    page,
  }) => {
    await page.goto("/skriv?mode=nonstop&work=kielland-noveletter");
    const first = noveletter.segments[0];
    await page.getByTestId("typing-input").focus();
    for (const ch of Array.from(first.text)) {
      if (ch === "\n") await page.keyboard.press("Enter");
      else await page.keyboard.type(ch);
    }
    await waitForCompletedSegments(page, "kielland-noveletter", [first.id]);

    await page.goto("/velg/nonstop?work=kielland-noveletter");
    const written = noveletter.segments.filter(
      (s) => (s as { part?: string }).part === PARTS[0],
    ).length;
    await expect(page.locator(`[data-part="${PARTS[0]}"] h3`)).toContainText(
      `1 av ${written} skrevet`,
    );
    await expect(page.locator(`a[data-segment-id="${first.id}"]`)).toContainText("Skrevet");
    // The next part is untouched, and says so — counted from its own segments,
    // not from "everything else": the work has seven parts, not two.
    const next = noveletter.segments.filter(
      (s) => (s as { part?: string }).part === PARTS[1],
    ).length;
    await expect(page.locator(`[data-part="${PARTS[1]}"] h3`)).toContainText(`0 av ${next} skrevet`);
  });

  test("the groups do not scroll sideways at 375px", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 780 });
    await page.goto("/velg/passage?work=kielland-noveletter");
    await expect(page.getByTestId("segment-groups")).toBeVisible();
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
  });
});
