/**
 * The pure core of the training-edition builder: the text transforms, with no
 * filesystem, no argv and no side effects.
 *
 * They live apart from `scripts/import/build-training-edition.ts` because that
 * module runs `main()` on import, so nothing could exercise these functions
 * without the CLI running too. They are also the most error-prone code in the
 * repository, and the code that Phase 4 restructures, so they need tests that
 * hold still while the builder around them changes.
 */
import { isWordToken, matchCase, tokenize } from "./text";

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
  patterns?: { from: string; to: string; flags?: string; note?: string }[];
  replacements?: Record<string, string>;
  lowercaseNouns?: { properNames: string[] };
  retained?: Record<string, string>;
};

/** The base half of a composition: what a profile's frozen rule set contributes. */
export type BaseRules = {
  patterns?: { from: string; to: string; flags?: string; note?: string }[];
  replacements?: Record<string, string>;
};

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
  return {
    ...pack,
    patterns: [...(base.patterns ?? []), ...(pack.patterns ?? [])],
    replacements: { ...(base.replacements ?? {}), ...(pack.replacements ?? {}) },
  };
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

/** Characters that end a sentence, or a dialogue dash that starts one. */
export const SENTENCE_BOUNDARY = /[.!?…—]/;
/** Opening quote marks used in the source texts (Danish „…“, guillemets, straight). */
export const OPENING_QUOTE = /[„«"'‘“]/;

/**
 * True if the word token at `tokens[i]` starts a sentence.
 *
 * Deliberately narrow: the first word of the segment, or a word whose
 * preceding non-word run contains a sentence-ending mark or an opening quote.
 * It does not parse abbreviations and does not tell a parenthetical dash from
 * a true sentence break. Both limits are tested rather than hidden, because
 * the failure they cause is a wrongly-cased word in a literary text.
 */
export function isSentenceInitial(tokens: string[], i: number): boolean {
  if (i === 0) return true;
  const between = tokens[i - 1];
  return SENTENCE_BOUNDARY.test(between) || OPENING_QUOTE.test(between);
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
  const tokens = tokenize(text);
  return tokens
    .map((tok, i) => {
      if (!isWordToken(tok)) return tok;
      const first = tok[0];
      if (!first || first === first.toLowerCase()) return tok;
      if (properNames.has(tok)) return tok;
      if (isSentenceInitial(tokens, i)) return tok;
      usage.set(`lowercase:${tok}`, (usage.get(`lowercase:${tok}`) ?? 0) + 1);
      return first.toLowerCase() + tok.slice(1);
    })
    .join("");
}

/**
 * Apply the explicit regex patterns, then whole-word replacements with the
 * source word's case preserved. Word choice, syntax and rhythm are never
 * touched: anything not listed is copied verbatim.
 */
export function applyRules(text: string, rules: Rules, usage: Map<string, number>): string {
  let out = text;
  for (const p of rules.patterns ?? []) {
    const re = new RegExp(p.from, p.flags ?? "g");
    out = out.replace(re, () => {
      usage.set(`pattern:${p.from}`, (usage.get(`pattern:${p.from}`) ?? 0) + 1);
      return p.to;
    });
  }
  const dict = rules.replacements ?? {};
  out = tokenize(out)
    .map((tok) => {
      if (!isWordToken(tok)) return tok;
      const key = tok.toLowerCase();
      const rep = dict[key];
      if (rep === undefined) return tok;
      usage.set(key, (usage.get(key) ?? 0) + 1);
      return matchCase(tok, rep);
    })
    .join("");
  return out;
}
