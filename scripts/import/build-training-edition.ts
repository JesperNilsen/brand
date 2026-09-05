/**
 * Build content/<pack>/training-edition.v1.json from original.json and a
 * rules.json that documents every orthographic normalisation. Word choice,
 * syntax and rhythm are never touched: the builder only substitutes whole
 * words listed in `replacements` (case preserved) and applies the explicit
 * regex `patterns`. Everything else is copied verbatim.
 *
 *   pnpm tsx scripts/import/build-training-edition.ts --pack ibsen-brand
 *   pnpm tsx scripts/import/build-training-edition.ts --pack ibsen-brand --version 2
 *
 * A version N reads rules.vN.json and writes training-edition.vN.json. Both
 * are immutable once published: a correction to a published edition is a new
 * version, never an edit in place, because a stored session names the edition
 * it was typed against and that text has to still exist. Omitting --version
 * takes the highest rules.vN.json present.
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
import { readdir } from "node:fs/promises";
import { buildTrainingEdition, serializeEdition, type OriginalFile } from "../lib/build-edition";
import { type Rules } from "../lib/rules";

function arg(name: string): string {
  const i = process.argv.indexOf(`--${name}`);
  if (i === -1 || !process.argv[i + 1]) throw new Error(`Missing --${name}`);
  return process.argv[i + 1];
}

function optionalArg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? undefined : process.argv[i + 1];
}

/** The highest N for which content/<pack>/rules.vN.json exists. */
async function latestRulesVersion(dir: string): Promise<number> {
  const versions = (await readdir(dir))
    .map((f) => /^rules\.v(\d+)\.json$/.exec(f)?.[1])
    .filter((v): v is string => v !== undefined)
    .map(Number);
  if (versions.length === 0) throw new Error(`no rules.vN.json in ${dir}`);
  return Math.max(...versions);
}

async function main() {
  const pack = arg("pack");
  const dir = path.resolve(process.cwd(), "content", pack);
  const version = Number(optionalArg("version") ?? (await latestRulesVersion(dir)));
  if (!Number.isInteger(version) || version < 1) throw new Error(`bad --version: ${version}`);

  const original = JSON.parse(
    await readFile(path.join(dir, "original.json"), "utf8"),
  ) as OriginalFile;
  const rules = JSON.parse(
    await readFile(path.join(dir, `rules.v${version}.json`), "utf8"),
  ) as Rules;

  const { edition, unusedReplacements, appliedRuleCount } = buildTrainingEdition(original, rules);
  const out = path.join(dir, `training-edition.v${version}.json`);
  await writeFile(out, serializeEdition(edition), "utf8");
  process.stdout.write(
    `wrote ${path.relative(process.cwd(), out)} (${appliedRuleCount} rules applied)\n`,
  );
  if (unusedReplacements.length) {
    process.stdout.write(`unused replacements: ${unusedReplacements.join(", ")}\n`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
