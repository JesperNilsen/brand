import type { BrandRepository } from "@/infra/repository";
import {
  migratePreferences,
  migrateProgress,
  migrateSession,
} from "@/infra/repository/migrations";
import type { QueueItem } from "@/domain/practice-queue";
import type { DrillKind, ReadingProgress, SessionResult, UserPreferences } from "@/domain/types";

/**
 * Export and import of everything the app stores.
 *
 * All of a reader's history lives in one browser, and a cleared browser store
 * takes it with it. This is the only defence against that, and it is also the
 * escape hatch for the schema migration that landed alongside it: if a future
 * migration reads a record wrongly, the file written before the upgrade is the
 * way back.
 *
 * The format is deliberately dull. It is the stored records verbatim, with a
 * format version of its own, so a file written today can still be read after
 * the session schema has moved on: import runs every record through the same
 * migrations the repository uses on read.
 */

export const EXPORT_FORMAT_VERSION = 1 as const;

export type BrandExport = {
  format: "brand-export";
  formatVersion: typeof EXPORT_FORMAT_VERSION;
  exportedAt: string;
  preferences: UserPreferences;
  sessions: SessionResult[];
  progress: ReadingProgress[];
  /**
   * The repetition queue (Q-015). Optional on the way in: a file written before
   * the queue existed has no such field and must still import. It is a field
   * added, not a field changed, so the format version stays at 1 — every file
   * this version can read is still one it could read before.
   */
  queue?: QueueItem[];
};

export type ImportReport = {
  sessionsImported: number;
  sessionsSkipped: number;
  progressImported: number;
  preferencesImported: boolean;
  queueImported: number;
  queueSkipped: number;
};

/**
 * The stamp an imported queue piece carries until its edition has been read.
 *
 * A file on disk is not the edition: it can have been written by an older
 * build, against an edition since re-cut, or edited by hand. Keeping the
 * file's own `editionContentHash` would let `selectForEdition` serve the piece
 * on that stamp alone — the one path that does not read the text — and so let
 * a file put words in the queue that the edition does not have. No real
 * content hash equals this value, so the first session that draws on the piece
 * takes the bump path: the text is looked for in the edition as it stands, and
 * the piece is re-stamped or set aside as stale. Point 3 holds across a file.
 */
export const UNVERIFIED_IMPORT_HASH = "import:uverifisert";

const DRILL_KINDS: readonly DrillKind[] = ["quote", "phrase", "word"];
const QUEUE_SOURCES: readonly QueueItem["source"][] = ["bank", "deviation", "marked"];

function isQueueItem(value: unknown): value is QueueItem {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  const str = (k: string) => typeof v[k] === "string" && (v[k] as string).length > 0;
  return (
    str("id") &&
    str("workId") &&
    str("segmentId") &&
    str("editionId") &&
    str("text") &&
    str("addedAt") &&
    typeof v.wordCount === "number" &&
    DRILL_KINDS.includes(v.kind as DrillKind) &&
    QUEUE_SOURCES.includes(v.source as QueueItem["source"])
  );
}

/** Two pieces are the same piece if they are the same words from the same place. */
function queueKey(item: QueueItem): string {
  return [item.workId, item.segmentId, item.kind, item.text].join("\u0000");
}

export async function exportData(repo: BrandRepository): Promise<BrandExport> {
  const [preferences, sessions, progress, queue] = await Promise.all([
    repo.getPreferences(),
    repo.listSessions(),
    repo.listProgress(),
    repo.listQueue(),
  ]);
  return {
    format: "brand-export",
    formatVersion: EXPORT_FORMAT_VERSION,
    exportedAt: new Date().toISOString(),
    preferences,
    sessions,
    progress,
    queue,
  };
}

export function serializeExport(data: BrandExport): string {
  return JSON.stringify(data, null, 2) + "\n";
}

/** File name that sorts by date and says what it is without being opened. */
export function exportFileName(now = new Date()): string {
  return `brand-data-${now.toISOString().slice(0, 10)}.json`;
}

export class ImportError extends Error {}

/**
 * Reads a previously exported file back in.
 *
 * Additive by design: sessions are written by id, so importing the same file
 * twice leaves one copy of each rather than two, and importing an old file
 * next to newer sessions keeps both. Records that cannot be understood are
 * counted and skipped, never guessed at, and never allowed to abort the rest
 * of the import: a single unreadable row must not cost the reader the other
 * four hundred.
 */
export async function importData(repo: BrandRepository, raw: unknown): Promise<ImportReport> {
  if (!raw || typeof raw !== "object") {
    throw new ImportError("Filen er ikke en BRAND-eksport.");
  }
  const data = raw as Partial<BrandExport>;
  if (data.format !== "brand-export") {
    throw new ImportError("Filen er ikke en BRAND-eksport.");
  }
  if (typeof data.formatVersion !== "number" || data.formatVersion > EXPORT_FORMAT_VERSION) {
    throw new ImportError(
      `Filformat ${String(data.formatVersion)} er nyere enn denne versjonen av BRAND kan lese.`,
    );
  }

  const report: ImportReport = {
    sessionsImported: 0,
    sessionsSkipped: 0,
    progressImported: 0,
    preferencesImported: false,
    queueImported: 0,
    queueSkipped: 0,
  };

  if (data.preferences) {
    await repo.savePreferences(migratePreferences(data.preferences));
    report.preferencesImported = true;
  }

  for (const candidate of Array.isArray(data.sessions) ? data.sessions : []) {
    const session = migrateSession(candidate);
    if (!session) {
      report.sessionsSkipped += 1;
      continue;
    }
    await repo.addSession(session);
    report.sessionsImported += 1;
  }

  // Through the same migration the repository uses on read, and for the same
  // reason: a file exported before 2026-09-07 carries progress keyed by
  // edition, and importing it verbatim would restore a key nothing looks up.
  for (const candidate of Array.isArray(data.progress) ? data.progress : []) {
    const progress = migrateProgress(candidate);
    if (!progress) continue;
    await repo.saveProgress(progress);
    report.progressImported += 1;
  }

  // The queue is merged, never replaced: `saveQueue` writes the whole store,
  // so handing it the file's queue alone would wipe every piece marked since
  // the file was written. What is already here wins a collision — by id, or by
  // being the same words from the same segment under another id (the same
  // passage marked in two browsers) — because it may since have been
  // re-checked against a newer edition, and the file's copy has not.
  if (Array.isArray(data.queue)) {
    const existing = await repo.listQueue();
    const ids = new Set(existing.map((q) => q.id));
    const keys = new Set(existing.map(queueKey));
    const added: QueueItem[] = [];
    for (const candidate of data.queue) {
      if (!isQueueItem(candidate)) {
        report.queueSkipped += 1;
        continue;
      }
      if (ids.has(candidate.id) || keys.has(queueKey(candidate))) continue;
      ids.add(candidate.id);
      keys.add(queueKey(candidate));
      added.push({ ...candidate, editionContentHash: UNVERIFIED_IMPORT_HASH });
    }
    if (added.length > 0) {
      // Insertion order is the queue's order, so the merged queue is ordered
      // by when each piece was added, wherever it was added.
      const merged = [...existing, ...added].sort((a, b) =>
        a.addedAt < b.addedAt ? -1 : a.addedAt > b.addedAt ? 1 : 0,
      );
      await repo.saveQueue(merged);
    }
    report.queueImported = added.length;
  }

  return report;
}
