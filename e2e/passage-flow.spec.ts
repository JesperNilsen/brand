import { expect, test, type Page } from "@playwright/test";
import training from "../content/ibsen-brand/training-edition.v1.json";

const first = training.segments[0];
const short = [...training.segments].sort((a, b) => a.text.length - b.text.length)[0];

async function typeTarget(page: Page, text: string, opts: { mistakeAt?: number } = {}) {
  const input = page.getByTestId("typing-input");
  await input.focus();
  const chars = Array.from(text);
  for (let i = 0; i < chars.length; i += 1) {
    if (opts.mistakeAt === i) {
      await page.keyboard.type("x");
      await page.keyboard.press("Backspace");
    }
    const ch = chars[i];
    if (ch === "\n") await page.keyboard.press("Enter");
    else await page.keyboard.type(ch);
  }
}

test.describe("Passage flow", () => {
  test("new user picks Brand, types a passage with a corrected mistake, sees a result and history", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Med ro, rytme");
    await page.getByRole("link", { name: /^Passasje/ }).click();
    await expect(page).toHaveURL(/\/velg\/passage$/);
    await page.getByRole("link", { name: /Ibsen: Brand/ }).click();
    await page.getByRole("link", { name: new RegExp(short.label!) }).click();
    await expect(page).toHaveURL(/\/skriv\?mode=passage/);
    await expect(page.getByTestId("typing-surface")).toBeVisible();

    await typeTarget(page, short.text, { mistakeAt: 3 });

    await expect(page).toHaveURL(/\/resultat\//);
    const result = page.getByTestId("result");
    await expect(result).toBeVisible();
    await expect(page.getByTestId("accuracy")).toHaveText(/100/);
    await expect(page.getByTestId("errors")).toHaveText("1");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Ibsen");

    await page.getByRole("link", { name: "Historikk" }).first().click();
    const table = page.getByTestId("history-table");
    await expect(table).toBeVisible();
    await expect(table).toContainText("Passasje");
    await expect(table).toContainText("Brand");
    await expect(table).toContainText("Brand Training Edition");
    await expect(table).toContainText("Fullført");
  });

  test("paste is rejected without corrupting the session", async ({ page }) => {
    await page.goto(`/skriv?mode=passage&work=ibsen-brand&segment=${first.id}`);
    const input = page.getByTestId("typing-input");
    await input.focus();
    await page.keyboard.type(first.text.slice(0, 5));
    await page.evaluate(() => {
      const el = document.querySelector('[data-testid="typing-input"]') as HTMLTextAreaElement;
      const dt = new DataTransfer();
      dt.setData("text/plain", "innlimt tekst som ikke skal telle");
      el.dispatchEvent(new ClipboardEvent("paste", { clipboardData: dt, bubbles: true, cancelable: true }));
    });
    await expect(page.getByText(/Innliming er skrudd av/)).toBeVisible();
    const correct = await page.locator(".ch-correct").count();
    expect(correct).toBe(5);
  });

  test("theme choice survives a reload", async ({ page }) => {
    await page.goto("/");
    await page.getByLabel("Fargetema").selectOption("dark");
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    await page.reload();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    await expect(page.getByLabel("Fargetema")).toHaveValue("dark");
  });
});

test.describe("Nonstop", () => {
  test("resumes at the right segment after a reload", async ({ page }) => {
    await page.goto("/skriv?mode=nonstop&work=ibsen-brand");
    await expect(page.getByTestId("session-meta")).toContainText(/1 av \d+/);
    await typeTarget(page, first.text);
    await expect(page.getByTestId("session-meta")).toContainText(/2 av \d+/);
    await page.keyboard.type(training.segments[1].text.slice(0, 4));

    await page.goto("/velg/nonstop?work=ibsen-brand");
    await expect(page.getByText(/Du har skrevet 1 av/)).toBeVisible();
    await page.getByRole("link", { name: "Fortsett" }).click();
    await expect(page.getByTestId("session-meta")).toContainText(/2 av \d+/);
    await expect(page.getByTestId("session-meta")).toContainText(training.segments[1].label!);

    await page.getByTestId("stop-button").click();
    await expect(page).toHaveURL(/\/resultat\//);
    await expect(page.getByTestId("result")).toContainText("Nonstop");
  });
});

test.describe("Timed", () => {
  test("ends at the time limit and stores a completed session", async ({ page }) => {
    await page.goto("/skriv?mode=timed&work=ibsen-brand&limit=60000");
    await page.clock.install();
    const input = page.getByTestId("typing-input");
    await input.focus();
    await page.keyboard.type(first.text.slice(0, 10));
    await expect(page.locator("dt", { hasText: "Igjen" })).toBeVisible();
    await page.clock.runFor(61_000);
    await expect(page).toHaveURL(/\/resultat\//);
    await expect(page.getByTestId("result")).toContainText("På tid");
    await expect(page.getByTestId("result")).toContainText("1 min 0 s");
  });
});
