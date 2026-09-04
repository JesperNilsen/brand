import { expect, test, type Page } from "@playwright/test";
import training from "../content/ibsen-brand/training-edition.v1.json";

const shortSegment = [...training.segments].sort(
  (a, b) => a.text.length - b.text.length,
)[0];

/** The same transform the app applies for "Bare ord". */
function wordsOnly(text: string): string {
  return text
    .replace(/\n/g, " ")
    .replace(/[^\p{L}\p{N}\s'’-]/gu, "")
    .replace(/(^|\s)[-'’]+(?=\s|$)/gu, "$1")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

async function typeText(page: Page, text: string) {
  await page.getByTestId("typing-input").focus();
  for (const ch of Array.from(text)) {
    if (ch === "\n") await page.keyboard.press("Enter");
    else await page.keyboard.type(ch);
  }
}

test.describe("Text filter", () => {
  test("choosing 'Bare ord' strips capitals, punctuation and line breaks, and the choice survives a reload", async ({
    page,
  }) => {
    await page.goto("/velg/passage?work=ibsen-brand");
    await expect(page.getByText("Tekstform")).toBeVisible();

    // The radio is visually hidden inside its label, so the label is the click
    // target a real user hits; clicking the input itself is intercepted by it.
    await page.getByText("Bare ord", { exact: true }).click();
    await expect(page.getByRole("radio", { name: "Bare ord" })).toBeChecked();
    await expect(
      page.getByText("Små bokstaver, ingen tegnsetting, linjeskift blir mellomrom."),
    ).toBeVisible();

    // The stored preference survives a reload of the chooser.
    await page.reload();
    await expect(page.getByRole("radio", { name: "Bare ord" })).toBeChecked();

    await page.getByRole("link", { name: new RegExp(shortSegment.label!) }).click();
    await expect(page).toHaveURL(/filter=words-only/);

    const rendered = (await page.getByTestId("typing-surface").innerText()).trim();
    expect(rendered).toBe(wordsOnly(shortSegment.text));
    expect(rendered).not.toMatch(/[A-ZÆØÅ]/);
    expect(rendered).not.toMatch(/[.,;:!?]/);
    expect(rendered).not.toContain("\n");
    await expect(page.getByText("Bare ord")).toBeVisible();
  });

  test("a filtered session is typed, stored and marked as not comparable", async ({ page }) => {
    await page.goto(
      `/skriv?mode=passage&work=ibsen-brand&segment=${shortSegment.id}&filter=words-only`,
    );
    const target = wordsOnly(shortSegment.text);
    await typeText(page, target);

    await expect(page).toHaveURL(/\/resultat\//);
    const result = page.getByTestId("result");
    await expect(result).toContainText("Bare ord");
    await expect(result).toContainText("kan ikke sammenlignes direkte");
    await expect(page.getByTestId("accuracy")).toHaveText(/100/);

    await page.goto("/historikk");
    const table = page.getByTestId("history-table");
    await expect(table).toContainText("Tekstform");
    await expect(table).toContainText("Bare ord");
  });

  test("the filter group is operable with the keyboard alone", async ({ page }) => {
    await page.goto("/velg/passage?work=ibsen-brand");
    const asPrinted = page.getByRole("radio", { name: "Som trykt" });
    await asPrinted.focus();
    await expect(asPrinted).toBeFocused();
    await page.keyboard.press("ArrowRight");
    await expect(page.getByRole("radio", { name: "Uten tegnsetting" })).toBeChecked();
    await page.keyboard.press("ArrowRight");
    await expect(page.getByRole("radio", { name: "Bare ord" })).toBeChecked();
    await expect(
      page.getByText("Små bokstaver, ingen tegnsetting, linjeskift blir mellomrom."),
    ).toBeVisible();
  });

  test("'Som trykt' leaves the edition text untouched and is not marked", async ({ page }) => {
    await page.goto(
      `/skriv?mode=passage&work=ibsen-brand&segment=${shortSegment.id}&filter=as-printed`,
    );
    const rendered = (await page.getByTestId("typing-surface").innerText()).trim();
    expect(rendered).toBe(shortSegment.text.trim());
    await typeText(page, shortSegment.text);
    await expect(page).toHaveURL(/\/resultat\//);
    await expect(page.getByTestId("result")).not.toContainText("kan ikke sammenlignes");
  });
});
