import { expect, test, type Page } from "@playwright/test";

/**
 * Q-004: a reader who has never been here starts writing without choosing a
 * book first.
 *
 * The assertions that bite are the last two. "A button exists" is trivially
 * true the moment the branch is added; what is not trivial is that a finished
 * drill is stored and marked as not comparable to a passage, and that two
 * starts do not serve the same pieces in the same order.
 */

/**
 * The piece currently on screen.
 *
 * Read from the description the writing field points at — the same plain copy
 * of the target a screen reader gets — because a drill's text is drawn at
 * random and no fixture can name it in advance.
 */
async function targetText(page: Page): Promise<string> {
  const input = page.getByTestId("typing-input");
  await expect(input).toBeVisible();
  const id = await input.getAttribute("aria-describedby");
  expect(id).toBeTruthy();
  const described = ((await page.locator(`#${id}`).textContent()) ?? "").trim();
  const marker = "Skriv denne teksten: ";
  expect(described).toContain(marker);
  return described.slice(described.indexOf(marker) + marker.length).trim();
}

async function typeText(page: Page, text: string) {
  await page.getByTestId("typing-input").focus();
  for (const ch of Array.from(text)) {
    if (ch === "\n") await page.keyboard.press("Enter");
    else await page.keyboard.type(ch);
  }
}

test.describe("Drill", () => {
  test("the landing page starts a first-time reader writing, with no chooser", async ({
    page,
  }) => {
    await page.goto("/");
    const cta = page.getByTestId("home-drill");
    await expect(cta).toBeVisible();

    // The primary slot, and only one of them: the mode grid below is a list of
    // choices, and this is the way past having to make one.
    await expect(page.locator("a.btn-primary")).toHaveCount(1);
    await cta.click();

    await expect(page).toHaveURL(/\/skriv\?.*mode=drill/);
    await expect(page.getByTestId("session-meta")).toContainText(/1 av 10/);
    // No chooser page for the mode, either — not choosing is the mode.
    const notFound = await page.goto("/velg/drill");
    expect(notFound?.status()).toBe(404);
  });

  test("a returning reader still lands on Fortsett, not on the drill", async ({ page }) => {
    // The slot this feature takes is the FALLBACK — the chooser a first-time
    // reader used to meet. Taking the other branch too would replace continue,
    // which is what almost everyone comes back for, and that is a regression
    // rather than this feature.
    await page.goto("/skriv?mode=passage&work=ibsen-brand&segment=akt1-08");
    await page.getByTestId("typing-input").focus();
    await page.keyboard.type("Far");
    await page.goto("/");

    const primary = page.locator("a.btn-primary");
    await expect(primary).toHaveCount(1);
    await expect(primary).toHaveText("Fortsett");
    await expect(page.getByTestId("home-drill")).toHaveCount(0);
  });

  test("a finished drill is stored, and marked as not comparable to a passage", async ({
    page,
  }) => {
    await page.goto("/skriv?mode=drill&work=ibsen-brand");
    await typeText(page, await targetText(page));
    await expect(page.getByTestId("session-meta")).toContainText(/2 av 10/);

    await page.getByTestId("menu-button").click();
    await page.getByTestId("menu-finish").click();
    await expect(page).toHaveURL(/\/resultat\//);

    // Stored, with numbers. WPM itself stays a dash here — a session this
    // short is provisional by design, and that rule is not a drill rule.
    await expect(page.getByTestId("result")).toContainText("Kortform");
    await expect(page.getByTestId("accuracy")).toContainText("%");
    // And honest about what they are: ten short pieces are not a passage, and
    // the page has to say so rather than let the number stand beside one.
    await expect(page.getByTestId("drill-notice")).toBeVisible();

    await page.goto("/historikk");
    await expect(page.getByTestId("history-table")).toContainText("Kortform");
  });

  test("two starts do not serve the same piece first", async ({ page }) => {
    // Repeat without repetition. Four starts: the first piece is drawn from a
    // bank of dozens, so four identical draws is not a flake, it is a mode that
    // serves the same session every time.
    const first: string[] = [];
    for (let i = 0; i < 4; i += 1) {
      await page.goto(`/skriv?mode=drill&work=ibsen-brand&t=${i}`);
      first.push(await targetText(page));
    }
    expect(new Set(first).size).toBeGreaterThan(1);
  });
});
