import { expect, test } from "@playwright/test";
import training from "../content/ibsen-brand/training-edition.v1.json";

const fixture = training.segments.find((s) => s.id === "akt1-08")!;

test.describe("Accessibility of the writing surface", () => {
  test("the text to type is reachable through the writing field's description", async ({
    page,
  }) => {
    await page.goto(
      `/skriv?mode=passage&work=ibsen-brand&segment=${fixture.id}&filter=as-printed`,
    );
    const input = page.getByTestId("typing-input");

    // The accessible description is what a screen reader reads on focus. It
    // must carry the actual passage, not just a label for the field.
    const described = await input.evaluate((el) => {
      const id = el.getAttribute("aria-describedby");
      if (!id) return null;
      return document.getElementById(id)?.textContent ?? null;
    });
    expect(described, "the writing field has no accessible description").not.toBeNull();
    expect(described).toContain(fixture.label!);
    // Compare on words: the description adds a sentence and the DOM collapses
    // the verse line breaks that the raw edition string carries.
    const words = (t: string) => t.replace(/\s+/g, " ").trim();
    expect(words(described!)).toContain(words(fixture.text));

    // The per-character rendering stays hidden, or it would be read letter by letter.
    await expect(page.locator(".typing-lines p").first()).toHaveAttribute("aria-hidden", "true");
  });

  test("progress is announced at segment granularity, not per keystroke", async ({ page }) => {
    await page.goto("/skriv?mode=nonstop&work=ibsen-brand&filter=as-printed");
    const announcement = page.getByTestId("progress-announcement");
    await expect(announcement).toHaveAttribute("aria-live", "polite");
    const before = await announcement.textContent();
    expect(before).toMatch(/1 av \d+/);

    await page.getByTestId("typing-input").focus();
    await page.keyboard.type("Oppe");
    // Typing inside a segment must not change what is announced.
    expect(await announcement.textContent()).toBe(before);
  });

  test("every interactive control on the writing page has an accessible name", async ({
    page,
  }) => {
    await page.goto(
      `/skriv?mode=passage&work=ibsen-brand&segment=${fixture.id}&filter=as-printed`,
    );
    const unnamed = await page.evaluate(() => {
      const nodes = [...document.querySelectorAll("button, a[href], textarea, select, input")];
      return nodes
        .filter((el) => {
          const aria = el.getAttribute("aria-label")?.trim();
          const labelled = el.getAttribute("aria-labelledby");
          const text = (el as HTMLElement).innerText?.trim();
          const closestLabel = el.closest("label")?.textContent?.trim();
          return !aria && !labelled && !text && !closestLabel;
        })
        .map((el) => el.outerHTML.slice(0, 80));
    });
    expect(unnamed).toEqual([]);
  });
});
