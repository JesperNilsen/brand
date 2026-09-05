import "fake-indexeddb/auto";
import { describe, expect, it } from "vitest";
import { IndexedDbRepository } from "@/infra/repository/IndexedDbRepository";
import { MemoryRepository } from "@/infra/repository/MemoryRepository";
import { MemoryPreferences } from "@/infra/preferences/local-storage";
import {
  defaultPreferences,
  migratePreferences,
  migrateSession,
} from "@/infra/repository/migrations";
import { describeRepositoryContract, makeSession } from "./repository-contract";

let dbCounter = 0;

// Both adapters are held to the same behaviour. A future Supabase adapter adds
// one line here rather than a second, divergent test file.
describeRepositoryContract("MemoryRepository", () => new MemoryRepository());
describeRepositoryContract(
  "IndexedDbRepository",
  () => new IndexedDbRepository(new MemoryPreferences(), `brand-test-${++dbCounter}`),
);

describe("migrations", () => {
  it("preferences migration is idempotent and tolerant", () => {
    expect(migratePreferences(null)).toEqual(defaultPreferences());
    expect(migratePreferences({ theme: "purple" }).theme).toBe("system");
    const p = { ...defaultPreferences(), theme: "light" as const, lastModeId: "passage" };
    expect(migratePreferences(migratePreferences(p))).toEqual(p);
  });

  it("session migration rejects unreadable records", () => {
    expect(migrateSession({})).toBeNull();
    expect(migrateSession({ id: "x", startedAt: "2026", schemaVersion: 99 })).toBeNull();
    const s = makeSession("ok", "2026-09-04T00:00:00.000Z");
    expect(migrateSession(s)).toEqual(s);
  });

  it("migrates a genuine pre-filter v1 record to v2 as printed", () => {
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
    expect(migrated!.schemaVersion).toBe(2);
    expect(migrated!.textFilterId).toBe("as-printed");
    expect(migrated!.netWpm).toBe(49.5);

    // Idempotent: migrating the result again changes nothing.
    expect(migrateSession(migrated)).toEqual(migrated);
  });

  it("repairs a v2 record whose filter field is missing or unknown", () => {
    const broken = { ...makeSession("b", "2026-09-04T00:00:00.000Z"), textFilterId: "shouting" };
    expect(migrateSession(broken)?.textFilterId).toBe("as-printed");
  });
});
