import { beforeEach, describe, expect, it } from "vitest";
import { MemoryRepository } from "@/infra/repository/MemoryRepository";
import { defaultPreferences } from "@/infra/repository/migrations";
import {
  EXPORT_FORMAT_VERSION,
  ImportError,
  exportData,
  exportFileName,
  importData,
  serializeExport,
} from "@/lib/data-transfer";
import type { ReadingProgress, SessionResult } from "@/domain/types";
import { makeSession } from "../infra/repository-contract";

function progress(key: string): ReadingProgress {
  return {
    key,
    workId: "ibsen-brand",
    editionId: "ibsen-brand.training.v1",
    languageProfileId: "brand-riksmaal",
    gameModeId: "nonstop",
    nextSegmentId: "akt1-04",
    completedSegmentIds: ["akt1-01", "akt1-02", "akt1-03"],
    updatedAt: "2026-09-05T10:00:00.000Z",
  };
}

describe("export / import", () => {
  let repo: MemoryRepository;
  beforeEach(async () => {
    repo = new MemoryRepository();
    await repo.savePreferences({ ...defaultPreferences(), theme: "dark", lastModeId: "timed" });
    await repo.addSession(makeSession("a", "2026-09-01T10:00:00.000Z"));
    await repo.addSession(makeSession("b", "2026-09-02T10:00:00.000Z", { netWpm: 61 }));
    await repo.saveProgress(progress("k1"));
  });

  it("round-trips through an emptied store", async () => {
    // The whole point: the file is what stands between a cleared browser and
    // a lost history, so the test clears the store for real.
    const file = serializeExport(await exportData(repo));
    const before = await repo.listSessions();

    const empty = new MemoryRepository();
    expect(await empty.listSessions()).toHaveLength(0);

    const report = await importData(empty, JSON.parse(file));
    expect(report).toEqual({
      sessionsImported: 2,
      sessionsSkipped: 0,
      progressImported: 1,
      preferencesImported: true,
    });
    expect(await empty.listSessions()).toEqual(before);
    expect((await empty.getPreferences()).theme).toBe("dark");
    expect((await empty.getProgress("k1"))?.completedSegmentIds).toEqual([
      "akt1-01",
      "akt1-02",
      "akt1-03",
    ]);
  });

  it("importing the same file twice leaves one copy of each session", async () => {
    const file = JSON.parse(serializeExport(await exportData(repo)));
    const target = new MemoryRepository();
    await importData(target, file);
    await importData(target, file);
    expect(await target.listSessions()).toHaveLength(2);
  });

  it("keeps sessions that are already there", async () => {
    const file = JSON.parse(serializeExport(await exportData(repo)));
    const target = new MemoryRepository();
    await target.addSession(makeSession("newer", "2026-09-04T10:00:00.000Z"));
    await importData(target, file);
    expect((await target.listSessions()).map((s) => s.id).sort()).toEqual(["a", "b", "newer"]);
  });

  it("migrates old records on the way in", async () => {
    const legacy = {
      format: "brand-export",
      formatVersion: 1,
      exportedAt: "2026-08-01T00:00:00.000Z",
      preferences: { theme: "light" },
      sessions: [{ ...makeSession("old", "2026-08-01T10:00:00.000Z"), schemaVersion: 2 }],
      progress: [],
    };
    const target = new MemoryRepository();
    await importData(target, legacy);
    const s = await target.getSession("old");
    expect(s!.schemaVersion).toBe(3);
    expect(s!.editionVersion).toBe("1.0.0");
  });

  it("skips a record it cannot read without losing the rest", async () => {
    const target = new MemoryRepository();
    const report = await importData(target, {
      format: "brand-export",
      formatVersion: 1,
      exportedAt: "2026-09-05T00:00:00.000Z",
      sessions: [
        { id: "broken", schemaVersion: 99, startedAt: "2026-09-05T00:00:00.000Z" },
        makeSession("good", "2026-09-05T10:00:00.000Z"),
      ],
      progress: [{ nonsense: true }, progress("k9")],
    });
    expect(report.sessionsImported).toBe(1);
    expect(report.sessionsSkipped).toBe(1);
    expect(report.progressImported).toBe(1);
    expect((await target.listSessions()).map((s) => s.id)).toEqual(["good"]);
  });

  it("refuses a file that is not an export, or is from a newer format", async () => {
    const target = new MemoryRepository();
    await expect(importData(target, null)).rejects.toBeInstanceOf(ImportError);
    await expect(importData(target, { hello: "world" })).rejects.toBeInstanceOf(ImportError);
    await expect(
      importData(target, { format: "brand-export", formatVersion: EXPORT_FORMAT_VERSION + 1 }),
    ).rejects.toBeInstanceOf(ImportError);
  });

  it("names the file by date so a folder of them sorts itself", () => {
    expect(exportFileName(new Date("2026-09-05T12:00:00Z"))).toBe("brand-data-2026-09-05.json");
  });

  it("writes a file a human can read and a diff can show", async () => {
    const text = serializeExport(await exportData(repo));
    expect(text.endsWith("\n")).toBe(true);
    expect(text).toContain('"format": "brand-export"');
    const parsed = JSON.parse(text) as { sessions: SessionResult[] };
    expect(parsed.sessions).toHaveLength(2);
  });
});
