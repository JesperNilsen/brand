/**
 * `pnpm tsx scripts/check-t22-diff.ts` — prove that T-22 changed nothing in a
 * training edition but the first letter of a word right after a colon.
 *
 * T-22 makes a colon a sentence boundary for `lowercaseNouns`, and every pack
 * that lowercases nouns gets a new edition for it. `validate:content` proves
 * each new edition is reproducible from its rules; it cannot say whether the
 * rules file or the matcher changed more than the colon. This does, by
 * comparing each new edition with the one before it:
 *
 *  - every field but id, version, contentHash, editorialNotes and the segment
 *    texts is identical, and so is every segment field but `text`;
 *  - the texts have the same tokens, and a token that differs is a word whose
 *    first letter went from small to capital and which follows a colon, with
 *    nothing but space and quote marks in between;
 *  - the rules files differ only in editionId, version, notes and
 *    `colonEndsSentence`;
 *  - the generated editorial notes are the old ones, except that each
 *    «Substantiv (stor → liten forbokstav)» count falls by exactly the number
 *    of words that kept their capital;
 *  - the old versions on disk are still what the branch base (`--base`,
 *    default origin/main) published, no pack outside PACKS gained an edition,
 *    the new id, version and contentHash are the ones expected, and the rules
 *    notes only gain a T-22 note in front and lose notes about the colon.
 *
 * Anything else fails, with the token and its context. `--pack <p> --new
 * <file>` checks one pack against a different new edition, which is how the
 * gate is shown to fail on a seeded bad diff.
 *
 * A list after a colon («følgende: Brød, Smør») keeps its capital too, where
 * orthography wants it small. The matcher cannot tell a list from speech, so
 * those are judged by reading and recorded in LISTS; the gate fails if an
 * entry there no longer names a change it found.
 */
import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { isDeepStrictEqual } from "node:util";
import { isWordToken, tokenize } from "../src/domain/language/rules";
import { editionContentHash } from "./lib/hash";
import { loadRules } from "./lib/load-rules";

type Segment = { id: string; text: string } & Record<string, unknown>;
type Edition = { segments: Segment[]; editorialNotes: string[] } & Record<string, unknown>;
type RulesFile = { notes?: string[] } & Record<string, unknown>;

/** Pack, the edition before T-22, and the edition T-22 cut. */
const PACKS: [string, number, number][] = [
  ["kielland-noveletter", 5, 6],
  ["hamsun-markens-groede", 3, 4],
  ["kielland-gift", 4, 5],
  ["hamsun-sult", 1, 2],
  ["kierkegaard-enten-eller", 1, 2],
];

/**
 * Changes judged to be a list or the writer's own noun phrase after a colon,
 * where orthography wants a small letter: `<segment>@<offset> <word>`, offset
 * into the segment text. Everything else T-22 changed is a whole clause or
 * reproduced words — speech, thought, a song, a sign, a word cited as a word —
 * where the capital is right. Judged 2026-10-20 by reading all 100.
 */
const LISTS: Record<string, string[]> = {
  "kielland-noveletter": ["erotik-28@360 Fattigdom", "waterloo-15@214 Varme"],
  "kielland-gift": [
    "kap2-30@301 Europæer",
    "kap4-30@234 Børnebehandling",
    "kap9-13@555 Konfirmationen",
    "kap10-10@344 Troens",
    "kap10-11@365 Fader",
    "kap10-12@284 Fader",
    "kap11-30@89 Beslutningen",
    "kap12-19@484 Talemåder",
  ],
  "hamsun-sult": ["stykke3-04@130 Buster"],
};

/** Fields an edition is expected to change between versions. */
const EDITION_FIELDS_THAT_MOVE = new Set(["id", "version", "contentHash", "editorialNotes", "segments"]);
/** A colon, then only space and quote marks, up to the word. */
const AFTER_COLON = /:[\s„«»"'‘’“”]*$/u;
const LOWERCASE_NOTE = /^Substantiv \(stor → liten forbokstav\): «(.+)» → «.+» \((\d+)\)$/;

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? undefined : process.argv[i + 1];
}

/** Files under `paths` that differ from `base` on disk, committed or not. */
function changedSince(base: string, paths: string[]): string[] {
  return execFileSync("git", ["diff", "--name-only", base, "--", ...paths], { encoding: "utf8" })
    .split("\n")
    .filter(Boolean);
}

async function json<T>(file: string): Promise<T> {
  return JSON.parse(await readFile(file, "utf8")) as T;
}

function context(text: string, at: number, length: number): string {
  const from = Math.max(0, at - 40);
  const to = Math.min(text.length, at + length + 40);
  const show = (s: string) => s.replace(/\n/g, "⏎");
  return `…${show(text.slice(from, at))}[${show(text.slice(at, at + length))}]${show(text.slice(at + length, to))}…`;
}

type Change = { key: string; segment: string; word: string; context: string };

type PackResult = {
  changes: Change[];
  /** Capitals after a colon in the new edition that were capital already. */
  alreadyCapital: number;
  problems: string[];
  notesAdded: string[];
  notesRemoved: string[];
};

function compareTexts(segId: string, before: string, after: string, result: PackResult): void {
  const a = tokenize(before);
  const b = tokenize(after);
  if (a.length !== b.length) {
    result.problems.push(`${segId}: ${a.length} tokens før, ${b.length} etter`);
    return;
  }
  let at = 0;
  for (let i = 0; i < b.length; i += 1) {
    const old = a[i];
    const now = b[i];
    const start = at;
    at += now.length;
    if (old === now) continue;
    const afterColon = i > 0 && AFTER_COLON.test(b[i - 1]);
    const where = `${segId}@${start}`;
    const caseOnly =
      isWordToken(now) &&
      old.length === now.length &&
      old.slice(1) === now.slice(1) &&
      /^\p{Lu}/u.test(now) &&
      old[0] === now[0].toLowerCase();
    if (!caseOnly) {
      result.problems.push(`${where}: «${old}» → «${now}» er ikke en stor forbokstav: ${context(after, start, now.length)}`);
    } else if (!afterColon) {
      result.problems.push(`${where}: «${old}» → «${now}» står ikke rett etter kolon: ${context(after, start, now.length)}`);
    } else {
      result.changes.push({
        key: `${where} ${now}`,
        segment: segId,
        word: now,
        context: context(after, start, now.length),
      });
    }
  }
}

/** Words in `text` that start with a capital right after a colon. */
function capitalsAfterColon(text: string): number {
  const tokens = tokenize(text);
  let n = 0;
  tokens.forEach((tok, i) => {
    if (i > 0 && isWordToken(tok) && /^\p{Lu}/u.test(tok) && AFTER_COLON.test(tokens[i - 1])) n += 1;
  });
  return n;
}

/** The generated notes the old edition implies for the new one, given the changes. */
function expectedGeneratedNotes(old: string[], changes: Change[]): string[] {
  const kept = new Map<string, number>();
  for (const c of changes) kept.set(c.word, (kept.get(c.word) ?? 0) + 1);
  const out: string[] = [];
  for (const line of old) {
    const m = LOWERCASE_NOTE.exec(line);
    if (!m) {
      out.push(line);
      continue;
    }
    const [, word, n] = m;
    const left = Number(n) - (kept.get(word) ?? 0);
    kept.delete(word);
    if (left > 0) out.push(line.replace(/\(\d+\)$/, `(${left})`));
    else if (left < 0) out.push(`${line} [${-left} for mange beholdt]`);
  }
  // A word that kept its capital but was never counted as lowercased.
  for (const [word, n] of kept) out.push(`[«${word}» beholdt ${n} ganger uten å ha vært gjort liten]`);
  return out;
}

async function checkPack(pack: string, from: number, to: number, base: string, newFile?: string): Promise<PackResult> {
  const dir = path.join(process.cwd(), "content", pack);
  const before = await json<Edition>(path.join(dir, `training-edition.v${from}.json`));
  const after = await json<Edition>(newFile ?? path.join(dir, `training-edition.v${to}.json`));
  const rulesBefore = await json<RulesFile>(path.join(dir, `rules.v${from}.json`));
  const rulesAfter = await json<RulesFile>(path.join(dir, `rules.v${to}.json`));
  const result: PackResult = { changes: [], alreadyCapital: 0, problems: [], notesAdded: [], notesRemoved: [] };

  // The old versions are read from disk, so disk must still hold what the base
  // published: in the pack, only the two new files may differ from it.
  const allowed = new Set([`training-edition.v${to}.json`, `rules.v${to}.json`].map((f) => `content/${pack}/${f}`));
  for (const f of changedSince(base, [`content/${pack}`])) {
    if (!allowed.has(f)) result.problems.push(`${f} er endret siden ${base.slice(0, 7)}`);
  }
  const id = `${pack}.training.v${to}`;
  const version = `${to}.0.0`;
  if (after.id !== id) result.problems.push(`id er «${String(after.id)}», ventet «${id}»`);
  if (after.version !== version) result.problems.push(`version er «${String(after.version)}», ventet «${version}»`);
  if (rulesAfter.editionId !== id) result.problems.push(`rules.v${to}.json: editionId er ikke «${id}»`);
  if (rulesAfter.version !== version) result.problems.push(`rules.v${to}.json: version er ikke «${version}»`);
  const segs = after.segments as unknown as { id: string; order: number; text: string }[];
  if (after.contentHash !== editionContentHash(segs)) result.problems.push("contentHash stemmer ikke med segmentene");

  const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
  for (const k of keys) {
    if (EDITION_FIELDS_THAT_MOVE.has(k)) continue;
    if (!isDeepStrictEqual(before[k], after[k])) result.problems.push(`utgavefeltet «${k}» er endret`);
  }

  if (before.segments.length !== after.segments.length) {
    result.problems.push(`${before.segments.length} segmenter før, ${after.segments.length} etter`);
  } else {
    before.segments.forEach((seg, n) => {
      const next = after.segments[n];
      const { text: oldText, ...oldRest } = seg;
      const { text: newText, ...newRest } = next;
      if (!isDeepStrictEqual(oldRest, newRest)) result.problems.push(`${seg.id}: segmentfelt utenom text er endret`);
      if (oldText !== newText) compareTexts(seg.id, oldText, newText, result);
    });
  }
  result.alreadyCapital =
    after.segments.reduce((n, seg) => n + capitalsAfterColon(seg.text), 0) - result.changes.length;

  // The rules: only identity, notes and the T-22 flag may move.
  const strip = (r: RulesFile) => {
    const { editionId: _id, version: _v, notes: _n, ...rest } = r;
    const ln = rest.lowercaseNouns as Record<string, unknown> | undefined;
    if (ln) {
      const { colonEndsSentence: _c, ...lnRest } = ln;
      return { ...rest, lowercaseNouns: lnRest };
    }
    return rest;
  };
  if (!isDeepStrictEqual(strip(rulesBefore), strip(rulesAfter))) {
    result.problems.push(`rules.v${to}.json endrer mer enn editionId, version, notes og colonEndsSentence`);
  }
  if ((rulesAfter.lowercaseNouns as { colonEndsSentence?: boolean } | undefined)?.colonEndsSentence !== true) {
    result.problems.push(`rules.v${to}.json mangler "colonEndsSentence": true`);
  }

  // Editorial notes: the rules notes come first, verbatim, as the builder sees
  // them (`loadRules` puts the base set's line in front); the rest is generated.
  const ownBefore = (await loadRules(dir, from)).notes ?? [];
  const ownAfter = (await loadRules(dir, to)).notes ?? [];
  if (!isDeepStrictEqual(before.editorialNotes.slice(0, ownBefore.length), ownBefore)) {
    result.problems.push(`v${from}: editorialNotes begynner ikke med notene i rules.v${from}.json`);
  }
  if (!isDeepStrictEqual(after.editorialNotes.slice(0, ownAfter.length), ownAfter)) {
    result.problems.push(`v${to}: editorialNotes begynner ikke med notene i rules.v${to}.json`);
  }
  // The rules notes: one new T-22 note in front, then the old ones in order,
  // minus notes about the colon limit. A sentence kept from one may stay.
  const notesBefore = rulesBefore.notes ?? [];
  const [lead = "", ...notesRest] = rulesAfter.notes ?? [];
  if (notesBefore.includes(lead) || !lead.includes("T-22")) {
    result.problems.push(`rules.v${to}.json: første note er ikke en ny T-22-note`);
  }
  const dropped = notesBefore.filter((n) => !notesRest.includes(n));
  for (const n of dropped) {
    if (!/T-22|kolon/i.test(n)) result.problems.push(`rules.v${to}.json fjerner en note som ikke gjelder kolon: «${n.slice(0, 80)}»`);
  }
  for (const n of notesRest.filter((x) => !notesBefore.includes(x))) {
    if (!dropped.some((d) => d.includes(n))) result.problems.push(`rules.v${to}.json har en ny note utenom T-22-noten: «${n.slice(0, 80)}»`);
  }
  const common = (a: string[], b: string[]) => a.filter((n) => b.includes(n));
  if (!isDeepStrictEqual(common(notesBefore, notesRest), common(notesRest, notesBefore))) {
    result.problems.push(`rules.v${to}.json endrer rekkefølgen på notene`);
  }
  result.notesAdded = ownAfter.filter((n) => !ownBefore.includes(n));
  result.notesRemoved = ownBefore.filter((n) => !ownAfter.includes(n));
  const expected = expectedGeneratedNotes(before.editorialNotes.slice(ownBefore.length), result.changes);
  const actual = after.editorialNotes.slice(ownAfter.length);
  if (!isDeepStrictEqual(expected, actual)) {
    const i = expected.findIndex((line, n) => line !== actual[n]);
    const at = i === -1 ? Math.min(expected.length, actual.length) : i;
    result.problems.push(
      `genererte noter avviker fra det endringene tilsier, første gang ved linje ${at}: ` +
        `ventet «${expected[at] ?? "(ingen)"}», fant «${actual[at] ?? "(ingen)"}»`,
    );
  }

  for (const key of LISTS[pack] ?? []) {
    if (!result.changes.some((c) => c.key === key)) result.problems.push(`LISTS-oppføringen «${key}» er ingen endring`);
  }
  return result;
}

async function main() {
  const only = arg("pack");
  const newFile = arg("new");
  if (newFile && !only) throw new Error("--new må stå sammen med --pack <pakke>");
  const verbose = process.argv.includes("--verbose");
  const packs = only ? PACKS.filter(([p]) => p === only) : PACKS;
  if (packs.length === 0) throw new Error(`ukjent pakke: ${only}`);

  const base = execFileSync("git", ["merge-base", "HEAD", arg("base") ?? "origin/main"], { encoding: "utf8" }).trim();
  let failed = false;
  if (!only) {
    // A pack outside PACKS that gained an edition would pass unseen.
    const checked = new Set(PACKS.map(([p, , to]) => `content/${p}/training-edition.v${to}.json`));
    for (const f of changedSince(base, ["content"]).filter((x) => /training-edition\.v\d+\.json$/.test(x))) {
      if (!checked.has(f)) {
        console.log(`  FEIL ${f} er endret eller ny, men porten sjekker den ikke`);
        failed = true;
      }
    }
  }
  console.log("pakke · utgaver · endrede ord · beholdt stor (oppramsing) · stor etter kolon fra før");
  for (const [pack, from, to] of packs) {
    const r = await checkPack(pack, from, to, base, newFile);
    const lists = (LISTS[pack] ?? []).length;
    console.log(`${pack} · v${from}→v${to} · ${r.changes.length} · ${lists} · ${r.alreadyCapital}`);
    for (const n of r.notesRemoved) console.log(`  − note: ${n.slice(0, 120)}`);
    for (const n of r.notesAdded) console.log(`  + note: ${n.slice(0, 120)}`);
    const judged = new Set(LISTS[pack] ?? []);
    for (const c of r.changes) {
      if (verbose || judged.has(c.key)) console.log(`  ${judged.has(c.key) ? "oppramsing" : "endret"} ${c.key}: ${c.context}`);
    }
    for (const p of r.problems) console.log(`  FEIL ${p}`);
    if (r.problems.length) failed = true;
  }
  if (failed) {
    console.error("\nT-22-porten feiler: utgavene endrer mer enn første bokstav etter kolon.");
    process.exit(1);
  }
  console.log("\nT-22-porten er grønn: hver endring er første bokstav i et ord rett etter kolon.");
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
