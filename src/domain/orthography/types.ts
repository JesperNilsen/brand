/**
 * Writing languages and orthographic norms (D21).
 *
 * A second axis beside `LanguageProfile`, not a replacement for it. A
 * LanguageProfile says which training edition the reader types, and its id is
 * part of every progress key on readers' disks, so it cannot move with a menu
 * choice without losing their places. An `OrthographyProfile` says which norm
 * the reader's OWN spelling is judged against: which forms an orthography
 * exercise accepts, how a deviation is explained, and which rules can be
 * learned.
 *
 * Transcription never consults it. The typing engine compares against the
 * exact edition shown (docs/spec/TYPING_ENGINE.md), and a reader who types
 * «efter» where the text has «etter» has not copied the text, however correct
 * «efter» is in the norm they chose.
 *
 * Nothing in this module may be presented as more certain than its source.
 * Every rule and word entry carries the source it rests on, and an entry no
 * source supports is `unverified` and is labelled so wherever it is shown.
 */

/**
 * The language list in the menu. Brandmål is its own language, not a bokmål
 * norm: it never inherits a bokmål rule by being near one.
 */
export type WritingLanguageId = "brandmal" | "bokmal";

export type WritingLanguage = {
  id: WritingLanguageId;
  displayName: string;
  description: string;
  /** The norms offered for this language, in menu order. */
  orthographyIds: readonly string[];
  /** The norm a reader gets before choosing one. */
  defaultOrthographyId: string;
};

/**
 * What the norm IS, which is a separate question from what Brand can do with
 * it (`ImplementationStatus`). A historical norm is official and not current;
 * neither fact says anything about whether Brand has its rules.
 */
export type OfficialStatus =
  /** Gjeldende offentlig rettskrivning. */
  | "current-official"
  /** Tidligere offentlig rettskrivning; ikke lenger gjeldende. */
  | "historical-official"
  /** Brands egen husnorm (standards/brand). */
  | "house";

/**
 * How much of the norm Brand can check.
 *
 * There is deliberately no "complete". A norm is a word list as much as a set
 * of rules, and no licensed, machine-readable word list for any of these norms
 * is loaded. Calling one complete would be exactly the overclaim this module
 * exists to prevent; the value gets added the day a full list is.
 */
export type ImplementationStatus =
  /** Selectable and described; Brand holds no documented rules for it yet. */
  | "metadata-only"
  /** A small set of sourced rules and word forms; most words cannot be checked. */
  | "partial";

/**
 * A form's standing within one norm.
 *
 * The vocabularies differ by period, and a norm declares which it uses
 * (`OrthographyRuleset.formStatuses`) so a 2005 entry cannot be given a
 * hovedform the 2005 norm abolished, and a 1959 sideform cannot be shown as
 * the textbook form.
 */
export type FormStatus =
  /** Obligatorisk: the only form the norm allows. */
  | "required"
  /** Hovedform: allowed and the textbook form. */
  | "main"
  /** Sideform: allowed, but not the textbook form. Never shown as obligatory. */
  | "side"
  /**
   * Klammeform (1938): allowed in pupils' writing, not in textbooks. A
   * separate value rather than a kind of sideform, because the 1938 norm
   * itself kept them apart.
   */
  | "bracket"
  /** Valgfri: allowed beside another form, with no ranking between them. */
  | "optional"
  /** Tillatt: allowed; the norm does not rank its forms (2005 onward). */
  | "allowed"
  /** Brand: foretrukket. */
  | "preferred"
  /** Brand: tolerert, nøytral variant. */
  | "tolerated"
  /** Brand: tillatt, stilmarkert. Allowed, never an error, not a first choice. */
  | "style-marked"
  /** Outside the norm: a form the norm does not allow (e.g. the pre-reform spelling). */
  | "outside";

/** How firmly a rule or entry is grounded. */
export type Confidence =
  /** Read in the primary source itself; `locator` points at the place. */
  | "verified-primary"
  /** Read in a reliable secondary account; the primary was not opened. */
  | "verified-secondary"
  /** Not pinned to a source. Shown as «ubekreftet», never as fact. */
  | "unverified";

export type SourceKind = "primary" | "secondary" | "house";

export type OrthographySource = {
  id: string;
  title: string;
  authors?: string;
  year: number;
  kind: SourceKind;
  url: string;
  /** What the rights position of the document is, in a sentence. */
  rights: string;
};

export type SourceRef = {
  sourceId: string;
  /** Page, section or paragraph — as precise as the source allows. */
  locator: string;
};

export type RuleKind = "spelling" | "inflection" | "form-status" | "exception";

export type OrthographyRule = {
  id: string;
  kind: RuleKind;
  /** One sentence for the reader, in Norwegian. */
  summary: string;
  sources: readonly SourceRef[];
  confidence: Confidence;
};

export type WordForm = {
  form: string;
  status: FormStatus;
  /** Shown beside the form, e.g. «formen før 1907». */
  note?: string;
};

/**
 * One word under one norm: every form a source documents for it, with each
 * form's standing. Forms no source names are not here, and the judge treats
 * them as undocumented rather than wrong.
 */
export type WordEntry = {
  id: string;
  /**
   * A stable key for the word across norms — its modern bokmål citation
   * form. Only an identifier: it is never shown as the answer.
   */
  lexeme: string;
  /** Meaning, when the form depends on it (have = hage, not å ha). */
  gloss?: string;
  forms: readonly WordForm[];
  ruleId: string;
  /** Defaults to the rule's sources and confidence when absent. */
  sources?: readonly SourceRef[];
  confidence?: Confidence;
};

/** A short passage that shows the norm in use, quoted from a source. */
export type ExampleText = {
  text: string;
  source: SourceRef;
};

export type OrthographyRuleset = {
  /** The form statuses this norm uses. A form with any other status is a data error. */
  formStatuses: readonly FormStatus[];
  rules: readonly OrthographyRule[];
  words: readonly WordEntry[];
  exampleTexts: readonly ExampleText[];
};

/** The «språkprofil» of the specification: one norm of one language. */
export type OrthographyProfile = {
  /** = orthographyId, e.g. "bokmal-1938". */
  id: string;
  languageId: WritingLanguageId;
  displayName: string;
  /** The years the norm was in force; `to` absent while it still is. */
  historicalPeriod: { from: number; to?: number };
  /** Who adopted or maintains the norm. */
  authority: string;
  officialStatus: OfficialStatus;
  /**
   * The version of its language in force today. Exactly one per language.
   * For an official norm that means gjeldende offentlig rettskrivning; for
   * Brandmål, the current version of the house standard.
   */
  isCurrent: boolean;
  implementationStatus: ImplementationStatus;
  /** Sources for the norm as a whole: the decision, the rule book, the word list. */
  sources: readonly SourceRef[];
  ruleset: OrthographyRuleset;
  /**
   * The LanguageProfile whose training editions are written to this norm, if
   * any. Absent for every bokmål norm today: no edition is normalised to one,
   * and the chooser says so rather than implying it.
   */
  editionProfileId?: string;
};

/** What the reader has chosen. Derived from preferences; never stored as-is. */
export type WritingNormSelection = {
  languageId: WritingLanguageId;
  orthographyId: string;
};
