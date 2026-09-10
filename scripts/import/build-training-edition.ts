/**
 * Build content/<pack>/training-edition.v1.json from original.json and a
 * rules.json that documents every orthographic normalisation. Word choice,
 * syntax and rhythm are never touched: the builder only substitutes whole
 * words listed in `replacements` (case preserved) and applies the explicit
 * regex `patterns`. Everything else is copied verbatim.
 *
 *   pnpm tsx scripts/import/build-training-edition.ts --pack ibsen-brand
 *   pnpm tsx scripts/import/build-training-edition.ts --pack ibsen-brand --version 2
 *   pnpm tsx scripts/import/build-training-edition.ts --pack p --version 1 --original 1
 *   pnpm tsx scripts/import/build-training-edition.ts --pack p --version 1 --original 2 --rebase-original
 *
 * **A published edition's original is locked.** Rebuilding a
 * `training-edition.vN.json` that already exists, from an original other than
 * the one it names, is refused: that is not a rebuild, it is a different text
 * under a name stored sessions already point at. `--original <N>` reproduces
 * the committed edition; `--original <N> --rebase-original` is the one way to
 * mean it. See the guard in main() for why nothing downstream catches it.
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
import { loadRules } from "../lib/load-rules";
import { latestOriginal, originalFileName, readOriginal } from "../lib/originals";

function arg(name: string): string {
  const i = process.argv.indexOf(`--${name}`);
  if (i === -1 || !process.argv[i + 1]) throw new Error(`Missing --${name}`);
  return process.argv[i + 1];
}

function optionalArg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? undefined : process.argv[i + 1];
}

function flag(name: string): boolean {
  return process.argv.includes(`--${name}`);
}

type CommittedEdition = {
  basedOnEditionId?: string;
  contentHash?: string;
  segments?: { id: string; text: string }[];
};

/** The training edition already on disk, or null when this is a new cut. */
async function readCommitted(file: string): Promise<CommittedEdition | null> {
  try {
    return JSON.parse(await readFile(file, "utf8")) as CommittedEdition;
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw e;
  }
}

/** How many segments would come out with different text. */
function changedSegmentCount(
  committed: CommittedEdition,
  built: { segments: { id: string; text: string }[] },
): number {
  const before = new Map((committed.segments ?? []).map((seg) => [seg.id, seg.text]));
  let changed = 0;
  for (const seg of built.segments) {
    if (before.get(seg.id) !== seg.text) changed += 1;
  }
  // A segment that disappears is a change too, and the loop above cannot see it.
  const after = new Set(built.segments.map((seg) => seg.id));
  for (const id of before.keys()) if (!after.has(id)) changed += 1;
  return changed;
}

function short(hash: string | undefined): string {
  return hash ? `${hash.slice(0, 20)}…` : "(ingen)";
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

  // Which original this edition is cut from is a decision, not a default that
  // may drift: `basedOnEditionId` is written from it, and `validate:content`
  // rebuilds this file from exactly that original. Omit --original and you get
  // the newest one, which is what a NEW cut wants; for an edition that already
  // exists the default is checked against the committed file below and refused
  // when it disagrees, so the convenience cannot reach a published text.
  const originalVersion = Number(
    optionalArg("original") ?? (await latestOriginal(dir)).version,
  );
  if (!Number.isInteger(originalVersion) || originalVersion < 1) {
    throw new Error(`bad --original: ${originalVersion}`);
  }
  const rebase = flag("rebase-original");
  if (rebase && optionalArg("original") === undefined) {
    throw new Error(
      "--rebase-original må stå sammen med --original <N>. Flagget sier at du mener å " +
        "bytte original; da må du også si hvilken.",
    );
  }

  const original = await readOriginal<OriginalFile>(dir, originalVersion);
  const rules = await loadRules(dir, version);

  const { edition, unusedReplacements, appliedRuleCount } = buildTrainingEdition(original, rules);
  const out = path.join(dir, `training-edition.v${version}.json`);

  // The original a PUBLISHED edition rests on is locked.
  //
  // `basedOnEditionId` is the one claim about this file that nothing else can
  // check. `validate:content` rebuilds the edition from whichever original the
  // file names, so a file rebased onto a newer original validates perfectly
  // clean — it really is reproducible, from the text it now claims. What
  // changed is which text that is, and a stored session names the old one.
  //
  // This bit on 2026-09-09: `--version 1` without `--original` rebuilt
  // kielland-noveletter's v1 from `original.v2`, moved its contentHash, and
  // nothing in the repo objected. `--original` already existed and the comment
  // below already warned about the drift; a warning in a comment is not a gate.
  const committed = await readCommitted(out);
  const built = edition as unknown as {
    basedOnEditionId: string;
    contentHash: string;
    segments: { id: string; text: string }[];
  };
  if (committed?.basedOnEditionId && committed.basedOnEditionId !== built.basedOnEditionId) {
    if (!rebase) {
      const changed = changedSegmentCount(committed, built);
      // The count alone understates a rebase onto a grown original: «264 of
      // 264» hides that the edition had 21 segments a moment ago.
      const was = committed.segments?.length ?? 0;
      const resized =
        was && was !== built.segments.length
          ? ` (utgaven ville gått fra ${was} til ${built.segments.length} segmenter)`
          : "";
      throw new Error(
        `${path.relative(process.cwd(), out)} finnes allerede og hviler på ` +
          `«${committed.basedOnEditionId}». Denne kjøringen ville skrevet den fra ` +
          `«${built.basedOnEditionId}» i stedet: ${changed} av ${built.segments.length} ` +
          `segmenter ville fått annen tekst${resized}, og contentHash ville flyttet seg fra ` +
          `${short(committed.contentHash)} til ${short(built.contentHash)}.\n\n` +
          `En publisert utgave er teksten lagrede økter navngir. Å bytte original under ` +
          `den er å endre tekst noen allerede har skrevet mot — og ingenting nedstrøms ` +
          `oppdager det, fordi validate:content bygger fra den originalen filen nå navngir.\n\n` +
          `  --original ${/\.v(\d+)$/.exec(committed.basedOnEditionId)?.[1] ?? "1"}` +
          `                      reproduserer den committede utgaven\n` +
          `  --original ${originalVersion} --rebase-original   hvis ombasering faktisk er meningen`,
      );
    }
    process.stdout.write(
      `rebaser ${path.relative(process.cwd(), out)}: ` +
        `${committed.basedOnEditionId} → ${built.basedOnEditionId}\n`,
    );
  }

  await writeFile(out, serializeEdition(edition), "utf8");
  process.stdout.write(
    `wrote ${path.relative(process.cwd(), out)} (${appliedRuleCount} rules applied, ` +
      `from ${originalFileName(originalVersion)})\n`,
  );
  if (unusedReplacements.length) {
    process.stdout.write(`unused replacements: ${unusedReplacements.join(", ")}\n`);
  }
}

main().catch((err) => {
  // The message, not the stack: these are decisions the reader has to make,
  // and a stack trace above them buries the two commands that resolve it.
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
