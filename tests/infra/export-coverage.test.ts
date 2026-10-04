import "fake-indexeddb/auto";
import { openDB } from "idb";
import { describe, expect, it } from "vitest";
import type { QueueItem } from "@/domain/practice-queue";
import { progressKey } from "@/domain/types";
import { MemoryPreferences } from "@/infra/preferences/local-storage";
import { DB_VERSION, IndexedDbRepository } from "@/infra/repository/IndexedDbRepository";
import { exportData } from "@/lib/data-transfer";
import { makeSession } from "./repository-contract";

/**
 * «Last ned alle data» has to mean every store.
 *
 * Q-015's second run was rejected on 2026-09-27 because it added a `queue`
 * store to IndexedDB and left `exportData` reading the two stores that were
 * there before. Every test stayed green: nothing compared what the database
 * holds with what the file carries. This does. It asks the database itself
 * for its object stores, not a list written here, so a fourth store added
 * tomorrow is covered by the same test — or fails it.
 *
 * Preferences are not an object store (they live in localStorage so the theme
 * can be read before first paint) and are covered by the round-trip tests in
 * tests/lib/data-transfer.test.ts.
 */

let dbCounter = 0;
const freshName = () => `brand-export-coverage-${++dbCounter}`;

const PIECE: QueueItem = {
  id: "q-1",
  workId: "ibsen-brand",
  segmentId: "akt1-01",
  editionId: "ibsen-brand.training.v2",
  editionContentHash: "sha256:test",
  kind: "phrase",
  text: "Hei, fremmedkarl, far ei så fort!",
  wordCount: 6,
  source: "marked",
  addedAt: "2026-09-10T10:00:00.000Z",
};

describe("export covers every store (Q-015, rejected 2026-09-27)", () => {
  it("carries every IndexedDB object store under a key of the same name, record for record", async () => {
    const name = freshName();
    const repo = new IndexedDbRepository(new MemoryPreferences(), name);
    await repo.addSession(makeSession("s-1", "2026-09-01T10:00:00.000Z"));
    await repo.saveProgress({
      key: progressKey({
        languageProfileId: "brand-riksmaal",
        gameModeId: "nonstop",
        workId: "ibsen-brand",
      }),
      workId: "ibsen-brand",
      editionId: "ibsen-brand.training.v2",
      languageProfileId: "brand-riksmaal",
      gameModeId: "nonstop",
      nextSegmentId: "akt1-02",
      completedSegmentIds: ["akt1-01"],
      updatedAt: "2026-09-05T10:00:00.000Z",
    });
    await repo.saveQueue([PIECE]);

    const file = (await exportData(repo)) as unknown as Record<string, unknown>;

    // The database's own list of stores, not one maintained in this test.
    const db = await openDB(name);
    const stores = [...db.objectStoreNames];
    expect(stores).toContain("queue");
    for (const store of stores) {
      const exported = file[store];
      expect(Array.isArray(exported), `eksporten mangler lageret «${store}»`).toBe(true);
      expect((exported as unknown[]).length, `«${store}»: antall poster i filen`).toBe(
        await db.count(store),
      );
    }
    db.close();
  });

  it("opens a database written before the queue existed without losing a session, and adds the store", async () => {
    const name = freshName();
    // The database exactly as the app created it at DB_VERSION 1: two stores,
    // one session inside, no queue.
    const v1 = await openDB(name, 1, {
      upgrade(db) {
        const sessions = db.createObjectStore("sessions", { keyPath: "id" });
        sessions.createIndex("byStartedAt", "startedAt");
        db.createObjectStore("progress", { keyPath: "key" });
      },
    });
    await v1.put("sessions", makeSession("before-upgrade", "2026-08-01T10:00:00.000Z"));
    expect([...v1.objectStoreNames].sort()).toEqual(["progress", "sessions"]);
    v1.close();

    const repo = new IndexedDbRepository(new MemoryPreferences(), name);
    expect((await repo.listSessions()).map((s) => s.id)).toEqual(["before-upgrade"]);
    expect(await repo.listQueue()).toEqual([]);

    const file = await exportData(repo);
    expect(file.sessions.map((s) => s.id)).toEqual(["before-upgrade"]);
    expect(file.queue).toEqual([]);

    const upgraded = await openDB(name);
    expect(upgraded.version).toBe(DB_VERSION);
    expect([...upgraded.objectStoreNames]).toContain("queue");
    upgraded.close();
  });
});
