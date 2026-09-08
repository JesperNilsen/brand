import { expect, test, type Page } from "@playwright/test";
import training from "../content/ibsen-brand/training-edition.v1.json";

/**
 * Q-008: a session that names a text which is no longer here has to say so.
 *
 * Every session stores `editionId` and `editionContentHash` (D7) exactly so a
 * later change cannot falsify an old result — but until now nothing read them
 * back, and the guarantee rested on discipline. Q-006 nearly spent that
 * discipline: growing a work would have rewritten the edition every earlier
 * session named, silently.
 *
 * The sessions are written straight into IndexedDB, because the app cannot
 * produce this state on purpose — that is the point of it.
 */
type Seed = { id: string; editionId: string; editionContentHash: string };

async function seed(page: Page, sessions: Seed[]) {
  await page.evaluate(async (rows) => {
    await new Promise<void>((resolve, reject) => {
      const open = indexedDB.open("brand");
      open.onerror = () => reject(open.error);
      open.onsuccess = () => {
        const db = open.result;
        const tx = db.transaction("sessions", "readwrite");
        const store = tx.objectStore("sessions");
        for (const row of rows) {
          store.put({
            id: row.id,
            schemaVersion: 4,
            startedAt: "2026-09-01T10:00:00.000Z",
            completedAt: "2026-09-01T10:02:00.000Z",
            status: "completed",
            gameModeId: "passage",
            languageProfileId: "brand-riksmaal",
            contentPackId: "ibsen-brand",
            workId: "ibsen-brand",
            editionId: row.editionId,
            editionVersion: "1.0.0",
            editionContentHash: row.editionContentHash,
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
          });
        }
        tx.oncomplete = () => {
          db.close();
          resolve();
        };
        tx.onerror = () => reject(tx.error);
      };
    });
  }, sessions);
}

const MOVED = {
  id: "moved-session",
  editionId: training.id,
  editionContentHash: `sha256:${"0".repeat(64)}`,
};
const GONE = {
  id: "gone-session",
  editionId: "ibsen-brand.training.v9",
  editionContentHash: `sha256:${"1".repeat(64)}`,
};
const FINE = { id: "fine-session", editionId: training.id, editionContentHash: training.contentHash };

test.describe("A session whose text has moved", () => {
  test("the result page says the text changed, and does not pretend otherwise", async ({ page }) => {
    await page.goto("/historikk");
    await seed(page, [MOVED, GONE, FINE]);

    await page.goto(`/resultat/${MOVED.id}`);
    await expect(page.getByTestId("drift-notice")).toContainText("endret etter at økten ble skrevet");
    // The numbers are not withdrawn: they were measured, and they stand.
    await expect(page.getByTestId("accuracy")).toContainText("%");

    await page.goto(`/resultat/${GONE.id}`);
    await expect(page.getByTestId("drift-notice")).toContainText("finnes ikke lenger i appen");

    // And a session against the text that is actually here says nothing at all.
    await page.goto(`/resultat/${FINE.id}`);
    await expect(page.getByTestId("drift-notice")).toHaveCount(0);
  });

  test("the history marks the row, with a word", async ({ page }) => {
    await page.goto("/historikk");
    await seed(page, [MOVED, GONE, FINE]);
    await page.reload();

    const marks = page.getByTestId("history-drift");
    await expect(marks).toHaveCount(2);
    await expect(marks.first()).toContainText(/endret tekst|utgaven er borte/);
    // Three rows, two marked: the honest one is left alone.
    await expect(page.getByTestId("history-table").locator("tbody tr")).toHaveCount(3);
  });

  test("a session from before the fields existed is not called changed", async ({ page }) => {
    // schema 1 and 2 predate editionContentHash; `migrateSession` stamps them
    // "unknown". Claiming such a session's text moved would be as false as
    // claiming it did not.
    await page.goto("/historikk");
    await seed(page, [{ ...MOVED, id: "legacy-session", editionContentHash: "unknown" }]);
    await page.goto("/resultat/legacy-session");
    await expect(page.getByTestId("drift-notice")).toHaveCount(0);
  });
});
