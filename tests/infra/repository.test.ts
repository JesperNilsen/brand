import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it } from "vitest";
import { IndexedDbRepository } from "@/infra/repository/IndexedDbRepository";
import { MemoryRepository } from "@/infra/repository/MemoryRepository";
import { MemoryPreferences } from "@/infra/preferences/local-storage";
import {
  defaultPreferences,
  migratePreferences,
  migrateSession,
} from "@/infra/repository/migrations";
import type { BrandRepository } from "@/infra/repository/BrandRepository";
import type { SessionResult } from "@/domain/types";
import { progressKey } from "@/domain/types";

function session(id: string, startedAt: string, extra: Partial<SessionResult> = {}): SessionResult {
  return {
    id,
    schemaVersion: 1,
    startedAt,
    completedAt: startedAt,
    status: "completed",
    gameModeId: "passage",
    languageProfileId: "brand-riksmaal",
    contentPackId: "ibsen-brand",
    workId: "ibsen-brand",
    editionId: "ibsen-brand.training.v1",
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

let dbCounter = 0;

const adapters: Array<[string, () => BrandRepository]> = [
  ["MemoryRepository", () => new MemoryRepository()],
  [
    "IndexedDbRepository",
    () => new IndexedDbRepository(new MemoryPreferences(), `brand-test-${++dbCounter}`),
  ],
];

describe.each(adapters)("%s", (_name, make) => {
  let repo: BrandRepository;
  beforeEach(() => {
    repo = make();
  });

  it("returns default preferences and round-trips saved ones", async () => {
    expect(await repo.getPreferences()).toEqual(defaultPreferences());
    const next = { ...defaultPreferences(), theme: "dark" as const, lastModeId: "timed" };
    await repo.savePreferences(next);
    expect(await repo.getPreferences()).toEqual(next);
  });

  it("stores and deletes reading progress by key", async () => {
    const key = progressKey({
      languageProfileId: "brand-riksmaal",
      editionId: "e",
      gameModeId: "nonstop",
      workId: "w",
    });
    expect(await repo.getProgress(key)).toBeNull();
    await repo.saveProgress({
      key,
      workId: "w",
      editionId: "e",
      languageProfileId: "brand-riksmaal",
      gameModeId: "nonstop",
      nextSegmentId: "s2",
      completedSegmentIds: ["s1"],
      updatedAt: "2026-09-04T10:00:00.000Z",
    });
    expect((await repo.getProgress(key))?.nextSegmentId).toBe("s2");
    await repo.deleteProgress(key);
    expect(await repo.getProgress(key)).toBeNull();
  });

  it("lists sessions newest first with filters and limit", async () => {
    await repo.addSession(session("a", "2026-09-01T10:00:00.000Z"));
    await repo.addSession(session("b", "2026-09-03T10:00:00.000Z", { gameModeId: "timed" }));
    await repo.addSession(session("c", "2026-09-02T10:00:00.000Z", { workId: "hamsun" }));
    const all = await repo.listSessions();
    expect(all.map((s) => s.id)).toEqual(["b", "c", "a"]);
    expect((await repo.listSessions({ gameModeId: "timed" })).map((s) => s.id)).toEqual(["b"]);
    expect((await repo.listSessions({ workId: "hamsun" })).map((s) => s.id)).toEqual(["c"]);
    expect((await repo.listSessions({ limit: 2 })).map((s) => s.id)).toEqual(["b", "c"]);
    expect((await repo.getSession("c"))?.workId).toBe("hamsun");
    expect(await repo.getSession("zzz")).toBeNull();
  });
});

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
    const s = session("ok", "2026-09-04T00:00:00.000Z");
    expect(migrateSession(s)).toEqual(s);
  });
});
