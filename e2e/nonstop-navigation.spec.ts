/**
 * The Nonstop chooser lists every segment, so a reader can open a particular
 * passage of the book they are on instead of only continuing where they
 * stopped.
 *
 * Two of the six assertions below actually bite, and they are the reason this
 * file exists rather than a smoke test. Passage mode has listed segments since
 * V1, so any selector that merely finds "a list of segment links somewhere"
 * finds one today and asserts nothing. What is new is (a) the completed marks
 * and (b) that a jump does not rewrite progress — opening segment 5 directly
 * and finishing it must mark 5 and leave 2-4 alone. Progress is a set of
 * completed segments, not a high-water mark, and the easiest way to build this
 * feature is to quietly turn it into one.
 */
import { expect, test, type Page } from "@playwright/test";
import training from "../content/ibsen-brand/training-edition.v1.json";
import { waitForCompletedSegments } from "./support/progress";

const segments = [...training.segments].sort((a, b) => a.order - b.order);
const CHOOSER = "/velg/nonstop?work=ibsen-brand";

async function typeSegment(page: Page, text: string) {
  await page.getByTestId("typing-input").focus();
  for (const ch of Array.from(text)) {
    if (ch === "\n") await page.keyboard.press("Enter");
    else await page.keyboard.type(ch);
  }
}

/** Every segment link on the page, in document order. */
async function listedIds(page: Page): Promise<string[]> {
  const links = page.locator("a[data-segment-id]");
  await expect(links.first()).toBeVisible();
  return links.evaluateAll((els) => els.map((e) => e.getAttribute("data-segment-id")!));
}

/** Which segments the chooser currently shows as written, in edition order. */
async function markedDone(page: Page): Promise<string[]> {
  const links = page.locator("a[data-segment-id][data-done]");
  await expect(links.first()).toBeVisible();
  const rows = await links.evaluateAll((els) =>
    els.map((e) => ({
      id: e.getAttribute("data-segment-id")!,
      done: e.getAttribute("data-done") === "true",
    })),
  );
  return rows.filter((r) => r.done).map((r) => r.id);
}

/**
 * Assert the chooser shows exactly these segments as written.
 *
 * The wait is on the STORE, not on the page. Progress is written by
 * `onSegmentComplete` and nothing awaits it, so navigating the moment the
 * interface says the segment advanced can beat the write — the page unloads
 * mid-transaction and the record is lost for good. Reloading the chooser
 * afterwards cannot recover it: this file's first version retried the
 * navigation instead of waiting for the write, and went red roughly one full
 * run in three, on whichever test happened to lose the race. That is T-15
 * exactly, one file over.
 */
async function expectMarkedDone(page: Page, ids: string[]) {
  await waitForCompletedSegments(page, "ibsen-brand", ids);
  await page.goto(CHOOSER);
  expect(await markedDone(page)).toEqual(ids);
}

test.describe("Nonstop index", () => {
  test("lists every segment in order, labelled as Passage labels them", async ({ page }) => {
    await page.goto(CHOOSER);
    // Every segment, in the edition's own order — not merely "a list somewhere".
    expect(await listedIds(page)).toEqual(segments.map((s) => s.id));
    for (const s of segments) {
      await expect(page.getByRole("link", { name: new RegExp(escapeRe(s.label!)) })).toBeVisible();
    }
  });

  test("continuing stays the primary action and stays first", async ({ page }) => {
    await page.goto(CHOOSER);
    const primary = page.locator("a.btn-primary");
    await expect(primary).toHaveCount(1);
    await expect(primary).toHaveText(/Begynn|Fortsett/);
    // Wait for the list before comparing positions with it. The segments arrive
    // with the fetched edition text, and `page.evaluate` does not retry: on a
    // loaded runner the index was simply not there yet, and "no segment link"
    // read as "the primary action is not first" — a red that says the opposite
    // of what happened. This went red in CI on a docs-only pull request.
    await expect(page.locator("a[data-segment-id]").first()).toBeVisible();
    // First in the document, before any segment link: the default route for a
    // reader who just wants to continue must not have moved.
    const primaryFirst = await page.evaluate(() => {
      const p = document.querySelector("a.btn-primary");
      const s = document.querySelector("a[data-segment-id]");
      return !!p && !!s && !!(p.compareDocumentPosition(s) & Node.DOCUMENT_POSITION_FOLLOWING);
    });
    expect(primaryFirst).toBe(true);
  });

  test("segments already written are marked, and not by colour alone", async ({ page }) => {
    await page.goto(CHOOSER);
    expect(await markedDone(page)).toEqual([]);

    await page.goto("/skriv?mode=nonstop&work=ibsen-brand");
    await typeSegment(page, segments[0].text);
    await expect(page.getByTestId("session-meta")).toContainText(/2 av \d+/);

    await expectMarkedDone(page, [segments[0].id]);
    // The mark has to survive a monochrome screen and a screen reader, so it
    // must be in the accessible name — not a class, not a colour.
    const row = page.locator(`a[data-segment-id="${segments[0].id}"]`);
    await expect(row).toContainText("Skrevet");
    await expect(page.locator(`a[data-segment-id="${segments[1].id}"]`)).not.toContainText(
      "Skrevet",
    );
  });

  test("opening a segment from the index starts there, and does not rewrite progress", async ({
    page,
  }) => {
    // Write segment 1 the ordinary way, so there is real progress to protect.
    await page.goto("/skriv?mode=nonstop&work=ibsen-brand");
    await typeSegment(page, segments[0].text);
    await expect(page.getByTestId("session-meta")).toContainText(/2 av \d+/);

    await expectMarkedDone(page, [segments[0].id]);

    // Jump straight to segment 5. The stored resume point says 2; the explicit
    // choice must win, or every link in the index leads to the same place.
    await page.locator(`a[data-segment-id="${segments[4].id}"]`).click();
    await expect(page.getByTestId("session-meta")).toContainText(/5 av \d+/);
    await expect(page.getByTestId("session-meta")).toContainText(segments[4].label!);

    await typeSegment(page, segments[4].text);
    await expect(page.getByTestId("session-meta")).toContainText(/6 av \d+/);

    // 1 and 5 written; 2, 3 and 4 untouched. A high-water mark would show all
    // five, and losing 1 would mean the jump had replaced the record instead
    // of adding to it.
    await expectMarkedDone(page, [segments[0].id, segments[4].id]);
    await expect(page.getByText(/Du har skrevet 2 av/)).toBeVisible();
  });

  test("continuing after a jump goes to the first unwritten segment, not the furthest", async ({
    page,
  }) => {
    await page.goto(CHOOSER);
    await page.locator(`a[data-segment-id="${segments[4].id}"]`).click();
    await typeSegment(page, segments[4].text);
    await expect(page.getByTestId("session-meta")).toContainText(/6 av \d+/);

    await expectMarkedDone(page, [segments[4].id]);
    await page.getByRole("link", { name: "Fortsett" }).click();
    await expect(page.getByTestId("session-meta")).toContainText(/1 av \d+/);
  });

  test("the index is keyboard-reachable and does not scroll sideways at 375px", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 375, height: 780 });
    await page.goto(CHOOSER);
    await expect(page.locator("a[data-segment-id]").first()).toBeVisible();

    // Same bar the history list is held to: nothing may push the page wide.
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);

    // Every segment link has to be a real, named, focusable control — the rule
    // e2e/accessibility.spec.ts holds the writing page to.
    const unnamed = await page.locator("a[data-segment-id]").evaluateAll((els) =>
      els.filter((e) => (e.textContent ?? "").trim().length === 0).length,
    );
    expect(unnamed).toBe(0);
    const focused = await page.evaluate(() => {
      const el = document.querySelector<HTMLElement>("a[data-segment-id]")!;
      el.focus();
      return document.activeElement === el;
    });
    expect(focused).toBe(true);
  });
});

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
