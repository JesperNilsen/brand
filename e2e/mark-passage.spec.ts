import { expect, test } from "@playwright/test";

const PASSAGE = "/skriv?mode=passage&work=ibsen-brand&segment=akt1-01&filter=as-printed";

test.describe("Merking av en passasje mens du skriver", () => {
  test("legger biten i køen uten å ta fokus fra skrivefeltet", async ({ page }) => {
    // D13: skrivefeltet er aldri tomt, og en merkehandling som stjeler fokus
    // bryter økten — bufferet slutter å være klargjort, og et mykt tastaturs
    // slettetast gir ingen hendelse å rette fra. Dette er den testen.
    await page.goto(PASSAGE);
    const input = page.getByTestId("typing-input");
    await input.focus();
    await page.keyboard.type("(Oppe i");
    await expect(input).toBeFocused();

    await page.getByTestId("mark-passage").click();

    await expect(input).toBeFocused();
    await expect(page.getByTestId("mark-notice")).toHaveText("Lagt i køen.");

    // Og skrivingen går videre i samme felt, uten et klikk imellom: tastene
    // etter merkingen havner i teksten, ikke i ingenting. (Feltet selv holder
    // nullbredde-sentinelene fra input-buffer.ts, så det er den skrevne teksten
    // på flaten som må telles, ikke feltets verdi.)
    const typed = page.locator(".ch-correct");
    await expect(typed).toHaveCount("(Oppe i".length);
    await page.keyboard.type(" sneen");
    await expect(typed).toHaveCount("(Oppe i sneen".length);
  });

  test("sier det samme igjen, og legger ikke biten i køen to ganger", async ({ page }) => {
    await page.goto(PASSAGE);
    await page.getByTestId("typing-input").focus();
    await page.getByTestId("mark-passage").click();
    await expect(page.getByTestId("mark-notice")).toHaveText("Lagt i køen.");
    await page.getByTestId("mark-passage").click();
    await expect(page.getByTestId("mark-notice")).toHaveText("Allerede i køen.");
    await expect(page.getByTestId("typing-input")).toBeFocused();
  });

  test("er avslått når øvingsformen har endret teksten på skjermen", async ({ page }) => {
    // «words-only» skriver om teksten leseren ser, så en bit klippet fra
    // skjermen ville ikke stå ordrett i utgaven. Da er knappen av, med grunnen
    // sagt rett ut framfor å være en grå knapp.
    await page.goto(
      "/skriv?mode=passage&work=ibsen-brand&segment=akt1-01&filter=words-only",
    );
    const mark = page.getByTestId("mark-passage");
    await expect(mark).toBeDisabled();
    await expect(mark).toHaveAttribute("title", /ordrett/);
  });
});
