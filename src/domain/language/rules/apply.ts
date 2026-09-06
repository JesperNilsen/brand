/**
 * Rewriting: the ending of the scan that produces text.
 *
 * `applyRules` and `applyLowercaseNouns` keep the signatures and the behaviour
 * they had when they lived in `scripts/lib/rules.ts`, because six published
 * editions are rebuilt from them and byte-compared. What changed is that they
 * no longer match anything themselves — they consume `stageHits` like the
 * report path does.
 */
import { applyHits, stageHits, stagesFor, type StageHit } from "./match";
import { DEFAULT_RULE_FAMILY, type BaseRules, type Rules } from "./types";

function count(usage: Map<string, number>, hits: readonly StageHit[]): void {
  for (const h of hits) usage.set(h.ruleKey, (usage.get(h.ruleKey) ?? 0) + 1);
}

/**
 * Apply the explicit regex patterns, then whole-word replacements with the
 * source word's case preserved. Word choice, syntax and rhythm are never
 * touched: anything not listed is copied verbatim.
 */
export function applyRules(text: string, rules: Rules, usage: Map<string, number>): string {
  let out = text;
  for (const stage of stagesFor(rules.patterns, rules.replacements)) {
    const hits = stageHits(out, stage);
    count(usage, hits);
    out = applyHits(out, hits);
  }
  return out;
}

/**
 * Lowercase the German-style capitalised common nouns of 19th-century
 * Dano-Norwegian, leaving proper names and sentence-initial words alone.
 */
export function applyLowercaseNouns(
  text: string,
  properNames: ReadonlySet<string>,
  usage: Map<string, number>,
): string {
  const hits = stageHits(text, { kind: "lowercase", properNames });
  count(usage, hits);
  return applyHits(text, hits);
}

/**
 * Fold a profile's base rules into a pack's own, producing the rule set the
 * builder actually applies.
 *
 * Order is the whole contract, so it is stated rather than implied: base
 * patterns run before pack patterns, and on a replacement key present in both,
 * THE PACK WINS. A work whose period or printer spells something its own way
 * must be able to say so without editing a rule set four works share. The
 * validator reports an override rather than allowing it silently, because a
 * pack that merely restates the base value is duplication the composition
 * exists to remove.
 */
export function composeRules(pack: Rules, base: BaseRules | undefined): Rules {
  if (!base) return pack;
  assertCorpusFamily(base, pack.editionId);
  return {
    ...pack,
    patterns: [...(base.patterns ?? []), ...(pack.patterns ?? [])],
    replacements: { ...(base.replacements ?? {}), ...(pack.replacements ?? {}) },
  };
}

/**
 * Refuse to build corpus text with a rule set from the other family.
 *
 * The contemporary-usage family encodes word-choice preferences meant for
 * reporting on the user's own writing. Applying it to a source text would
 * rewrite an author's word choice, which docs/spec/LANGUAGE_PROFILE.md
 * forbids — and would silently change the bytes of every edition built after
 * it. The types make it hard; this makes it impossible once a rule set is
 * resolved by id from JSON, where the types are gone.
 */
export function assertCorpusFamily(base: BaseRules, context: string): void {
  const family = base.family ?? DEFAULT_RULE_FAMILY;
  if (family !== "historical-orthography") {
    throw new Error(
      `${context}: rule set belongs to the ${family} family and may not be composed into a corpus build`,
    );
  }
}

/** Replacement keys a pack redefines, split by whether the value differs. */
export function baseOverrides(
  pack: Rules,
  base: BaseRules | undefined,
): { redundant: string[]; diverging: string[] } {
  const b = base?.replacements ?? {};
  const p = pack.replacements ?? {};
  const redundant: string[] = [];
  const diverging: string[] = [];
  for (const [k, v] of Object.entries(p)) {
    if (!(k in b)) continue;
    (b[k] === v ? redundant : diverging).push(k);
  }
  return { redundant, diverging };
}
