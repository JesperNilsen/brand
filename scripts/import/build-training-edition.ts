/**
 * Build content/<pack>/training-edition.v1.json from original.json and a
 * rules.json that documents every orthographic normalisation. Word choice,
 * syntax and rhythm are never touched: the builder only substitutes whole
 * words listed in `replacements` (case preserved) and applies the explicit
 * regex `patterns`. Everything else is copied verbatim.
 *
 *   pnpm tsx scripts/import/build-training-edition.ts --pack ibsen-brand
 *
 * rules.json shape:
 * {
 *   "editionId": "ibsen-brand.training.v1",
 *   "version": "1.0.0",
 *   "languageProfileId": "brand-riksmaal",
 *   "notes": ["free-text editorial notes"],
 *   "patterns": [{ "from": "aa", "to": "å", "flags": "g", "note": "..." }],
 *   "replacements": { "af": "av", "hvad": "hva" },
 *   "lowercaseNouns": { "properNames": ["Isak", "Gud", "Kristiania"] },
 *   "retained": { "sprød": "rim med død" }
 * }
 *
 * `lowercaseNouns` (optional): 18th/19th-century Dano-Norwegian orthography
 * capitalises common nouns (German-style). This is purely an orthographic
 * convention, not a word choice, so it is a legal "tillatt inngrep" under
 * docs/spec/LANGUAGE_PROFILE.md. The rule lowercases the first letter of any
 * word that starts with a capital letter, UNLESS: (a) the word is listed in
 * `properNames` (proper names, deity references, place names — never
 * lowercased), or (b) the word is sentence-initial, defined narrowly as: the
 * first word of the segment, or a word immediately preceded (skipping only
 * whitespace/quote characters) by one of `. ! ? … —` or by an opening quote
 * mark (the run of characters between it and the previous word contains one
 * of those). Kept deliberately simple: it does not parse abbreviations or
 * disambiguate a mid-sentence parenthetical dash from a true sentence break
 * — see the code comment below.
 */
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { countWords, isWordToken, matchCase, tokenize } from "../lib/text";

type Rules = {
  editionId: string;
  version: string;
  languageProfileId: string;
  notes?: string[];
  patterns?: { from: string; to: string; flags?: string; note?: string }[];
  replacements?: Record<string, string>;
  lowercaseNouns?: { properNames: string[] };
  retained?: Record<string, string>;
};

// Characters that end a sentence, or a dialogue dash that starts one.
const SENTENCE_BOUNDARY = /[.!?…—]/;
// Opening quote marks used in the source texts (Danish-style „…“, guillemets, straight quotes).
const OPENING_QUOTE = /[„«"'‘“]/;

/** True if the word token at `tokens[i]` starts a sentence (see header comment). */
function isSentenceInitial(tokens: string[], i: number): boolean {
  if (i === 0) return true;
  const between = tokens[i - 1];
  return SENTENCE_BOUNDARY.test(between) || OPENING_QUOTE.test(between);
}

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
      if (!first || first === first.toLowerCase()) return tok; // doesn't start with an uppercase letter
      if (properNames.has(tok)) return tok;
      if (isSentenceInitial(tokens, i)) return tok;
      usage.set(`lowercase:${tok}`, (usage.get(`lowercase:${tok}`) ?? 0) + 1);
      return first.toLowerCase() + tok.slice(1);
    })
    .join("");
}

function arg(name: string): string {
  const i = process.argv.indexOf(`--${name}`);
  if (i === -1 || !process.argv[i + 1]) throw new Error(`Missing --${name}`);
  return process.argv[i + 1];
}

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

async function main() {
  const pack = arg("pack");
  const dir = path.resolve(process.cwd(), "content", pack);
  const original = JSON.parse(await readFile(path.join(dir, "original.json"), "utf8"));
  const rules = JSON.parse(await readFile(path.join(dir, "rules.json"), "utf8")) as Rules;
  const usage = new Map<string, number>();

  const properNames = new Set(rules.lowercaseNouns?.properNames ?? []);
  const segments = original.edition.segments.map(
    (s: { id: string; order: number; text: string; label?: string; difficulty?: number }) => {
      let text = applyRules(s.text, rules, usage);
      if (rules.lowercaseNouns) text = applyLowercaseNouns(text, properNames, usage);
      return { ...s, text, wordCount: countWords(text) };
    },
  );

  const applied = [...usage.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  const dict = rules.replacements ?? {};
  const editorialNotes = [
    ...(rules.notes ?? []),
    ...(rules.patterns ?? []).map(
      (p) => `Mønster: /${p.from}/ → «${p.to}» (${usage.get(`pattern:${p.from}`) ?? 0} forekomster)${p.note ? ` — ${p.note}` : ""}`,
    ),
    ...applied
      .filter(([k]) => !k.startsWith("pattern:") && !k.startsWith("lowercase:"))
      .map(([k, n]) => `Ortografi: «${k}» → «${dict[k]}» (${n})`),
    ...applied
      .filter(([k]) => k.startsWith("lowercase:"))
      .map(([k, n]) => {
        const word = k.slice("lowercase:".length);
        return `Substantiv (stor → liten forbokstav): «${word}» → «${word[0].toLowerCase()}${word.slice(1)}» (${n})`;
      }),
    ...Object.entries(rules.retained ?? {}).map(([k, why]) => `Beholdt: «${k}» — ${why}`),
  ];
  const unused = Object.keys(dict).filter((k) => !usage.has(k));

  const edition = {
    id: rules.editionId,
    workId: original.edition.workId,
    kind: "training-edition",
    version: rules.version,
    languageProfileId: rules.languageProfileId,
    basedOnEditionId: original.edition.id,
    segments,
    editorialNotes,
  };
  const out = path.join(dir, "training-edition.v1.json");
  await writeFile(out, JSON.stringify(edition, null, 2) + "\n", "utf8");
  process.stdout.write(`wrote ${path.relative(process.cwd(), out)} (${applied.length} rules applied)\n`);
  if (unused.length) process.stdout.write(`unused replacements: ${unused.join(", ")}\n`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
