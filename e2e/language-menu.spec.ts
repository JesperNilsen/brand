import { expect, test, type Page } from "@playwright/test";

/**
 * The language menu (D21): Brandmål and Bokmål in the list, the bokmål norms
 * behind a gear, the choice kept across a reload.
 */

const trigger = (page: Page) => page.getByTestId("language-menu-trigger");

async function openMenu(page: Page) {
  await trigger(page).click();
  await expect(page.getByTestId("language-menu")).toBeVisible();
}

test.describe("Language menu", () => {
  test("a plain tap on Bokmål chooses it without opening the norms", async ({ page }) => {
    await page.goto("/");
    await expect(trigger(page)).toHaveText(/Brandmål/);
    await openMenu(page);
    await expect(page.getByRole("radio", { name: /Brandmål/ })).toBeChecked();

    await page.getByTestId("language-option-bokmal").click();
    await expect(page.getByRole("radio", { name: /Bokmål/ })).toBeChecked();
    await expect(page.getByTestId("norm-list-bokmal")).toHaveCount(0);
    // Modern bokmål is the default norm, so the trigger names only the language.
    await expect(trigger(page)).toHaveText(/^Språk: Bokmål/);
  });

  test("the gear opens the bokmål norms, and the choice survives a reload", async ({ page }) => {
    await page.goto("/");
    await openMenu(page);
    await page.getByRole("button", { name: "Velg bokmålsnorm" }).click();

    const list = page.getByTestId("norm-list-bokmal");
    await expect(list.getByRole("radio")).toHaveCount(7);
    await expect(list.getByRole("radio", { name: /Moderne bokmål/ })).toBeChecked();
    await expect(list.getByRole("radio", { name: /Moderne bokmål/ })).toBeFocused();
    await expect(page.getByTestId("norm-option-bokmal-1907")).toContainText("historisk");

    await page.getByTestId("norm-option-bokmal-1938").click();
    await expect(trigger(page)).toHaveText(/Bokmål 1938/);

    await page.reload();
    await expect(trigger(page)).toHaveText(/Bokmål 1938/);
    await openMenu(page);
    await expect(page.getByRole("radio", { name: /Bokmål/ })).toBeChecked();
    await page.getByRole("button", { name: "Velg bokmålsnorm" }).click();
    await expect(page.getByTestId("norm-list-bokmal").getByRole("radio", { name: /Bokmål 1938/ })).toBeChecked();
  });

  test("Brandmål and back to Bokmål returns to the norm last chosen", async ({ page }) => {
    await page.goto("/");
    await openMenu(page);
    await page.getByRole("button", { name: "Velg bokmålsnorm" }).click();
    await page.getByTestId("norm-option-bokmal-1917").click();
    await page.getByTestId("language-option-brandmal").click();
    await expect(trigger(page)).toHaveText(/Brandmål/);
    await page.getByTestId("language-option-bokmal").click();
    await expect(trigger(page)).toHaveText(/Riksmål 1917/);
  });

  test("Escape closes the menu and returns focus to its button", async ({ page }) => {
    await page.goto("/");
    await openMenu(page);
    await page.keyboard.press("Escape");
    await expect(page.getByTestId("language-menu")).toHaveCount(0);
    await expect(trigger(page)).toBeFocused();
  });

  test("a reader's stored preferences from before the menu read as Brandmål, untouched", async ({
    page,
  }) => {
    await page.addInitScript(() => {
      if (sessionStorage.getItem("seeded")) return;
      sessionStorage.setItem("seeded", "1");
      localStorage.setItem(
        "brand.preferences",
        JSON.stringify({
          schemaVersion: 1,
          theme: "dark",
          languageProfileId: "brand-riksmaal",
          defaultErrorMode: "flow",
          textFilterId: "words-only",
        }),
      );
    });
    await page.goto("/");
    await expect(trigger(page)).toHaveText(/Brandmål/);
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    await openMenu(page);
    await page.getByTestId("language-option-bokmal").click();
    const stored = await page.evaluate(() => JSON.parse(localStorage.getItem("brand.preferences")!));
    expect(stored).toMatchObject({
      theme: "dark",
      languageProfileId: "brand-riksmaal",
      textFilterId: "words-only",
      writingLanguageId: "bokmal",
    });
  });

  test("the orthography page follows the chosen norm and says what Brand can check", async ({
    page,
  }) => {
    await page.goto("/rettskrivning");
    await expect(page.getByTestId("orthography-title")).toHaveText("Brandmål");
    await expect(page.getByTestId("orthography-cue")).toContainText("boka");
    await page.getByTestId("orthography-answer").fill("boken");
    await page.getByTestId("orthography-submit").click();
    await expect(page.getByTestId("orthography-feedback")).toContainText("Godkjent");
    await expect(page.getByTestId("orthography-feedback")).toContainText("foretrukket");

    await openMenu(page);
    await page.getByTestId("language-option-bokmal").click();
    await expect(page.getByTestId("orthography-title")).toHaveText("Moderne bokmål");
    await expect(page.getByTestId("orthography-status")).toContainText(/støttet/);
  });

  test("the chooser says the text is not normalised to a chosen bokmål norm", async ({ page }) => {
    await page.goto("/velg/passage?work=ibsen-brand");
    await expect(page.getByTestId("edition-norm-note")).toHaveCount(0);
    await openMenu(page);
    await page.getByTestId("language-option-bokmal").click();
    await expect(page.getByTestId("edition-norm-note")).toContainText(
      "Ingen tekst er ennå normert etter Moderne bokmål",
    );
  });
});
