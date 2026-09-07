import { expect, test } from "@playwright/test";
import v2 from "../content/kielland-gift/training-edition.v2.json";

/**
 * T-10, end to end: a new training edition must not take the reader's place in
 * the book away.
 *
 * The unit tests prove the migration; this proves the app is wired to it. The
 * record is written straight into IndexedDB under the key the app used before
 * 2026-09-07 — profile, EDITION, mode, work — which is the only way to
 * reproduce the failure now that nothing writes that key any more.
 *
 * `kielland-gift` is the work under test because it genuinely has two training
 * editions: the reader below stopped inside v1, and the app serves v2.
 */
const LEGACY_KEY = "brand-riksmaal::kielland-gift.training.v1::nonstop::kielland-gift";
const COMPLETED = ["kap1-01", "kap1-02", "kap1-03", "kap1-04", "kap1-05"];

test("progress written under an older edition survives the bump", async ({ page }) => {
  // The app opens the database; writing into it before that would race the
  // upgrade and create a store this test, not the app, had defined.
  await page.goto("/velg/nonstop?work=kielland-gift");
  await expect(page.getByText(/segmenter i rekkefølge/)).toBeVisible();

  await page.evaluate(
    async ({ key, completed }) => {
      await new Promise<void>((resolve, reject) => {
        const open = indexedDB.open("brand");
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const db = open.result;
          const tx = db.transaction("progress", "readwrite");
          tx.objectStore("progress").put({
            key,
            workId: "kielland-gift",
            editionId: "kielland-gift.training.v1",
            languageProfileId: "brand-riksmaal",
            gameModeId: "nonstop",
            nextSegmentId: "kap1-06",
            completedSegmentIds: completed,
            updatedAt: "2026-09-01T10:00:00.000Z",
          });
          tx.oncomplete = () => {
            db.close();
            resolve();
          };
          tx.onerror = () => reject(tx.error);
        };
      });
    },
    { key: LEGACY_KEY, completed: COMPLETED },
  );

  await page.reload();

  await expect(
    page.getByText(`Du har skrevet ${COMPLETED.length} av ${v2.segments.length} segmenter.`),
  ).toBeVisible();
  await expect(page.getByRole("link", { name: "Fortsett" })).toBeVisible();
});
