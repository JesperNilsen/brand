/**
 * BRAND domain types.
 *
 * Four independent axes (see docs/spec/PRODUCT.md):
 *   LanguageProfile — which language form (e.g. brand-riksmaal)
 *   GameMode        — how the user trains (nonstop, passage, timed)
 *   ContentPack     — what the user trains on (works, editions, segments)
 *   TextEdition     — which text version is shown (original | training-edition)
 *
 * None of these types import from each other's modules; they only share ids.
 */

export type ErrorMode = "flow" | "stop-on-error";

export type ThemePreference = "system" | "light" | "dark";

/** Practice-form transform applied to the target text; see domain/text-filter. */
export type TextFilterId = "as-printed" | "no-punctuation" | "words-only";

// ---------------------------------------------------------------------------
// LanguageProfile
// ---------------------------------------------------------------------------

export type LanguageProfile = {
  id: string;
  version: string;
  displayName: string;
  /** BCP-47 locale, e.g. "nb-NO". */
  locale: string;
  description: string;
  /** Preferred form → the form it is preferred over ("frem" → "fram"). */
  preferredForms: Record<string, string>;
};

// ---------------------------------------------------------------------------
// GameMode
// ---------------------------------------------------------------------------

export type GameModeId = "nonstop" | "passage" | "timed";

export type GameMode = {
  id: GameModeId | string;
  displayName: string;
  availableInV1: boolean;
  defaultErrorMode: ErrorMode;
  /** Declarative description of the mode's settings; UI-agnostic. */
  settingsSchema: Record<string, unknown>;
};

// ---------------------------------------------------------------------------
// Content
// ---------------------------------------------------------------------------

export type VerificationStatus =
  | "unverified"
  | "agent-drafted"
  | "editor-verified";

export type SourceAttribution = {
  author: string;
  title: string;
  publishedYear?: number;
  /** Language of the source text, BCP-47. */
  language: string;
  sourceUrl: string;
  archiveId?: string;
  /** ISO date the source was retrieved. */
  retrievedAt: string;
  /** Who makes the digital text available (e.g. "Wikikilden", "Project Runeberg"). */
  provider: string;
  /** Rights status / licence of the text as used. */
  license: string;
  /** Printed edition / transcription the digital text is based on. */
  digitalEdition: string;
  editorialNotes?: string[];
  verificationStatus: VerificationStatus;
  verifiedBy?: string;
};

export type TextSegment = {
  id: string;
  order: number;
  text: string;
  label?: string;
  wordCount: number;
  difficulty?: 1 | 2 | 3 | 4 | 5;
};

export type TextEditionKind = "original" | "training-edition";

export type TextEdition = {
  id: string;
  workId: string;
  kind: TextEditionKind;
  version: string;
  languageProfileId?: string;
  /** For training editions: the original edition this is derived from. */
  basedOnEditionId?: string;
  segments: TextSegment[];
  editorialNotes?: string[];
};

export type Work = {
  id: string;
  contentPackId: string;
  author: string;
  title: string;
  publishedYear?: number;
  editions: TextEdition[];
  source: SourceAttribution;
};

export type ContentPackStatus = "draft" | "active" | "archived";

export type ContentPack = {
  id: string;
  title: string;
  description: string;
  languageProfileIds: string[];
  workIds: string[];
  tags: string[];
  sourceAttribution: SourceAttribution[];
  status: ContentPackStatus;
};

// ---------------------------------------------------------------------------
// User data (persisted)
// ---------------------------------------------------------------------------

export type UserPreferences = {
  schemaVersion: 1;
  theme: ThemePreference;
  languageProfileId: string;
  defaultErrorMode: ErrorMode;
  textFilterId: TextFilterId;
  lastModeId?: string;
  lastContentPackId?: string;
  lastWorkId?: string;
  lastTimedLimitMs?: number;
};

export type ReadingProgress = {
  /** profile + edition + mode + work, see progressKey(). */
  key: string;
  workId: string;
  editionId: string;
  languageProfileId: string;
  gameModeId: string;
  nextSegmentId: string;
  completedSegmentIds: string[];
  /** ISO timestamp. */
  updatedAt: string;
};

export type SessionStatus = "completed" | "abandoned";

export type SessionResult = {
  id: string;
  schemaVersion: 1;
  /** ISO timestamp. */
  startedAt: string;
  completedAt?: string;
  status: SessionStatus;
  gameModeId: string;
  languageProfileId: string;
  contentPackId: string;
  workId: string;
  editionId: string;
  segmentIds: string[];
  errorMode: ErrorMode;
  /** Which practice-form transform the target text was typed under. */
  textFilterId: TextFilterId;
  durationMs: number;
  targetCharacterCount: number;
  typedCharacterCount: number;
  correctCharacterCount: number;
  /** Mistyped insertions during the session, including ones later corrected. */
  errorCount: number;
  grossWpm: number;
  netWpm: number;
  /** 0..1 */
  accuracy: number;
};

export type SessionQuery = {
  gameModeId?: string;
  workId?: string;
  textFilterId?: TextFilterId;
  /** Newest first when true (default). */
  newestFirst?: boolean;
  limit?: number;
};

/** Stable key for ReadingProgress. */
export function progressKey(input: {
  languageProfileId: string;
  editionId: string;
  gameModeId: string;
  workId: string;
}): string {
  return [
    input.languageProfileId,
    input.editionId,
    input.gameModeId,
    input.workId,
  ].join("::");
}
