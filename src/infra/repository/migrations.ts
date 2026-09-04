import { DEFAULT_LANGUAGE_PROFILE_ID } from "@/domain/language/registry";
import {
  DEFAULT_TEXT_FILTER_ID,
  isTextFilterId,
} from "@/domain/text-filter";
import type { SessionResult, UserPreferences } from "@/domain/types";

export const PREFERENCES_SCHEMA_VERSION = 1 as const;
export const SESSION_SCHEMA_VERSION = 2 as const;

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
 * against the edition as printed, so those records migrate by taking that
 * filter and being stamped as version 2. The version has to move, or one
 * number would denote two different serialized shapes and later migrations
 * could not tell them apart.
 */
export function migrateSession(raw: unknown): SessionResult | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  if (typeof r.id !== "string" || typeof r.startedAt !== "string") return null;

  if (r.schemaVersion === 1) {
    return {
      ...(raw as Omit<SessionResult, "schemaVersion" | "textFilterId">),
      schemaVersion: SESSION_SCHEMA_VERSION,
      textFilterId: isTextFilterId(r.textFilterId)
        ? r.textFilterId
        : DEFAULT_TEXT_FILTER_ID,
    };
  }
  if (r.schemaVersion === SESSION_SCHEMA_VERSION) {
    return isTextFilterId(r.textFilterId)
      ? (raw as SessionResult)
      : { ...(raw as SessionResult), textFilterId: DEFAULT_TEXT_FILTER_ID };
  }
  // Anything else was written by a newer build and is not readable here.
  return null;
}
