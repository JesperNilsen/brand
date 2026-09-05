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
  notes?: string[];
  patterns?: { from: string; to: string; flags?: string; note?: string }[];
  replacements?: Record<string, string>;
  lowercaseNouns?: { properNames: string[] };
  retained?: Record<string, string>;
};

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
