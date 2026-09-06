/**
 * The shared vocabulary of the rule engine.
 *
 * Two normative directions exist, and they must never be composed together —
 * see `RuleFamily`. Everything else here is the shape of a rule set and the
 * shape of a report about one.
 */

/**
 * Which direction a rule set moves text in.
 *
 * `historical-orthography` is the corpus family: 19th-century Dano-Norwegian
 * spelling to riksmål (`blev` → `ble`). It rewrites source texts at build time.
 *
 * `contemporary-usage` is the opposite direction and a different job: modern
 * bokmål to the BRAND norm (`boka` → `boken`), used only to REPORT on writing
 * the user produced themselves. It must never reach `composeRules`: those are
 * word-choice preferences, and docs/spec/LANGUAGE_PROFILE.md forbids changing
 * an author's word choice. Folding one into a corpus build would break both
 * the editorial contract and the byte-identical rebuild of every published
 * edition at the same time.
 */
export type RuleFamily = "historical-orthography" | "contemporary-usage";

/** The family a rule set that omits the field belongs to. */
export const DEFAULT_RULE_FAMILY: RuleFamily = "historical-orthography";

export type RulePattern = { from: string; to: string; flags?: string; note?: string };

export type Rules = {
  editionId: string;
  version: string;
  languageProfileId: string;
  /**
   * Id of a frozen base rule set owned by the language profile
   * (`brand-riksmaal.base.v1`). The pack inherits it and lists below only what
   * is particular to its own text. Absent on v1 editions, which predate the
   * mechanism and stay self-contained so they still rebuild byte for byte.
   */
  baseRules?: string;
  notes?: string[];
  patterns?: RulePattern[];
  replacements?: Record<string, string>;
  lowercaseNouns?: { properNames: string[] };
  retained?: Record<string, string>;
};

/** The base half of a composition: what a profile's frozen rule set contributes. */
export type BaseRules = {
  /** Absent means `historical-orthography`; anything else may not be composed. */
  family?: RuleFamily;
  patterns?: RulePattern[];
  replacements?: Record<string, string>;
};

export type RuleKind = "pattern" | "replacement" | "lowercase";

/** One place a rule fires, located in the text the report was asked about. */
export type RuleHit = {
  ruleKind: RuleKind;
  /** Stable identity of the rule: the pattern source, or the dictionary key. */
  ruleKey: string;
  /** Exactly what was matched, and exactly what would be put there. */
  from: string;
  to: string;
  /**
   * Offsets into the text `analyzeText` was given — not into the intermediate
   * text of whatever stage produced the hit. A hit from a later stage that
   * lands inside an earlier stage's replacement is reported at that
   * replacement's span, which is the honest answer: that is the region of the
   * original the change belongs to.
   */
  start: number;
  end: number;
  context: { before: string; after: string };
  note?: string;
};

export type RuleReport = {
  ruleSetId: string;
  family: RuleFamily;
  hits: RuleHit[];
  /** Rules in the set that matched nothing here. The absence is the useful half. */
  silent: { ruleKind: RuleKind; ruleKey: string }[];
  /** What the rules would produce. This path never writes it anywhere. */
  wouldBe: string;
};
