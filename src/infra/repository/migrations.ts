import { DEFAULT_LANGUAGE_PROFILE_ID } from "@/domain/language/registry";
import {
  DEFAULT_TEXT_FILTER_ID,
  isTextFilterId,
} from "@/domain/text-filter";
import { progressKey, type ReadingProgress, type SessionResult, type UserPreferences } from "@/domain/types";

export const PREFERENCES_SCHEMA_VERSION = 1 as const;
export const SESSION_SCHEMA_VERSION = 4 as const;

/**
 * Stamped on records written before editions carried a version and a hash.
 * Never a guess: the text those sessions were typed against cannot be
 * identified now, and inventing provenance is worse than admitting its absence.
 */
export const UNKNOWN_EDITION = "unknown" as const;

export function defaultPreferences(): UserPreferences {
  return {
    schemaVersion: PREFERENCES_SCHEMA_VERSION,
    theme: "system",
    languageProfileId: DEFAULT_LANGUAGE_PROFILE_ID,
    defaultErrorMode: "flow",
    textFilterId: DEFAULT_TEXT_FILTER_ID,
  };
}

/**
 * Idempotent: unknown or older shapes are folded into the current schema,
 * unknown fields dropped, current records returned unchanged.
 */
export function migratePreferences(raw: unknown): UserPreferences {
  const base = defaultPreferences();
  if (!raw || typeof raw !== "object") return base;
  const r = raw as Record<string, unknown>;
  const theme = r.theme;
  return {
    schemaVersion: PREFERENCES_SCHEMA_VERSION,
    theme:
      theme === "light" || theme === "dark" || theme === "system"
        ? theme
        : base.theme,
    languageProfileId:
      typeof r.languageProfileId === "string"
        ? r.languageProfileId
        : base.languageProfileId,
    defaultErrorMode:
      r.defaultErrorMode === "stop-on-error" ? "stop-on-error" : "flow",
    textFilterId: isTextFilterId(r.textFilterId)
      ? r.textFilterId
      : base.textFilterId,
    lastModeId: typeof r.lastModeId === "string" ? r.lastModeId : undefined,
    lastContentPackId:
      typeof r.lastContentPackId === "string" ? r.lastContentPackId : undefined,
    lastWorkId: typeof r.lastWorkId === "string" ? r.lastWorkId : undefined,
    lastTimedLimitMs:
      typeof r.lastTimedLimitMs === "number" ? r.lastTimedLimitMs : undefined,
  };
}

/**
 * Returns null when a stored session cannot be understood.
 *
 * Version 1 predates text filters: every session recorded then was typed
 * against the edition as printed, so those records take that filter.
 * Version 2 predates edition versioning: those records name an edition id but
 * not which version of it, and since editions are immutable from version 3
 * onward there is no way to recover it after the fact. Version 3 predates
 * pausing, so those records get pausedMs 0 — a fact, not a guess like the
 * unknown edition above: there was no way to pause them. All migrate forward
 * to the current version. The version number has to move each time, or one number
 * would denote two different serialized shapes and a later migration could not
 * tell them apart.
 *
 * The fields are required when writing and tolerated when reading, which is
 * why the repair below fills rather than rejects.
 */
export function migrateSession(raw: unknown): SessionResult | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  if (typeof r.id !== "string" || typeof r.startedAt !== "string") return null;
  if (
    r.schemaVersion !== 1 &&
    r.schemaVersion !== 2 &&
    r.schemaVersion !== 3 &&
    r.schemaVersion !== 4
  ) {
    // Written by a newer build, or not a session at all.
    return null;
  }

  const textFilterId = isTextFilterId(r.textFilterId)
    ? r.textFilterId
    : DEFAULT_TEXT_FILTER_ID;
  const editionVersion =
    typeof r.editionVersion === "string" && r.editionVersion.length > 0
      ? r.editionVersion
      : UNKNOWN_EDITION;
  const editionContentHash =
    typeof r.editionContentHash === "string" && r.editionContentHash.length > 0
      ? r.editionContentHash
      : UNKNOWN_EDITION;

  const pausedMs = typeof r.pausedMs === "number" && r.pausedMs >= 0 ? r.pausedMs : 0;
  const pauseCount =
    typeof r.pauseCount === "number" && r.pauseCount >= 0 ? r.pauseCount : 0;

  const migrated: SessionResult = {
    ...(raw as SessionResult),
    schemaVersion: SESSION_SCHEMA_VERSION,
    textFilterId,
    editionVersion,
    editionContentHash,
    pausedMs,
    pauseCount,
  };

  // Idempotence is the property every later migration relies on, so return the
  // input untouched when nothing needed changing rather than a fresh object
  // that merely compares equal.
  const unchanged =
    r.schemaVersion === SESSION_SCHEMA_VERSION &&
    r.textFilterId === textFilterId &&
    r.editionVersion === editionVersion &&
    r.editionContentHash === editionContentHash &&
    r.pausedMs === pausedMs &&
    r.pauseCount === pauseCount;
  return unchanged ? (raw as SessionResult) : migrated;
}

/**
 * Returns null when a stored progress record cannot be understood.
 *
 * The key is **recomputed from the record's own fields** rather than parsed out
 * of the stored one. Records written before 2026-09-07 carry a key that
 * included the edition id, so a new training edition gave the same reader, on
 * the same work, a key nothing looked up — their place was still on disk and
 * the app started them over anyway. Recomputing folds those records onto the
 * key the app asks for today, and does the same for a key from any shape this
 * has not seen, without needing to recognise the old format.
 *
 * There is no schemaVersion here, deliberately: a progress record is small and
 * fully described by its fields, and a version number would have to be migrated
 * before it could tell us anything the fields do not already say.
 */
export function migrateProgress(raw: unknown): ReadingProgress | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  if (
    typeof r.workId !== "string" ||
    typeof r.languageProfileId !== "string" ||
    typeof r.gameModeId !== "string" ||
    typeof r.nextSegmentId !== "string" ||
    typeof r.updatedAt !== "string" ||
    !Array.isArray(r.completedSegmentIds) ||
    r.completedSegmentIds.some((id) => typeof id !== "string")
  ) {
    return null;
  }
  // A record written before modules existed has no moduleId, and therefore
  // recomputes to exactly the key it already carries. That is the whole
  // migration for the four works that exist today: nothing.
  const moduleId = typeof r.moduleId === "string" && r.moduleId ? r.moduleId : undefined;
  const key = progressKey({
    languageProfileId: r.languageProfileId,
    gameModeId: r.gameModeId,
    workId: r.workId,
    moduleId,
  });
  // Missing rather than wrong: a record with no edition names none, the way a
  // pre-versioning session does. It is descriptive, so it is filled, not
  // grounds for rejecting a reader's place in a book.
  const editionId = typeof r.editionId === "string" ? r.editionId : UNKNOWN_EDITION;
  // Idempotence by identity, as with migrateSession: this runs on every read of
  // every record, and a later migration will run on its output.
  if (r.key === key && r.editionId === editionId) return raw as ReadingProgress;
  return { ...(raw as ReadingProgress), key, editionId };
}

/**
 * One record per key, newest last-written wins, completed segments unioned.
 *
 * Two records collide exactly when a reader read the same work in the same mode
 * under two editions — which is the situation this migration exists for. The
 * union is the honest answer: they really did write those passages, and a
 * segment id names the same passage in both editions. The rest of the record
 * comes from the newer one, so the resume point is the one they last left.
 */
export function mergeProgress(records: readonly ReadingProgress[]): ReadingProgress[] {
  const byKey = new Map<string, ReadingProgress>();
  for (const record of records) {
    const existing = byKey.get(record.key);
    if (!existing) {
      byKey.set(record.key, record);
      continue;
    }
    const [older, newer] =
      existing.updatedAt <= record.updatedAt ? [existing, record] : [record, existing];
    const completed = new Set(older.completedSegmentIds);
    for (const id of newer.completedSegmentIds) completed.add(id);
    byKey.set(record.key, { ...newer, completedSegmentIds: [...completed] });
  }
  return [...byKey.values()];
}
