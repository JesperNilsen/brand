import "fake-indexeddb/auto";
import { describe, expect, it } from "vitest";
import { IndexedDbRepository } from "@/infra/repository/IndexedDbRepository";
import { MemoryRepository } from "@/infra/repository/MemoryRepository";
import { MemoryPreferences } from "@/infra/preferences/local-storage";
import {
  defaultPreferences,
  mergeProgress,
  migratePreferences,
  migrateProgress,
  migrateSession,
  SESSION_SCHEMA_VERSION,
} from "@/infra/repository/migrations";
import { progressKey } from "@/domain/types";
import { describeRepositoryContract, makeSession } from "./repository-contract";

let dbCounter = 0;

// Both adapters are held to the same behaviour. A future Supabase adapter adds
// one line here rather than a second, divergent test file.
describeRepositoryContract("MemoryRepository", () => new MemoryRepository());
describeRepositoryContract(
  "IndexedDbRepository",
  () =>
    new IndexedDbRepository(
      new MemoryPreferences(),
      `brand-test-${++dbCounter}`,
    ),
);

describe("migrations", () => {
  it("preferences migration is idempotent and tolerant", () => {
    expect(migratePreferences(null)).toEqual(defaultPreferences());
    expect(migratePreferences({ theme: "purple" }).theme).toBe("system");
    const p = {
      ...defaultPreferences(),
      theme: "light" as const,
      lastModeId: "passage",
    };
    expect(migratePreferences(migratePreferences(p))).toEqual(p);
  });

  it("session migration rejects unreadable records", () => {
    expect(migrateSession({})).toBeNull();
    expect(
      migrateSession({ id: "x", startedAt: "2026", schemaVersion: 99 }),
    ).toBeNull();
    const s = makeSession("ok", "2026-09-04T00:00:00.000Z");
    expect(migrateSession(s)).toEqual(s);
  });

  it("migrates a genuine pre-filter v1 record forward, as printed", () => {
    // Exactly what the app wrote before text filters existed: schemaVersion 1
    // and no textFilterId field at all.
    const v1: Record<string, unknown> = {
      id: "old",
      schemaVersion: 1,
      startedAt: "2026-09-01T09:00:00.000Z",
      completedAt: "2026-09-01T09:02:00.000Z",
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
    expect(Object.hasOwn(v1, "textFilterId")).toBe(false);

    const migrated = migrateSession(v1);
    expect(migrated).not.toBeNull();
    expect(migrated!.schemaVersion).toBe(SESSION_SCHEMA_VERSION);
    expect(migrated!.textFilterId).toBe("as-printed");
    expect(migrated!.netWpm).toBe(49.5);
    // The edition it was typed against cannot be recovered, so it is named
    // as unknown rather than assumed to be whatever is current today.
    expect(migrated!.editionVersion).toBe("unknown");
    expect(migrated!.editionContentHash).toBe("unknown");

    // Idempotent: migrating the result again changes nothing.
    expect(migrateSession(migrated)).toEqual(migrated);
  });

  it("repairs a record whose filter field is missing or unknown", () => {
    const broken = {
      ...makeSession("b", "2026-09-04T00:00:00.000Z"),
      textFilterId: "shouting",
    };
    expect(migrateSession(broken)?.textFilterId).toBe("as-printed");
  });

  it("returns the very same object when nothing needs changing", () => {
    // Idempotence by identity, not just by equality: every later migration
    // runs on the output of this one, on every read, for every listed session.
    const current = makeSession("same", "2026-09-04T00:00:00.000Z");
    expect(migrateSession(current)).toBe(current);
  });

  it("refuses a v2 record that is missing the edition fields only by filling them", () => {
    const v2 = {
      ...makeSession("v2", "2026-09-04T00:00:00.000Z"),
      schemaVersion: 2,
    } as Record<string, unknown>;
    delete v2.editionVersion;
    delete v2.editionContentHash;
    const out = migrateSession(v2);
    expect(out!.schemaVersion).toBe(SESSION_SCHEMA_VERSION);
    expect(out!.editionVersion).toBe("unknown");
    expect(migrateSession(out)).toEqual(out);
  });
});

describe("progress migration (T-10)", () => {
  const legacy = {
    key: "brand-riksmaal::ibsen-brand.training.v1::nonstop::ibsen-brand",
    workId: "ibsen-brand",
    editionId: "ibsen-brand.training.v1",
    languageProfileId: "brand-riksmaal",
    gameModeId: "nonstop",
    nextSegmentId: "akt1-06",
    completedSegmentIds: ["akt1-01", "akt1-02"],
    updatedAt: "2026-09-01T10:00:00.000Z",
  };

  it("recomputes the key from the record's own fields", () => {
    const migrated = migrateProgress(legacy);
    expect(migrated?.key).toBe(
      progressKey({
        languageProfileId: "brand-riksmaal",
        gameModeId: "nonstop",
        workId: "ibsen-brand",
      }),
    );
    // The edition it was written against is kept: it is the only way to tell
    // later that these segment ids came from a different cut of the work.
    expect(migrated?.editionId).toBe("ibsen-brand.training.v1");
  });

  it("returns the very same object when nothing needs changing", () => {
    const current = migrateProgress(legacy)!;
    expect(migrateProgress(current)).toBe(current);
  });

  it("names a missing edition rather than dropping the record", () => {
    const noEdition: Record<string, unknown> = { ...legacy };
    delete noEdition.editionId;
    const migrated = migrateProgress(noEdition);
    expect(migrated?.editionId).toBe("unknown");
    expect(migrated?.nextSegmentId).toBe("akt1-06");
    expect(migrateProgress(migrated)).toBe(migrated);
  });

  it("rejects a record it cannot understand rather than guessing", () => {
    expect(migrateProgress(null)).toBeNull();
    expect(migrateProgress({ workId: "w" })).toBeNull();
    expect(migrateProgress({ ...legacy, completedSegmentIds: [1, 2] })).toBeNull();
    expect(migrateProgress({ ...legacy, nextSegmentId: undefined })).toBeNull();
  });

  it("merges colliding records newest-wins, completed segments unioned", () => {
    const older = migrateProgress(legacy)!;
    const newer = migrateProgress({
      ...legacy,
      key: "brand-riksmaal::ibsen-brand.training.v2::nonstop::ibsen-brand",
      editionId: "ibsen-brand.training.v2",
      nextSegmentId: "akt1-09",
      completedSegmentIds: ["akt1-07"],
      updatedAt: "2026-09-06T10:00:00.000Z",
    })!;

    const [merged, ...rest] = mergeProgress([older, newer]);
    expect(rest).toEqual([]);
    expect(merged.nextSegmentId).toBe("akt1-09");
    expect(merged.editionId).toBe("ibsen-brand.training.v2");
    expect(merged.completedSegmentIds.sort()).toEqual(["akt1-01", "akt1-02", "akt1-07"]);
  });

  it("merges the same way whichever order the records arrive in", () => {
    const a = migrateProgress(legacy)!;
    const b = migrateProgress({
      ...legacy,
      key: "brand-riksmaal::ibsen-brand.training.v2::nonstop::ibsen-brand",
      nextSegmentId: "akt1-09",
      completedSegmentIds: ["akt1-07"],
      updatedAt: "2026-09-06T10:00:00.000Z",
    })!;
    expect(mergeProgress([a, b])).toEqual(mergeProgress([b, a]));
  });

  it("keeps progress for different works apart", () => {
    const other = migrateProgress({ ...legacy, workId: "kielland-gift" })!;
    expect(mergeProgress([migrateProgress(legacy)!, other])).toHaveLength(2);
  });
});
