import { beforeEach, describe, expect, it } from "vitest";
import { MemoryRepository } from "@/infra/repository/MemoryRepository";
import { defaultPreferences, SESSION_SCHEMA_VERSION } from "@/infra/repository/migrations";
import {
  EXPORT_FORMAT_VERSION,
  ImportError,
  exportData,
  exportFileName,
  importData,
  serializeExport,
  UNVERIFIED_IMPORT_HASH,
} from "@/lib/data-transfer";
import { enqueue, selectForEdition, type QueueItem } from "@/domain/practice-queue";
import type { TextEdition } from "@/domain/types";
import { progressKey, type ReadingProgress, type SessionResult } from "@/domain/types";
import { makeSession } from "../infra/repository-contract";

/** The key an ibsen-brand nonstop record has today; see progressKey(). */
const PROGRESS_KEY = progressKey({
  languageProfileId: "brand-riksmaal",
  gameModeId: "nonstop",
  workId: "ibsen-brand",
});

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
    await repo.saveProgress(progress(PROGRESS_KEY));
  });

  // T-10. A file exported before 2026-09-07 carries progress keyed by edition.
  // Imported verbatim it would restore a record nothing ever looks up — the
  // reader would see their history come back and their place in the book not.
  it("imports progress from a file written under the old edition-scoped key", async () => {
    const empty = new MemoryRepository();
    const report = await importData(empty, {
      format: "brand-export",
      formatVersion: EXPORT_FORMAT_VERSION,
      exportedAt: "2026-09-05T10:00:00.000Z",
      preferences: defaultPreferences(),
      sessions: [],
      progress: [progress("brand-riksmaal::ibsen-brand.training.v1::nonstop::ibsen-brand")],
    });

    expect(report.progressImported).toBe(1);
    expect((await empty.getProgress(PROGRESS_KEY))?.nextSegmentId).toBe("akt1-04");
    expect((await empty.listProgress()).map((p) => p.key)).toEqual([PROGRESS_KEY]);
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
      queueImported: 0,
      queueSkipped: 0,
    });
    expect(await empty.listSessions()).toEqual(before);
    expect((await empty.getPreferences()).theme).toBe("dark");
    expect((await empty.getProgress(PROGRESS_KEY))?.completedSegmentIds).toEqual([
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
    expect(s!.schemaVersion).toBe(SESSION_SCHEMA_VERSION);
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

// Q-015, rejected 2026-09-27: «Last ned alle data» left the repetition queue
// behind. The queue is the reader's own work — passages they marked, pieces
// derived from their own deviations — and a cleared browser takes it with it
// exactly as it takes their sessions.
describe("export / import: the repetition queue", () => {
  const SEGMENT = "Hei, fremmedkarl, far ei så fort!";
  const ed: TextEdition = {
    id: "w.training.v1",
    workId: "w",
    kind: "training-edition",
    version: "1.0.0",
    contentHash: "sha256:first",
    languageProfileId: "brand-riksmaal",
    adaptationStatus: "orthography",
    segmentCount: 1,
    wordCount: 6,
    file: "/content/editions/w.training.v1.first.json",
    segments: [{ id: "s1", order: 1, text: SEGMENT, wordCount: 6 }],
  };
  const at = (iso: string) => () => new Date(iso);
  const mark = (q: readonly QueueItem[], text: string, iso: string) =>
    enqueue(q, { workId: "w", segmentId: "s1", kind: "phrase", text, source: "marked" }, ed, at(iso));

  let source: MemoryRepository;
  beforeEach(async () => {
    source = new MemoryRepository();
    let q = mark([], "far ei så fort", "2026-09-10T10:00:00.000Z");
    q = mark(q, "fremmedkarl", "2026-09-12T10:00:00.000Z");
    await source.saveQueue(q);
  });

  it("round-trips the queue through a file into an emptied store", async () => {
    const before = await source.listQueue();
    const file = JSON.parse(serializeExport(await exportData(source)));
    expect(file.queue).toHaveLength(2);

    const empty = new MemoryRepository();
    const report = await importData(empty, file);
    expect(report.queueImported).toBe(2);
    expect(report.queueSkipped).toBe(0);

    const after = await empty.listQueue();
    // Everything but the hash comes back as it went out; the hash is withheld
    // until the edition has been read again (see UNVERIFIED_IMPORT_HASH).
    const strip = (q: QueueItem) => ({ ...q, editionContentHash: "" });
    expect(after.map(strip)).toEqual(before.map(strip));
    expect(after.every((q) => q.editionContentHash === UNVERIFIED_IMPORT_HASH)).toBe(true);

    // And the first selection re-reads the edition and serves them again.
    const selection = selectForEdition(after, ed);
    expect(selection.stale).toEqual([]);
    expect(selection.revalidated.map((q) => q.text)).toEqual(["far ei så fort", "fremmedkarl"]);
    expect(selection.revalidated.every((q) => q.editionContentHash === "sha256:first")).toBe(true);
  });

  it("is additive: pieces already in the queue survive the import, and none doubles", async () => {
    const file = JSON.parse(serializeExport(await exportData(source)));
    const target = new MemoryRepository();
    // Marked in this browser after the file was written, and one passage that
    // was marked here too, under its own id.
    let local = mark([], "Hei", "2026-09-20T10:00:00.000Z");
    local = mark(local, "fremmedkarl", "2026-09-11T10:00:00.000Z");
    await target.saveQueue(local);

    const first = await importData(target, file);
    expect(first.queueImported).toBe(1);
    const merged = await target.listQueue();
    expect(merged.map((q) => q.text)).toEqual(["far ei så fort", "fremmedkarl", "Hei"]);
    // The local copy of the shared passage is the one kept, stamp and all.
    const shared = merged.find((q) => q.text === "fremmedkarl");
    expect(shared?.id).toBe(local[1]!.id);
    expect(shared?.editionContentHash).toBe("sha256:first");

    const second = await importData(target, file);
    expect(second.queueImported).toBe(0);
    expect(await target.listQueue()).toHaveLength(3);
  });

  it("an import file cannot put words in the queue the edition does not have", async () => {
    const file = JSON.parse(serializeExport(await exportData(source)));
    file.queue[0].text = "far ei så sakte"; // one word swapped, stamp untouched
    const target = new MemoryRepository();
    await importData(target, file);
    const selection = selectForEdition(await target.listQueue(), ed);
    expect(selection.items).toEqual([]);
    expect(selection.stale.map((s) => [s.item.text, s.reason])).toEqual([
      ["far ei så sakte", "text-gone"],
    ]);
  });

  it("imports a file written before the queue existed, leaving the queue alone", async () => {
    const target = new MemoryRepository();
    const local = mark([], "Hei", "2026-09-20T10:00:00.000Z");
    await target.saveQueue(local);
    const report = await importData(target, {
      format: "brand-export",
      formatVersion: EXPORT_FORMAT_VERSION,
      exportedAt: "2026-09-05T10:00:00.000Z",
      preferences: defaultPreferences(),
      sessions: [],
      progress: [],
    });
    expect(report.queueImported).toBe(0);
    expect(await target.listQueue()).toEqual(local);
  });

  it("skips a queue record it cannot read without losing the rest", async () => {
    const file = JSON.parse(serializeExport(await exportData(source)));
    file.queue.push({ id: "q-broken", text: 42 });
    const target = new MemoryRepository();
    const report = await importData(target, file);
    expect(report).toMatchObject({ queueImported: 2, queueSkipped: 1 });
  });
});
