import { expect, type Page } from "@playwright/test";

/**
 * Waiting for reading progress to actually be in IndexedDB before navigating.
 *
 * `onSegmentComplete` writes the record and nothing awaits it, so a test that
 * navigates the moment the *interface* says the segment advanced can beat the
 * write: the page unloads mid-transaction and the record is simply lost. It is
 * not eventual consistency — reloading the chooser afterwards cannot recover a
 * write that never committed — which is why these wait rather than retry.
 *
 * This was T-15: one local `check:all` in three went red on exactly this,
 * always in Nonstop, never in CI, because CI passes through the window faster
 * than a machine loaded by the two production builds `check:all` runs first.
 *
 * Waiting on the store is also a stronger assertion than a fixed delay: it
 * checks the app persisted, not that it probably had time to.
 */

type StoredProgress = {
  workId?: string;
  completedSegmentIds?: string[];
};

/** Every progress record in the browser's store, whatever key it is under. */
function readAll(page: Page): Promise<StoredProgress[]> {
  return page.evaluate(
    () =>
      new Promise<StoredProgress[]>((resolve, reject) => {
        const open = indexedDB.open("brand");
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const db = open.result;
          const all = db.transaction("progress", "readonly").objectStore("progress").getAll();
          all.onsuccess = () => {
            db.close();
            resolve(all.result as StoredProgress[]);
          };
          all.onerror = () => reject(all.error);
        };
      }),
  );
}

/** Wait until a progress record for `workId` exists at all. */
export async function waitForStoredProgress(page: Page, workId: string): Promise<void> {
  await expect
    .poll(async () => (await readAll(page)).filter((p) => p.workId === workId).length, {
      message: `progress for ${workId} was never written to IndexedDB`,
    })
    .toBeGreaterThan(0);
}

/**
 * Wait until the stored record for `workId` lists exactly `segmentIds` as
 * written — the set, not the order.
 *
 * Exactly, not "contains": a jump that quietly replaced the record, or turned
 * progress into a high-water mark, would still contain the segment just
 * finished, and that is the mistake this exists to catch.
 */
export async function waitForCompletedSegments(
  page: Page,
  workId: string,
  segmentIds: string[],
): Promise<void> {
  const wanted = [...segmentIds].sort();
  await expect
    .poll(
      async () => {
        const record = (await readAll(page)).find((p) => p.workId === workId);
        return record ? [...(record.completedSegmentIds ?? [])].sort() : null;
      },
      { message: `stored progress for ${workId} never became ${wanted.join(", ")}` },
    )
    .toEqual(wanted);
}
