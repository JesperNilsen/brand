import { expect, test, type Page } from "@playwright/test";
import path from "node:path";
import training from "../content/ibsen-brand/training-edition.v1.json";

/**
 * Måling: «Detaljer» on the result page, from a session typed through the
 * real keyboard.
 *
 * The clock is installed so the session has a known length — long enough for
 * net WPM and jevnhet to exist (5 s) — without the test waiting it out. The
 * passage is the shortest one with 20 or more spaces, so at least one key
 * clears MIN_OPPORTUNITIES and the Treff/Fart toggle has a number to change.
 */
const fixture = training.segments.find((s) => s.id === "akt1-08")!;
const PASSAGE = `/skriv?mode=passage&work=ibsen-brand&segment=${fixture.id}&filter=as-printed`;

/** When set, the visual check saves its screenshots here. */
const SHOTS_DIR = process.env.MALING_SHOTS_DIR;

function collectConsoleErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") errors.push(msg.text());
  });
  page.on("pageerror", (err) => errors.push(err.message));
  return errors;
}

/**
 * Type the passage a key at a time, 150 ms apart, with one corrected slip.
 * Each space comes after a longer 400 ms, so the space is the one slow key.
 */
async function typePassage(page: Page) {
  const input = page.getByTestId("typing-input");
  await input.focus();
  const chars = Array.from(fixture.text);
  for (let i = 0; i < chars.length; i += 1) {
    if (i === 3) {
      await page.keyboard.type("x");
      await page.clock.runFor(150);
      await page.keyboard.press("Backspace");
      await page.clock.runFor(150);
    }
    const ch = chars[i];
    if (ch === " ") await page.clock.runFor(250);
    if (ch === "\n") await page.keyboard.press("Enter");
    else await page.keyboard.type(ch);
    await page.clock.runFor(150);
  }
}

async function finishPassage(page: Page) {
  await page.clock.install();
  await page.goto(PASSAGE);
  await expect(page.getByTestId("typing-surface")).toBeVisible();
  await typePassage(page);
  await page.clock.runFor(500);
  await expect(page).toHaveURL(/\/resultat\//);
  await expect(page.getByTestId("result")).toBeVisible();
}

async function openDetails(page: Page) {
  await page.getByTestId("result-details").locator("summary", { hasText: "Detaljer" }).click();
  await expect(page.getByTestId("raw-wpm")).toBeVisible();
}

test.describe("Result details (Måling)", () => {
  test("a typed passage shows its figures, its course and its keys", async ({ page }) => {
    const errors = collectConsoleErrors(page);
    await finishPassage(page);

    // Folded away until asked for.
    await expect(page.getByTestId("raw-wpm")).toBeHidden();
    await openDetails(page);

    for (const id of ["raw-wpm", "keystroke-accuracy", "consistency", "chars-correct", "chars-wrong"]) {
      await expect(page.getByTestId(id)).toHaveText(/^\d[\d\s,]*( %)?$/);
    }
    // One slip, corrected: every keystroke but one was right, and nothing wrong stood.
    await expect(page.getByTestId("keystroke-accuracy")).not.toHaveText("100 %");
    await expect(page.getByTestId("chars-wrong")).toHaveText("0");
    // A passage has a fixed end, so «ikke nådd» exists — and it was all reached.
    await expect(page.getByTestId("chars-missed")).toHaveText("0");

    // The chart's table ends on the number the page leads with.
    const chart = page.getByTestId("result-chart");
    await expect(chart.locator("svg[role='img'] desc")).toContainText("Netto WPM: slutter på");
    await chart.locator("summary", { hasText: "Som tabell" }).click();
    const lastRow = chart.locator("tbody tr").last();
    await expect(lastRow).toBeVisible();
    const net = (await page.getByTestId("net-wpm").textContent())!.trim();
    expect(net).toMatch(/^\d+$/);
    await expect(lastRow.locator("td").nth(1)).toHaveText(net);
    await expect(chart.locator("[data-mark]")).not.toHaveCount(0);

    // The keyboard map, and the toggle changes what the keys say.
    const map = page.getByTestId("keyboard-map");
    await expect(map.getByTestId("kbd-key")).toHaveCount(50);
    const space = map.locator("[data-testid='kbd-key'][data-key=' '] [data-testid='kbd-num']");
    const treff = (await space.textContent())!;
    expect(treff).toMatch(/^\d+$/);
    const before = await map.getByTestId("kbd-num").allTextContents();
    await map.locator("label", { hasText: "Fart" }).click();
    await expect(map.getByRole("radio", { name: "Fart" })).toBeChecked();
    await expect(map).toHaveAttribute("data-view", "fart");
    const after = await map.getByTestId("kbd-num").allTextContents();
    expect(after).not.toEqual(before);
    expect(await space.textContent()).not.toBe(treff);
    await expect(map.getByRole("group", { name: "Fart per tast" })).toBeVisible();

    // The second list under «Verdt å øve på»: the space, held back on every
    // press, is the slowest key against the session's own pace.
    const slow = page.getByTestId("slow-row");
    await expect(slow.first()).toContainText("mellomrom");
    // The ratio is about 2 but not exact: the installed clock also runs in real
    // time, so it drifts with the machine. nb-NO drops a trailing zero, so 2,0
    // is written «2», and a slower runner can land just under it.
    await expect(slow.first()).toContainText(/4\d\d ms — [12](,\d)? ganger snittet, av \d+/);

    expect(errors, errors.join("\n")).toEqual([]);
  });

  test("a pause in Timed does not shorten the run", async ({ page }) => {
    const errors = collectConsoleErrors(page);
    await page.clock.install();
    await page.goto("/skriv?mode=timed&work=ibsen-brand&limit=60000");
    const input = page.getByTestId("typing-input");
    await input.focus();
    await page.keyboard.type(training.segments[0].text.slice(0, 12));
    await page.clock.runFor(5_000);

    await page.getByTestId("menu-button").click();
    await expect(page.getByTestId("session-menu")).toBeVisible();
    await page.clock.runFor(30_000);
    await page.getByTestId("menu-resume").click();
    await expect(page.getByTestId("session-menu")).toHaveCount(0);

    // 75 s on the wall clock, 50 s of it typing: the run is not over.
    await page.clock.runFor(45_000);
    await expect(page).toHaveURL(/\/skriv/);
    await expect(page.getByTestId("typing-surface")).toBeVisible();

    await page.clock.runFor(11_000);
    await expect(page).toHaveURL(/\/resultat\//);
    const result = page.getByTestId("result");
    await expect(result).toContainText("1 min 0 s");
    await expect(page.getByTestId("paused-notice")).toContainText("Pauset 1 gang");
    // «En gang til» offers the same limit, not the default it used to fall back to.
    await expect(page.getByRole("link", { name: "En gang til" })).toHaveAttribute(
      "href",
      /limit=60000/,
    );

    await openDetails(page);
    // Timed has no fixed end, so there is nothing to fall short of.
    await expect(page.getByTestId("chars-missed")).toHaveCount(0);
    const chart = page.getByTestId("result-chart");
    await chart.locator("summary", { hasText: "Som tabell" }).click();
    await expect(chart.locator("tbody tr").last().locator("td").first()).toHaveText("1:00");

    expect(errors, errors.join("\n")).toEqual([]);
  });

  test("a session from before schema 6 says it was not measured", async ({ page }) => {
    const errors = collectConsoleErrors(page);
    // /historikk opens the repository, so the stores exist before the seed.
    await page.goto("/historikk");
    await expect(page.getByText("Ingen økter ennå.")).toBeVisible();
    await page.evaluate(
      () =>
        new Promise<void>((resolve, reject) => {
          const open = indexedDB.open("brand");
          open.onerror = () => reject(open.error);
          open.onsuccess = () => {
            const db = open.result;
            const tx = db.transaction("sessions", "readwrite");
            tx.objectStore("sessions").put({
              id: "schema-5",
              schemaVersion: 5,
              startedAt: "2026-10-01T10:00:00.000Z",
              completedAt: "2026-10-01T10:02:00.000Z",
              status: "completed",
              gameModeId: "passage",
              languageProfileId: "brand-riksmaal",
              contentPackId: "ibsen-brand",
              workId: "ibsen-brand",
              editionId: "ibsen-brand.training.v1",
              editionVersion: "1.0.0",
              editionContentHash: `sha256:${"0".repeat(64)}`,
              segmentIds: ["akt1-01"],
              errorMode: "flow",
              textFilterId: "as-printed",
              durationMs: 120_000,
              pausedMs: 0,
              pauseCount: 0,
              targetCharacterCount: 500,
              typedCharacterCount: 500,
              correctCharacterCount: 495,
              errorCount: 7,
              grossWpm: 50,
              netWpm: 49.5,
              accuracy: 0.99,
              misses: [],
              opportunities: [],
            });
            tx.oncomplete = () => {
              db.close();
              resolve();
            };
            tx.onerror = () => reject(tx.error);
          };
        }),
    );
    await page.goto("/resultat/schema-5");
    await expect(page.getByTestId("net-wpm")).toHaveText("50");
    await page.getByTestId("result-details").locator("summary", { hasText: "Detaljer" }).click();
    await expect(page.getByTestId("details-unmeasured")).toHaveText("Ikke målt for denne økten.");
    await expect(page.getByTestId("raw-wpm")).toHaveCount(0);
    await expect(page.getByTestId("result-chart")).toHaveCount(0);
    await expect(page.getByTestId("keyboard-map")).toHaveCount(0);
    expect(errors, errors.join("\n")).toEqual([]);
  });

  test("Detaljer fits a phone and a desktop, light and dark", async ({ page }) => {
    const errors = collectConsoleErrors(page);
    await finishPassage(page);
    await openDetails(page);
    const details = page.getByTestId("result-details");

    for (const scheme of ["light", "dark"] as const) {
      for (const width of [1280, 375]) {
        await page.emulateMedia({ colorScheme: scheme });
        await page.setViewportSize({ width, height: 900 });
        // The chart measures its own width; let it settle on the new one.
        await expect
          .poll(() =>
            details.locator("figure svg").evaluate((svg, w) => {
              const fig = svg.parentElement!;
              return Math.abs(svg.getBoundingClientRect().width - fig.clientWidth) <= 1 && w > 0;
            }, width),
          )
          .toBe(true);

        // Sideways scrolling of the page, and any box inside Detaljer whose
        // content runs out of it — a label wider than its grid cell, three
        // digits wider than their key — which the page-level check cannot see.
        const overflow = await details.evaluate((root) => {
          const page = document.documentElement.scrollWidth - window.innerWidth;
          const boxes = [...root.querySelectorAll<HTMLElement>("*")]
            .filter(
              (el) =>
                el.clientWidth > 0 &&
                getComputedStyle(el).overflowX === "visible" &&
                el.scrollWidth > el.clientWidth + 1,
            )
            .map((el) => `${el.tagName.toLowerCase()} «${el.textContent?.slice(0, 24)}»`);
          return { page, boxes };
        });
        expect(overflow.page, `${scheme} ${width}px scrolls sideways`).toBeLessThanOrEqual(0);
        expect(overflow.boxes, `${scheme} ${width}px: content runs out of its box`).toEqual([]);

        const bg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
        expect(bg).toBe(scheme === "dark" ? "rgb(23, 22, 20)" : "rgb(247, 243, 236)");

        if (SHOTS_DIR) {
          await details.screenshot({
            path: path.join(SHOTS_DIR, `maling-details-${scheme}-${width}.png`),
          });
          if (scheme === "light" && width === 375) {
            await page.getByTestId("practice-focus").screenshot({
              path: path.join(SHOTS_DIR, "maling-focus-light-375.png"),
            });
          }
        }
      }
    }
    expect(errors, errors.join("\n")).toEqual([]);
  });
});
