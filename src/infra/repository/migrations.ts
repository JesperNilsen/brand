import { DEFAULT_LANGUAGE_PROFILE_ID } from "@/domain/language/registry";
import {
  DEFAULT_TEXT_FILTER_ID,
  isTextFilterId,
} from "@/domain/text-filter";
import type { SessionResult, UserPreferences } from "@/domain/types";

export const PREFERENCES_SCHEMA_VERSION = 1 as const;
export const SESSION_SCHEMA_VERSION = 3 as const;

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
 * onward there is no way to recover it after the fact. Both migrate forward to
 * the current version. The version number has to move each time, or one number
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
  if (r.schemaVersion !== 1 && r.schemaVersion !== 2 && r.schemaVersion !== 3) {
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

  const migrated: SessionResult = {
    ...(raw as SessionResult),
    schemaVersion: SESSION_SCHEMA_VERSION,
    textFilterId,
    editionVersion,
    editionContentHash,
  };

  // Idempotence is the property every later migration relies on, so return the
  // input untouched when nothing needed changing rather than a fresh object
  // that merely compares equal.
  const unchanged =
    r.schemaVersion === SESSION_SCHEMA_VERSION &&
    r.textFilterId === textFilterId &&
    r.editionVersion === editionVersion &&
    r.editionContentHash === editionContentHash;
  return unchanged ? (raw as SessionResult) : migrated;
}
