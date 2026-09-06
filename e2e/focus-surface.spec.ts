import { expect, test } from "@playwright/test";
import training from "../content/ibsen-brand/training-edition.v1.json";

/** A segment long enough to wrap past the visible line window. */
const long = [...training.segments].sort(
  (a, b) => b.text.length - a.text.length,
)[0];

test.describe("Writing surface focus", () => {
  test("the caret stays inside the line window as the text scrolls under it", async ({
    page,
  }) => {
    await page.goto(
      `/skriv?mode=passage&work=ibsen-brand&segment=${long.id}&filter=words-only`,
    );
    const input = page.getByTestId("typing-input");
    await input.focus();

    const caretInsideWindow = async () =>
      page.evaluate(() => {
        const caret = document.querySelector(".ch-cursor");
        const vp = document.querySelector(".typing-viewport");
        if (!caret || !vp) return null;
        const c = caret.getBoundingClientRect();
        const v = vp.getBoundingClientRect();
        return {
          inside: c.top >= v.top - 2 && c.bottom <= v.bottom + 2,
          delta: Math.round(c.top - v.top),
        };
      });

    expect((await caretInsideWindow())?.inside).toBe(true);

    // Type well past the visible window; the caret must never leave it.
    const target = (
      await page.getByTestId("typing-surface").innerText()
    ).trim();
    for (let i = 0; i < Math.min(target.length, 320); i += 1) {
      await page.keyboard.type(target[i]);
      if (i % 40 === 0) {
        const state = await caretInsideWindow();
        expect(
          state,
          `caret left the window after ${i} characters`,
        ).not.toBeNull();
        expect(
          state!.inside,
          `caret ${state!.delta}px from window top after ${i} chars`,
        ).toBe(true);
      }
    }
    const end = await caretInsideWindow();
    expect(end!.inside).toBe(true);
  });

  test("the surrounding interface recedes while typing and returns when it stops", async ({
    page,
  }) => {
    await page.goto(
      `/skriv?mode=passage&work=ibsen-brand&segment=${long.id}&filter=words-only`,
    );
    const header = page.locator("header");
    await expect(header).toHaveCSS("opacity", "1");

    await page.getByTestId("typing-input").focus();
    await page.keyboard.type("oppe i sneen");
    await expect(page.locator("html")).toHaveAttribute("data-typing", "on");
    await expect(header).not.toHaveCSS("opacity", "1");

    // Ending the session brings the interface back.
    await page.getByTestId("menu-button").click();
    await page.getByTestId("menu-finish").click();
    await expect(page).toHaveURL(/\/resultat\//);
    await expect(page.locator("header")).toHaveCSS("opacity", "1");
  });

  test("a pointer resting over the header does not defeat focus mode", async ({
    page,
  }) => {
    // Found by CI: the Linux runner reports the header as hovered from the
    // start, so the whole chrome stayed at full opacity for the entire session.
    // It reproduces anywhere the pointer happens to rest over a receding
    // region, which is exactly where it lands after clicking something in it.
    await page.goto(
      `/skriv?mode=passage&work=ibsen-brand&segment=${long.id}&filter=words-only`,
    );
    const header = page.locator("header");
    const box = await header.boundingBox();
    await page.mouse.move(box!.x + 5, box!.y + 5);
    expect(await header.evaluate((el) => el.matches(":hover"))).toBe(true);

    await page.getByTestId("typing-input").focus();
    await page.keyboard.type("oppe i sneen");
    await expect(page.locator("html")).toHaveAttribute("data-typing", "on");
    await expect(header).not.toHaveCSS("opacity", "1");
  });

  test("keyboard focus still brings a receded control back", async ({
    page,
  }) => {
    await page.goto(
      `/skriv?mode=passage&work=ibsen-brand&segment=${long.id}&filter=words-only`,
    );
    const header = page.locator("header");
    await page.getByTestId("typing-input").focus();
    await page.keyboard.type("oppe i sneen");
    await expect(header).not.toHaveCSS("opacity", "1");

    await header.getByRole("link", { name: "Historikk" }).focus();
    await expect(header).toHaveCSS("opacity", "1");
  });

  test("the prose is horizontally centred in the viewport", async ({
    page,
  }) => {
    await page.goto(
      `/skriv?mode=passage&work=ibsen-brand&segment=${long.id}&filter=as-printed`,
    );
    const box = await page.getByTestId("typing-surface").boundingBox();
    const width = page.viewportSize()!.width;
    expect(box).not.toBeNull();
    const leftGap = box!.x;
    const rightGap = width - (box!.x + box!.width);
    expect(Math.abs(leftGap - rightGap)).toBeLessThan(24);
  });
});

test("the prose itself shows whether the writing area has focus", async ({
  page,
}) => {
  await page.goto(
    "/skriv?mode=passage&work=ibsen-brand&segment=akt1-01&filter=as-printed",
  );
  const surface = page.getByTestId("typing-surface");
  const lines = page.locator(".typing-lines");
  const opacity = async () =>
    Number(await lines.evaluate((el) => getComputedStyle(el).opacity));

  // No box around the prose in either state — a literary page, not a form field.
  await expect(surface).toHaveCSS("outline-style", "none");

  await page.getByTestId("typing-input").blur();
  const resting = await opacity();

  await surface.click();
  await expect(page.getByTestId("typing-input")).toBeFocused();
  await expect(surface).toHaveCSS("outline-style", "none");
  await expect.poll(opacity).toBe(1);
  expect(resting).toBeLessThan(1);
});
