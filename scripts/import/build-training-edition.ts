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
 * disambiguate a mid-sentence parenthetical dash from a true sentence break.
 * The transforms themselves live in scripts/lib/rules.ts, where they are unit
 * tested; this module is the CLI around them.
 */
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { countWords } from "../lib/text";
import { applyLowercaseNouns, applyRules, type Rules } from "../lib/rules";

function arg(name: string): string {
  const i = process.argv.indexOf(`--${name}`);
  if (i === -1 || !process.argv[i + 1]) throw new Error(`Missing --${name}`);
  return process.argv[i + 1];
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
