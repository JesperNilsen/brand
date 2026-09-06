import { expect, test } from "@playwright/test";
import training from "../content/ibsen-brand/training-edition.v1.json";

const segment = training.segments[0];

/**
 * The gate for Phase 2: a reader must be able to get their history out and
 * back in. It is the only defence against a cleared browser store, and the way
 * back if a future schema migration reads a record wrongly, so the test clears
 * the store for real rather than simulating it.
 */
test("history survives an export, a wiped browser store and an import", async ({
  page,
}) => {
  // A session to have something to lose.
  await page.goto(
    `/skriv?mode=passage&work=ibsen-brand&segment=${segment.id}&filter=as-printed`,
  );
  await page.getByTestId("typing-input").focus();
  await page.keyboard.type(segment.text.slice(0, 12));
  await page.getByTestId("menu-button").click();
  await page.getByTestId("menu-finish").click();
  await expect(page).toHaveURL(/\/resultat\//);

  await page.goto("/historikk");
  const table = page.getByTestId("history-table");
  await expect(table).toBeVisible();
  const rowsBefore = await table.locator("tbody tr").count();
  expect(rowsBefore).toBe(1);

  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.getByTestId("export-button").click(),
  ]);
  const file = await download.path();
  expect(file).toBeTruthy();
  expect(download.suggestedFilename()).toMatch(
    /^brand-data-\d{4}-\d{2}-\d{2}\.json$/,
  );
  await expect(page.getByTestId("transfer-status")).toContainText("lastet ned");

  // Wipe everything the app owns, the way clearing site data would.
  await page.evaluate(async () => {
    localStorage.clear();
    await new Promise<void>((resolve) => {
      const req = indexedDB.deleteDatabase("brand");
      req.onsuccess = () => resolve();
      req.onerror = () => resolve();
      req.onblocked = () => resolve();
    });
  });
  await page.reload();
  await expect(page.getByText("Ingen økter ennå.")).toBeVisible();

  // Read the file back.
  await page.getByTestId("import-input").setInputFiles(file!);
  await expect(page.getByTestId("transfer-status")).toContainText(
    "1 økter lest inn",
  );
  await expect(page.getByTestId("history-table")).toBeVisible();
  expect(
    await page.getByTestId("history-table").locator("tbody tr").count(),
  ).toBe(rowsBefore);
});

test("a file that is not an export is refused, and nothing is lost", async ({
  page,
}) => {
  await page.goto("/historikk");
  await page.getByTestId("import-input").setInputFiles({
    name: "notes.json",
    mimeType: "application/json",
    buffer: Buffer.from('{"hello":"world"}'),
  });
  const status = page.getByTestId("transfer-status");
  await expect(status).toContainText("ikke en BRAND-eksport");
  await expect(page.getByText("Ingen økter ennå.")).toBeVisible();
});
