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
 * The exceptions are RuleFamily and AdaptationStatus, which the rule engine
 * owns and this file re-exports rather than restating — two spellings of either
 * union would let a rule set be one thing here and another there.
 */
import type { AdaptationStatus, RuleFamily } from "./language/rules/types";

export type { AdaptationStatus, RuleFamily };

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
  /**
   * Frozen orthographic rule sets the profile owns, newest last. A content
   * pack inherits one by id and lists only what is particular to its own text,
   * so a normalisation the profile considers settled cannot be present in one
   * work and missing in another. Immutable once published: an edition is
   * rebuilt from exactly the base set it was produced with.
   */
};

/** A published, immutable set of base orthographic rules owned by a profile. */
export type LanguageBaseRuleSet = {
  id: string;
  languageProfileId: string;
  version: string;
  /**
   * Which normative direction the set moves text in. Absent means the corpus
   * family (`historical-orthography`), which is the only one a build may
   * compose; see `src/domain/language/rules/types.ts`.
   */
  family?: RuleFamily;
  notes?: string[];
  replacements?: Record<string, string>;
  patterns?: { from: string; to: string; flags?: string; note?: string }[];
};

// ---------------------------------------------------------------------------
// GameMode
// ---------------------------------------------------------------------------

export type GameModeId = "nonstop" | "passage" | "timed" | "drill";

export type GameMode = {
  id: GameModeId | string;
  displayName: string;
  availableInV1: boolean;
  /**
   * Whether the mode has a chooser at `/velg/<id>` and is offered in the list
   * of modes. Drill has none, and that is the mode: it exists so a reader can
   * start writing without choosing anything, so a page that asks them to
   * choose would be the feature undone.
   */
  hasChooser: boolean;
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

/**
 * The rights claim on a source, as a value beside the prose, never instead of
 * it.
 *
 * `license` keeps the full sentence — it is what the reader sees on `/om`, and
 * a rights statement compressed into an enum is a rights statement that has
 * lost the part someone would need to check it. This is the sortable half.
 *
 * `public-domain` is derived from the death year alone; `public-domain-verified`
 * means someone looked at the concrete source. All 25 works in
 * `docs/spec/CORPUS.md` pass the death-year sort, which is exactly why passing
 * it is not enough on its own.
 */
export type RightsStatus = "public-domain" | "public-domain-verified" | "restricted" | "unknown";

/**
 * The language the work was WRITTEN in, as opposed to
 * `SourceAttribution.language`, which describes the transcription that was
 * fetched.
 *
 * They are not the same question and they will diverge: a Wikikilden page of a
 * Danish text is transcribed by a Norwegian project. The catalogue needs the
 * first to know which rule set applies (D17: dansk-dansk is a different
 * starting point, not an extension of the Norwegian one).
 */
export type OriginalLanguage = "da-NO" | "da-DK" | "nb-NO" | "nn-NO";

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
  /**
   * The year the author died — the one fact the first sort in
   * `docs/spec/CORPUS.md` reads («forfatteren døde i 1955 eller tidligere»).
   *
   * It is a number rather than a sentence inside `license` because a sentence
   * cannot be sorted, and with 25 works in the plan this is the field that
   * decides what may be imported at all.
   */
  authorDeathYear: number;
  /** Rights status / licence of the text as used. */
  license: string;
  /** The sortable half of `license`. See RightsStatus. */
  rightsStatus: RightsStatus;
  /**
   * Why this text is usable even though the author died after 1955.
   *
   * Required exactly then, and meaningless otherwise: the death-year sort is
   * the cheap first pass, and a work that fails it needs a reason written down
   * rather than an enum quietly asserting the opposite.
   */
  rightsBasis?: string;
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
  /**
   * The novella, act or chapter this segment belongs to, when the work has
   * more than one. Present only where a pack authored it in `segments.json`;
   * a work with a single part has none, and its list stays flat.
   *
   * Not part of `contentHash`: the hash covers `id`, `order` and `text`, so
   * naming the parts of an existing work does not create a new edition of it.
   */
  part?: string;
  /**
   * The module this segment belongs to, when the edition declares modules.
   *
   * Stricter than `part`, and for one reason: a module has its own progress.
   * `part` is a free string with no identity, so two works can spell the same
   * part differently and nothing can key on it; `moduleId` names a record in
   * `TextEditionMeta.modules` with an id and an order. Where a pack has both,
   * `part` stays as the display name.
   *
   * Not part of `contentHash`, for the same reason `part` is not: the hash
   * covers `id`, `order` and `text`, so dividing an existing work into modules
   * does not create a new edition of it.
   */
  moduleId?: string;
  label?: string;
  wordCount: number;
  difficulty?: 1 | 2 | 3 | 4 | 5;
};

/**
 * A named division of a work that carries its own progress.
 *
 * The case that forces it is *Enten–Eller*: it is one work in the catalogue,
 * but Diapsalmata has to be finishable while Forførerens Dagbog is not. D14 put
 * progress on the work; a module is one more level, and it has to exist before
 * such a work is imported rather than after — a model widened after text is
 * imported changes text that has already been written against (D15).
 *
 * `difficulty` is optional because it is usually derivable: absent, the module
 * takes the difficulty of the segments it contains.
 */
export type TextModule = {
  id: string;
  title: string;
  order: number;
  difficulty?: 1 | 2 | 3 | 4 | 5;
};

export type TextEditionKind = "original" | "training-edition";

/**
 * An edition without its text: everything the app needs to name, list and
 * attribute a text, and to fetch the text itself. Small enough to ship in the
 * bundle however far the corpus grows.
 */
/** How far a training edition has got through editorial review. */
export type ReviewStatus = "unreviewed" | "in-review" | "reviewed";

export type TextEditionMeta = {
  id: string;
  workId: string;
  kind: TextEditionKind;
  /** Immutable once published. A correction is a new version, never an edit. */
  version: string;
  /**
   * SHA-256 over the ordered segments (id, order, text) and nothing else, so
   * it moves when the text the reader types moves and stays put when an
   * editorial note is reworded. Computed by the builders, verified by
   * `pnpm validate:content`, and re-verified in the browser against the
   * fetched text.
   */
  contentHash: string;
  languageProfileId?: string;
  /** For training editions: the original edition this is derived from. */
  basedOnEditionId?: string;
  /** The original's contentHash at build time, so drift underneath is visible. */
  basedOnContentHash?: string;
  /**
   * Whether a human has read this training edition against its original.
   *
   * NOT the same thing as `SourceAttribution.verificationStatus`, which is
   * about whether the transcription matches the source. This is about whether
   * the normalisation an editor applied on top of it is defensible — a
   * faithful transcription can still be normalised badly. Recorded in
   * `content/<pack>/review.json`, which is a sibling of the edition rather
   * than part of it: a review is a statement ABOUT a frozen edition, and
   * writing it into the edition would change the bytes `validate:content`
   * rebuilds and compares.
   */
  reviewStatus?: ReviewStatus;
  reviewedBy?: string;
  /** ISO date (YYYY-MM-DD). */
  reviewedAt?: string;
  editorialNotes?: string[];
  /** Number of segments in the edition, so a list can be sized without the text. */
  segmentCount: number;
  /** Words across all segments, for the reading-time estimate. */
  wordCount: number;
  /**
   * Path under `public/`, content-hashed so it can be cached forever: a text
   * that changes gets a new name rather than a new copy under an old one.
   */
  file: string;
  /**
   * The modules this edition is divided into, in reading order.
   *
   * On the catalogue rather than in the asset: a chooser has to name the parts
   * of a four-hundred-segment work before deciding whether to fetch its text.
   * Which segment belongs to which module rides with the segment.
   */
  modules?: TextModule[];
  /** The drill bank cut from this edition, when it has one. */
  drills?: DrillBankMeta;
  /**
   * What was done to the text. An original is `none`; a training edition says
   * what its rule set actually does. See AdaptationStatus.
   */
  adaptationStatus: AdaptationStatus;
};

/** One short item in a drill bank: a quote, a clause, or a single hard word. */
export type DrillKind = "quote" | "phrase" | "word";

export type DrillItem = {
  id: string;
  order: number;
  kind: DrillKind;
  text: string;
  wordCount: number;
};

/**
 * Where an edition's drill bank lives and what it is.
 *
 * A sibling of the edition asset, under the same rules: content-hashed
 * filename, hash re-verified in the browser, never bundled. The items are
 * verbatim fragments of the edition — `pnpm validate:content` refuses a bank
 * whose text is not in the edition it sits beside — so the bank carries
 * exactly the rights the edition does.
 */
export type DrillBankMeta = {
  id: string;
  contentHash: string;
  itemCount: number;
  file: string;
};

/** An edition with its text loaded. */
export type TextEdition = TextEditionMeta & {
  segments: TextSegment[];
};

export type Work = {
  id: string;
  contentPackId: string;
  author: string;
  title: string;
  publishedYear?: number;
  /** The language the work was written in. See OriginalLanguage. */
  originalLanguage: OriginalLanguage;
  editions: TextEditionMeta[];
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

/**
 * A curated selection of works, in curated order.
 *
 * A shelf is not an owner. A `ContentPack` owns its works (`workIds`) and a
 * work belongs to exactly one; a shelf is an editorial grouping the same work
 * can appear on more than once — Georg Brandes stands on «Idé og tro» and on
 * «Korte tekster» from the catalogue's first day. That is why membership lives
 * here, pointing at `workId`, rather than as a field on `Work`: a field would
 * force a choice the catalogue does not want to make, and a `tags` entry has
 * neither a display title nor a curated order.
 *
 * Adding a work to a second shelf adds a `workId` to a list. It never adds a
 * second content entry — see `docs/spec/CORPUS.md`, «Hyller», and D17.
 */
export type Shelf = {
  id: string;
  title: string;
  description: string;
  workIds: string[];
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
  /** profile + mode + work (+ module), see progressKey(). */
  key: string;
  workId: string;
  editionId: string;
  languageProfileId: string;
  gameModeId: string;
  /**
   * The module this place is inside, when the work has modules.
   *
   * Absent for every work that has none, which is all four today — and that
   * absence is load-bearing: it is what keeps their keys byte-identical to the
   * ones already on readers' disks. See progressKey().
   */
  moduleId?: string;
  nextSegmentId: string;
  completedSegmentIds: string[];
  /** ISO timestamp. */
  updatedAt: string;
};

export type SessionStatus = "completed" | "abandoned";

export type SessionResult = {
  id: string;
  /**
   * 1 = before text filters existed; 2 adds the required textFilterId;
   * 3 adds editionVersion and editionContentHash, so a stored result names
   * the exact text it was typed against rather than just the edition id;
   * 4 adds pausedMs and pauseCount.
   */
  schemaVersion: 4;
  /** ISO timestamp. */
  startedAt: string;
  completedAt?: string;
  status: SessionStatus;
  gameModeId: string;
  languageProfileId: string;
  contentPackId: string;
  workId: string;
  editionId: string;
  /**
   * The edition's version and content hash at the time of typing.
   * `"unknown"` on records migrated from schema 1 or 2, which predate the
   * fields: never guess provenance for text that cannot be identified.
   */
  editionVersion: string;
  editionContentHash: string;
  segmentIds: string[];
  errorMode: ErrorMode;
  /** Which practice-form transform the target text was typed under. */
  textFilterId: TextFilterId;
  /** Time typing, with any paused time already subtracted. */
  durationMs: number;
  /**
   * Time spent paused. Not part of durationMs — it is recorded so a rested
   * session is not read as an unbroken one. Always 0 on records from schema 1
   * to 3, which is a fact rather than a guess: pause did not exist then.
   */
  pausedMs: number;
  pauseCount: number;
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

/**
 * Stable key for ReadingProgress: profile, mode and work.
 *
 * The edition used to be part of it, and that was wrong. A reader's place is in
 * the *work*, not in one cut of it — so a new training edition handed every
 * reader a fresh key and started them over without saying so. It had already
 * happened once, undocumented, when three packs moved to v2, and it would have
 * happened again on the first v3.
 *
 * Editions of a work are built from the same `segments.json`, so a segment id
 * means the same passage across versions and progress carries over intact. A
 * future edition that re-segments a work would break that assumption, and the
 * record still names the edition it was written against so such a case can be
 * recognised rather than silently trusted.
 */
export function progressKey(input: {
  languageProfileId: string;
  gameModeId: string;
  workId: string;
  /**
   * Accepted and deliberately unused: call sites hold the edition they are
   * typing and should not have to know it left the key.
   */
  editionId?: string;
  /**
   * The module, when the work has them. Appended only when present — a work
   * without modules must produce the key it produced before modules existed,
   * because that key is already on readers' disks. An unconditional element
   * (an empty string, a placeholder) would change every one of those keys and
   * lose every reader's place at once, which is why the regression test on
   * this asserts the exact string rather than "a key".
   */
  moduleId?: string;
}): string {
  const parts = [input.languageProfileId, input.gameModeId, input.workId];
  if (input.moduleId) parts.push(input.moduleId);
  return parts.join("::");
}
