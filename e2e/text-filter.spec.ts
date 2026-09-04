import { expect, test, type Page } from "@playwright/test";
import training from "../content/ibsen-brand/training-edition.v1.json";

/**
 * A golden fixture, not a second implementation of the transform.
 *
 * An earlier version of this file recomputed the words-only transform in the
 * test and compared that to the app. That passes whenever both sides share a
 * misunderstanding, and it fails whenever the transform is corrected, which is
 * exactly backwards. The expected strings below are literal: if the transform
 * changes, this test fails and a human decides whether the new output is right.
 * Exhaustive transform behaviour is unit-tested in tests/domain/text-filter.test.ts.
 */
const FIXTURE_SEGMENT_ID = "akt1-08";
const EXPECTED = {
  "as-printed":
    "BONDEN.\nJa, det var lenge før ifjor; -\nda hendte der så mangt et under;\ndet går ei slik til nuomstunder.\nBRAND.\nFar hjem. Ditt liv er dødens vei.\nDu vet ei Gud og Gud ei deg.\nBONDEN.\nHu, du er hård!",
  "no-punctuation":
    "BONDEN\nJa det var lenge før ifjor\nda hendte der så mangt et under\ndet går ei slik til nuomstunder\nBRAND\nFar hjem Ditt liv er dødens vei\nDu vet ei Gud og Gud ei deg\nBONDEN\nHu du er hård",
  "words-only":
    "bonden ja det var lenge før ifjor da hendte der så mangt et under det går ei slik til nuomstunder brand far hjem ditt liv er dødens vei du vet ei gud og gud ei deg bonden hu du er hård",
} as const;

const fixture = training.segments.find((s) => s.id === FIXTURE_SEGMENT_ID)!;

test.beforeAll(() => {
  // Guards the fixture: an edition edit that changes this segment must fail
  // loudly here rather than silently weakening every assertion below.
  expect(fixture, `segment ${FIXTURE_SEGMENT_ID} missing from the edition`).toBeTruthy();
  expect(fixture.text).toBe(EXPECTED["as-printed"]);
});

async function typeText(page: Page, text: string) {
  await page.getByTestId("typing-input").focus();
  for (const ch of Array.from(text)) {
    if (ch === "\n") await page.keyboard.press("Enter");
    else await page.keyboard.type(ch);
  }
}

test.describe("Text filter", () => {
  test("choosing 'Bare ord' renders the expected text and the choice survives a reload", async ({
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

    await page.reload();
    await expect(page.getByRole("radio", { name: "Bare ord" })).toBeChecked();

    await page.getByRole("link", { name: new RegExp(fixture.label!) }).click();
    await expect(page).toHaveURL(/filter=words-only/);

    const rendered = (await page.getByTestId("typing-surface").innerText()).trim();
    expect(rendered).toBe(EXPECTED["words-only"]);
    await expect(page.getByText("Bare ord")).toBeVisible();
  });

  test("'Uten tegnsetting' keeps capitals and verse lines", async ({ page }) => {
    await page.goto(
      `/skriv?mode=passage&work=ibsen-brand&segment=${FIXTURE_SEGMENT_ID}&filter=no-punctuation`,
    );
    const rendered = (await page.getByTestId("typing-surface").innerText()).trim();
    expect(rendered).toBe(EXPECTED["no-punctuation"]);
  });

  test("a filtered session is typed, stored and marked as not comparable", async ({ page }) => {
    await page.goto(
      `/skriv?mode=passage&work=ibsen-brand&segment=${FIXTURE_SEGMENT_ID}&filter=words-only`,
    );
    await typeText(page, EXPECTED["words-only"]);

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
    await expect(asPrinted).toBeEnabled();
    await asPrinted.focus();
    await expect(asPrinted).toBeFocused();
    await page.keyboard.press("ArrowRight");
    await expect(page.getByRole("radio", { name: "Uten tegnsetting" })).toBeChecked();
    await page.keyboard.press("ArrowRight");
    await expect(page.getByRole("radio", { name: "Bare ord" })).toBeChecked();
  });

  test("'Som trykt' leaves the edition text untouched and is not marked", async ({ page }) => {
    await page.goto(
      `/skriv?mode=passage&work=ibsen-brand&segment=${FIXTURE_SEGMENT_ID}&filter=as-printed`,
    );
    const rendered = (await page.getByTestId("typing-surface").innerText()).trim();
    expect(rendered).toBe(EXPECTED["as-printed"]);
    await typeText(page, EXPECTED["as-printed"]);
    await expect(page).toHaveURL(/\/resultat\//);
    await expect(page.getByTestId("result")).not.toContainText("kan ikke sammenlignes");
  });

  test("a choice made before preferences load is not undone by them", async ({ page }) => {
    await page.goto("/velg/passage?work=ibsen-brand");
    await page.getByText("Bare ord", { exact: true }).click();
    // The stored read resolves asynchronously; the user's newer choice wins.
    await page.waitForTimeout(300);
    await expect(page.getByRole("radio", { name: "Bare ord" })).toBeChecked();
    await page.reload();
    await expect(page.getByRole("radio", { name: "Bare ord" })).toBeChecked();
  });
});

test("the selected choice is visually distinguishable from the others", async ({ page }) => {
  await page.goto("/velg/timed?work=ibsen-brand");
  const label = (name: string) =>
    page.locator("label").filter({ hasText: new RegExp(`^${name}$`) });
  const colorOf = (name: string) =>
    label(name).evaluate((el) => getComputedStyle(el).borderColor);

  await label("Bare ord").click();
  const selected = await colorOf("Bare ord");
  const unselected = await colorOf("Som trykt");
  expect(selected).not.toBe(unselected);

  // The same segmented-choice styling must work for the time limit too.
  await label("2:00").click();
  expect(await colorOf("2:00")).not.toBe(await colorOf("1:00"));
});
