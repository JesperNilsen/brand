import { beforeEach, describe, expect, it } from "vitest";
import type { BrandRepository } from "@/infra/repository/BrandRepository";
import { defaultPreferences } from "@/infra/repository/migrations";
import type { ReadingProgress, SessionResult } from "@/domain/types";
import { progressKey } from "@/domain/types";

/**
 * The storage contract, as behaviour rather than as a TypeScript interface.
 *
 * `BrandRepository` says what the methods are called; it cannot say that a
 * legacy record must come back migrated, that a returned object must not be a
 * live handle into the store, or that an unreadable row is skipped rather than
 * thrown. Those are the things a second adapter gets wrong, and they were the
 * things that differed between the two adapters when this suite was written:
 * `IndexedDbRepository` migrated on read and `MemoryRepository` did not.
 *
 * Every adapter runs this, including the Supabase one when it arrives.
 */

export function makeSession(
  id: string,
  startedAt: string,
  extra: Partial<SessionResult> = {},
): SessionResult {
  return {
    id,
    schemaVersion: 3,
    startedAt,
    completedAt: startedAt,
    status: "completed",
    gameModeId: "passage",
    languageProfileId: "brand-riksmaal",
    contentPackId: "ibsen-brand",
    workId: "ibsen-brand",
    editionId: "ibsen-brand.training.v1",
    editionVersion: "1.0.0",
    editionContentHash: "sha256:test",
    segmentIds: ["a"],
    errorMode: "flow",
    textFilterId: "as-printed",
    durationMs: 10_000,
    targetCharacterCount: 100,
    typedCharacterCount: 100,
    correctCharacterCount: 98,
    errorCount: 3,
    grossWpm: 120,
    netWpm: 117.6,
    accuracy: 0.98,
    ...extra,
  };
}

function makeProgress(key: string, extra: Partial<ReadingProgress> = {}): ReadingProgress {
  return {
    key,
    workId: "w",
    editionId: "e",
    languageProfileId: "brand-riksmaal",
    gameModeId: "nonstop",
    nextSegmentId: "s2",
    completedSegmentIds: ["s1"],
    updatedAt: "2026-09-04T10:00:00.000Z",
    ...extra,
  };
}

/** A record exactly as the app wrote it before text filters existed. */
const LEGACY_V1: Record<string, unknown> = {
  id: "legacy",
  schemaVersion: 1,
  startedAt: "2026-08-01T09:00:00.000Z",
  completedAt: "2026-08-01T09:02:00.000Z",
  status: "completed",
  gameModeId: "passage",
  languageProfileId: "brand-riksmaal",
  contentPackId: "ibsen-brand",
  workId: "ibsen-brand",
  editionId: "ibsen-brand.training.v1",
  segmentIds: ["akt1-01"],
  errorMode: "flow",
  durationMs: 120_000,
  targetCharacterCount: 500,
  typedCharacterCount: 500,
  correctCharacterCount: 495,
  errorCount: 7,
  grossWpm: 50,
  netWpm: 49.5,
  accuracy: 0.99,
};

/** A record as the app wrote it after text filters but before edition versions. */
const LEGACY_V2: Record<string, unknown> = {
  ...LEGACY_V1,
  id: "legacy-v2",
  schemaVersion: 2,
  textFilterId: "words-only",
};

const KEY = progressKey({
  languageProfileId: "brand-riksmaal",
  editionId: "e",
  gameModeId: "nonstop",
  workId: "w",
});

export function describeRepositoryContract(name: string, make: () => BrandRepository): void {
  describe(`${name} (repository contract)`, () => {
    let repo: BrandRepository;
    beforeEach(() => {
      repo = make();
    });

    describe("preferences", () => {
      it("returns the defaults before anything is saved", async () => {
        expect(await repo.getPreferences()).toEqual(defaultPreferences());
      });

      it("round-trips every field", async () => {
        const next = {
          ...defaultPreferences(),
          theme: "dark" as const,
          lastModeId: "timed",
          lastWorkId: "hamsun-markens-groede",
          lastTimedLimitMs: 300_000,
          textFilterId: "words-only" as const,
        };
        await repo.savePreferences(next);
        expect(await repo.getPreferences()).toEqual(next);
      });

      it("hands back a copy, not a handle into the store", async () => {
        const saved = { ...defaultPreferences(), lastModeId: "timed" };
        await repo.savePreferences(saved);
        const read = await repo.getPreferences();
        read.lastModeId = "mutated";
        expect((await repo.getPreferences()).lastModeId).toBe("timed");
      });
    });

    describe("reading progress", () => {
      it("is null for a key that was never written", async () => {
        expect(await repo.getProgress(KEY)).toBeNull();
      });

      it("saves, overwrites and deletes by key", async () => {
        await repo.saveProgress(makeProgress(KEY));
        expect((await repo.getProgress(KEY))?.nextSegmentId).toBe("s2");
        await repo.saveProgress(
          makeProgress(KEY, { nextSegmentId: "s3", completedSegmentIds: ["s1", "s2"] }),
        );
        const updated = await repo.getProgress(KEY);
        expect(updated?.nextSegmentId).toBe("s3");
        expect(updated?.completedSegmentIds).toEqual(["s1", "s2"]);
        await repo.deleteProgress(KEY);
        expect(await repo.getProgress(KEY)).toBeNull();
      });

      it("deleting a key that does not exist is a no-op", async () => {
        await expect(repo.deleteProgress("never-written")).resolves.toBeUndefined();
      });

      it("hands back a copy of completedSegmentIds", async () => {
        await repo.saveProgress(makeProgress(KEY));
        const read = await repo.getProgress(KEY);
        read!.completedSegmentIds.push("smuggled");
        expect((await repo.getProgress(KEY))?.completedSegmentIds).toEqual(["s1"]);
      });
    });

    describe("sessions", () => {
      it("stores and reads one back by id", async () => {
        await repo.addSession(makeSession("a", "2026-09-01T10:00:00.000Z"));
        expect((await repo.getSession("a"))?.workId).toBe("ibsen-brand");
        expect(await repo.getSession("missing")).toBeNull();
      });

      it("writing the same id twice replaces rather than duplicates", async () => {
        await repo.addSession(makeSession("a", "2026-09-01T10:00:00.000Z"));
        await repo.addSession(makeSession("a", "2026-09-01T10:00:00.000Z", { netWpm: 80 }));
        expect((await repo.getSession("a"))?.netWpm).toBe(80);
        expect(await repo.listSessions()).toHaveLength(1);
      });

      it("lists newest first by default and oldest first on request", async () => {
        await repo.addSession(makeSession("a", "2026-09-01T10:00:00.000Z"));
        await repo.addSession(makeSession("b", "2026-09-03T10:00:00.000Z"));
        await repo.addSession(makeSession("c", "2026-09-02T10:00:00.000Z"));
        expect((await repo.listSessions()).map((s) => s.id)).toEqual(["b", "c", "a"]);
        expect((await repo.listSessions({ newestFirst: false })).map((s) => s.id)).toEqual([
          "a",
          "c",
          "b",
        ]);
      });

      it("filters by mode, work and text form, and honours the limit", async () => {
        await repo.addSession(makeSession("a", "2026-09-01T10:00:00.000Z"));
        await repo.addSession(
          makeSession("b", "2026-09-03T10:00:00.000Z", { gameModeId: "timed" }),
        );
        await repo.addSession(makeSession("c", "2026-09-02T10:00:00.000Z", { workId: "hamsun" }));
        await repo.addSession(
          makeSession("d", "2026-09-04T10:00:00.000Z", { textFilterId: "words-only" }),
        );
        expect((await repo.listSessions({ gameModeId: "timed" })).map((s) => s.id)).toEqual(["b"]);
        expect((await repo.listSessions({ workId: "hamsun" })).map((s) => s.id)).toEqual(["c"]);
        expect((await repo.listSessions({ textFilterId: "words-only" })).map((s) => s.id)).toEqual([
          "d",
        ]);
        expect((await repo.listSessions({ limit: 2 })).map((s) => s.id)).toEqual(["d", "b"]);
      });

      it("returns an empty list rather than throwing when nothing is stored", async () => {
        expect(await repo.listSessions()).toEqual([]);
      });
    });

    describe("schema migration at the read boundary", () => {
      it("returns a stored pre-filter record at the current version", async () => {
        await repo.addSession(LEGACY_V1 as unknown as SessionResult);

        const one = await repo.getSession("legacy");
        expect(one).not.toBeNull();
        expect(one!.schemaVersion).toBe(3);
        expect(one!.textFilterId).toBe("as-printed");
        expect(one!.netWpm).toBe(49.5);

        const listed = await repo.listSessions();
        expect(listed).toHaveLength(1);
        expect(listed[0].schemaVersion).toBe(3);
        expect(listed[0].textFilterId).toBe("as-printed");
      });

      it("stamps an unknown edition on a v2 record rather than guessing one", async () => {
        await repo.addSession(LEGACY_V2 as unknown as SessionResult);
        const one = await repo.getSession("legacy-v2");
        expect(one!.schemaVersion).toBe(3);
        expect(one!.editionVersion).toBe("unknown");
        expect(one!.editionContentHash).toBe("unknown");
        // The filter it actually recorded survives; only the missing facts are filled.
        expect(one!.textFilterId).toBe("words-only");
      });

      it("skips a record it cannot read instead of failing the whole list", async () => {
        await repo.addSession({
          id: "unreadable",
          schemaVersion: 99,
          startedAt: "2026-09-05T10:00:00.000Z",
        } as unknown as SessionResult);
        await repo.addSession(makeSession("good", "2026-09-01T10:00:00.000Z"));

        expect((await repo.listSessions()).map((s) => s.id)).toEqual(["good"]);
        expect(await repo.getSession("unreadable")).toBeNull();
      });
    });
  });
}
