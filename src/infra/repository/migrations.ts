import { DEFAULT_LANGUAGE_PROFILE_ID } from "@/domain/language/registry";
import type { SessionResult, UserPreferences } from "@/domain/types";

export const PREFERENCES_SCHEMA_VERSION = 1 as const;
export const SESSION_SCHEMA_VERSION = 1 as const;

export function defaultPreferences(): UserPreferences {
  return {
    schemaVersion: PREFERENCES_SCHEMA_VERSION,
    theme: "system",
    languageProfileId: DEFAULT_LANGUAGE_PROFILE_ID,
    defaultErrorMode: "flow",
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
    lastModeId: typeof r.lastModeId === "string" ? r.lastModeId : undefined,
    lastContentPackId:
      typeof r.lastContentPackId === "string" ? r.lastContentPackId : undefined,
    lastWorkId: typeof r.lastWorkId === "string" ? r.lastWorkId : undefined,
    lastTimedLimitMs:
      typeof r.lastTimedLimitMs === "number" ? r.lastTimedLimitMs : undefined,
  };
}

/** Returns null when a stored session cannot be understood. */
export function migrateSession(raw: unknown): SessionResult | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  if (typeof r.id !== "string" || typeof r.startedAt !== "string") return null;
  if (r.schemaVersion === SESSION_SCHEMA_VERSION) return raw as SessionResult;
  // No older versions exist yet; anything else is unreadable.
  return null;
}
