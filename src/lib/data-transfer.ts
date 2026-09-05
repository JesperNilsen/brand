import type { BrandRepository } from "@/infra/repository";
import { migratePreferences, migrateSession } from "@/infra/repository/migrations";
import type { ReadingProgress, SessionResult, UserPreferences } from "@/domain/types";

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
};

export type ImportReport = {
  sessionsImported: number;
  sessionsSkipped: number;
  progressImported: number;
  preferencesImported: boolean;
};

export async function exportData(repo: BrandRepository): Promise<BrandExport> {
  const [preferences, sessions, progress] = await Promise.all([
    repo.getPreferences(),
    repo.listSessions(),
    repo.listProgress(),
  ]);
  return {
    format: "brand-export",
    formatVersion: EXPORT_FORMAT_VERSION,
    exportedAt: new Date().toISOString(),
    preferences,
    sessions,
    progress,
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

function isProgress(value: unknown): value is ReadingProgress {
  if (!value || typeof value !== "object") return false;
  const p = value as Record<string, unknown>;
  return (
    typeof p.key === "string" &&
    typeof p.workId === "string" &&
    typeof p.editionId === "string" &&
    Array.isArray(p.completedSegmentIds)
  );
}

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

  for (const candidate of Array.isArray(data.progress) ? data.progress : []) {
    if (!isProgress(candidate)) continue;
    await repo.saveProgress(candidate);
    report.progressImported += 1;
  }

  return report;
}
