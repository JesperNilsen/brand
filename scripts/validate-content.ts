/**
 * Validate every content pack under content/. Fails (exit 1) on:
 *  - malformed pack/original/training files or id mismatches
 *  - empty segments, non-NFC text, double spaces, trailing whitespace,
 *    CRLF, duplicate ids, non-sequential order, wrong wordCount
 *  - original segments whose lines are not found verbatim in the archived
 *    source text (provenance)
 *  - training editions whose segment ids, line counts or word counts
 *    (±10 %) differ from the original (guards against rewriting)
 *  - segments that any practice-form filter would empty (a vanished segment
 *    would push Nonstop progress past text the reader never typed)
 *  - an edition whose contentHash does not match its own segments
 *  - a training edition that is not byte-for-byte what its rules.vN.json
 *    produces from original.json (a hand-edited generated file)
 *  - a training edition with no matching rules.vN.json
 *  - unknown language profile ids
 *  - a generated catalog or edition asset that is not what `pnpm build:content`
 *    produces from content/ right now, or an asset file nothing points at
 *
 * Warns (exit 0) on:
 *  - training-edition passages outside the 35-120 word range that
 *    docs/spec/CORPUS.md recommends for Passage, unless the segment is a
 *    registered known deviation
 *  - a registered known deviation that is now inside the range, so the list
 *    cannot quietly rot into a permanent exemption
 *
 *   pnpm validate:content
 */
import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import { countWords } from "./lib/text";
import { editionContentHash } from "./lib/hash";
import { buildTrainingEdition, serializeEdition, type OriginalFile } from "./lib/build-edition";
import type { Rules } from "./lib/rules";
import { listTextFilters } from "../src/domain/text-filter";
import { buildContentAssets } from "./build-content-assets";

const KNOWN_PROFILES = new Set(["brand-riksmaal"]);
const contentRoot = path.resolve(process.cwd(), "content");

/** docs/spec/CORPUS.md: recommended V1 passage size for `Passage`. */
const PASSAGE_MIN_WORDS = 35;
const PASSAGE_MAX_WORDS = 120;

/**
 * Segments knowingly outside the range, keyed `<pack>/<segmentId>`.
 *
 * A warning rather than a failure, because the texts are already in use and
 * resegmenting them is Phase 7 work with editorial consequences. Phase 7 then
 * raises this to a hard gate and empties this map. Each entry has to say why,
 * so that an exemption is a decision someone wrote down rather than a line
 * nobody dares delete.
 */
const KNOWN_LENGTH_DEVIATIONS = new Map<string, string>([
  ["hamsun-markens-groede/del1-kap1-02", "166 ord; resegmenteres i fase 7"],
  ["hamsun-markens-groede/del1-kap1-05", "176 ord; resegmenteres i fase 7"],
  ["hamsun-markens-groede/del1-kap1-06", "129 ord; resegmenteres i fase 7"],
]);
const seenDeviations = new Set<string>();

type Segment = {
  id: string;
  order: number;
  text: string;
  label?: string;
  wordCount: number;
  difficulty?: number;
};

const problems: string[] = [];
function fail(pack: string, msg: string) {
  problems.push(`[${pack}] ${msg}`);
}

const warnings: string[] = [];
function warn(pack: string, msg: string) {
  warnings.push(`[${pack}] ${msg}`);
}

/** Passage length is advisory in this phase: warn, never fail. */
function checkPassageLength(pack: string, editionId: string, segments: Segment[]) {
  for (const s of segments) {
    const key = `${pack}/${s.id}`;
    const outside = s.wordCount < PASSAGE_MIN_WORDS || s.wordCount > PASSAGE_MAX_WORDS;
    const known = KNOWN_LENGTH_DEVIATIONS.get(key);
    if (known) seenDeviations.add(key);
    if (outside && !known) {
      warn(
        pack,
        `${editionId}/${s.id}: ${s.wordCount} ord, utenfor ${PASSAGE_MIN_WORDS}-${PASSAGE_MAX_WORDS} (CORPUS.md)`,
      );
    }
    if (!outside && known) {
      warn(pack, `${editionId}/${s.id}: ${s.wordCount} ord er innenfor rekkevidden nå — fjern unntaket «${known}»`);
    }
  }
}

async function readJson(file: string): Promise<unknown> {
  return JSON.parse(await readFile(file, "utf8"));
}

function checkSegments(pack: string, editionId: string, segments: Segment[]) {
  const ids = new Set<string>();
  segments.forEach((s, i) => {
    const where = `${editionId}/${s.id}`;
    if (!s.id) fail(pack, `${editionId}: segment ${i} has no id`);
    if (ids.has(s.id)) fail(pack, `${where}: duplicate id`);
    ids.add(s.id);
    if (s.order !== i + 1) fail(pack, `${where}: order ${s.order}, expected ${i + 1}`);
    if (!s.text || s.text.trim().length === 0) fail(pack, `${where}: empty text`);
    if (s.text !== s.text.normalize("NFC")) fail(pack, `${where}: not NFC`);
    if (/\r/.test(s.text)) fail(pack, `${where}: CRLF`);
    if (/ {2,}/.test(s.text)) fail(pack, `${where}: double space`);
    if (/[ \t]+$/m.test(s.text)) fail(pack, `${where}: trailing whitespace`);
    if (/^\s|\s$/.test(s.text)) fail(pack, `${where}: leading/trailing whitespace`);
    if (/\n{3,}/.test(s.text)) fail(pack, `${where}: more than one blank line`);
    if (s.wordCount !== countWords(s.text)) {
      fail(pack, `${where}: wordCount ${s.wordCount}, computed ${countWords(s.text)}`);
    }
    if (s.difficulty !== undefined && ![1, 2, 3, 4, 5].includes(s.difficulty)) {
      fail(pack, `${where}: difficulty out of range`);
    }
    // Every practice form must leave something to type. A segment emptied by a
    // filter cannot be dropped from a session plan without corrupting saved
    // reading progress, so it is a content error rather than a runtime case.
    for (const filter of listTextFilters()) {
      if (countWords(filter.apply(s.text)) === 0) {
        fail(pack, `${where}: empty under the «${filter.displayName}» filter`);
      }
    }
  });
}

/** The hash has to be checked, or it is decoration that drifts silently. */
function checkContentHash(
  pack: string,
  where: string,
  edition: { contentHash?: string; segments: Segment[] },
) {
  if (!edition.contentHash) {
    fail(pack, `${where}: contentHash missing`);
    return;
  }
  const computed = editionContentHash(edition.segments);
  if (edition.contentHash !== computed) {
    fail(pack, `${where}: contentHash ${edition.contentHash.slice(0, 20)}… != computed ${computed.slice(0, 20)}…`);
  }
}

/** First index at which two strings differ, with a little context each side. */
function firstDifference(a: string, b: string): string {
  const n = Math.min(a.length, b.length);
  let i = 0;
  while (i < n && a[i] === b[i]) i += 1;
  const from = Math.max(0, i - 40);
  return [
    `first difference at byte ${i}`,
    `  committed: …${JSON.stringify(a.slice(from, i + 40))}`,
    `  rebuilt  : …${JSON.stringify(b.slice(from, i + 40))}`,
  ].join("\n");
}

async function validatePack(pack: string) {
  const dir = path.join(contentRoot, pack);
  const packJson = (await readJson(path.join(dir, "pack.json"))) as Record<string, unknown>;
  if (packJson.id !== pack) fail(pack, `pack.json id ${String(packJson.id)} != folder`);
  if (!["draft", "active", "archived"].includes(String(packJson.status))) {
    fail(pack, `pack.json status invalid`);
  }
  for (const p of (packJson.languageProfileIds as string[]) ?? []) {
    if (!KNOWN_PROFILES.has(p)) fail(pack, `unknown language profile ${p}`);
  }

  const original = (await readJson(path.join(dir, "original.json"))) as {
    work: Record<string, unknown>;
    edition: { id: string; workId: string; kind: string; segments: Segment[] };
  };
  const workId = String(original.work.id);
  if (!(packJson.workIds as string[]).includes(workId)) {
    fail(pack, `work ${workId} not listed in pack.workIds`);
  }
  if (original.work.contentPackId !== pack) fail(pack, `work.contentPackId != ${pack}`);
  if (original.edition.kind !== "original") fail(pack, `original.json edition.kind must be original`);
  if (original.edition.workId !== workId) fail(pack, `original edition workId mismatch`);
  const source = original.work.source as Record<string, unknown> | undefined;
  for (const key of ["author", "title", "language", "sourceUrl", "retrievedAt", "provider", "license", "digitalEdition", "verificationStatus"]) {
    if (!source || !source[key]) fail(pack, `work.source.${key} missing`);
  }
  checkSegments(pack, original.edition.id, original.edition.segments);
  checkContentHash(pack, original.edition.id, original.edition as unknown as { contentHash?: string; segments: Segment[] });

  // Provenance: every original line must exist verbatim in an archived source text.
  const sourceDir = path.join(dir, "source");
  let sourceLines = new Set<string>();
  try {
    const files = (await readdir(sourceDir)).filter((f) => f.endsWith(".txt"));
    if (files.length === 0) fail(pack, `no archived source .txt in source/`);
    for (const f of files) {
      const txt = await readFile(path.join(sourceDir, f), "utf8");
      for (const l of txt.normalize("NFC").split("\n")) {
        sourceLines.add(l.trim().replace(/[ \t]{2,}/g, " "));
      }
    }
  } catch {
    fail(pack, `source/ directory missing`);
    sourceLines = new Set();
  }
  for (const s of original.edition.segments) {
    for (const line of s.text.split("\n")) {
      if (line.length && !sourceLines.has(line)) {
        fail(pack, `${s.id}: line not found in archived source: "${line.slice(0, 60)}"`);
      }
    }
  }

  // Training edition(s)
  const files = (await readdir(dir)).filter((f) => /^training-edition\.v\d+\.json$/.test(f));
  if (files.length === 0) fail(pack, `no training edition`);
  for (const f of files) {
    const version = /^training-edition\.v(\d+)\.json$/.exec(f)![1];
    const rulesFile = path.join(dir, `rules.v${version}.json`);

    // Rebuild from the frozen inputs and demand the exact bytes back. Every
    // other check here compares an edition against itself; only this one can
    // tell that a generated file was edited by hand.
    const committed = await readFile(path.join(dir, f), "utf8");
    try {
      const rules = JSON.parse(await readFile(rulesFile, "utf8")) as Rules;
      const rebuilt = serializeEdition(
        buildTrainingEdition(original as unknown as OriginalFile, rules).edition,
      );
      if (rebuilt !== committed) {
        fail(pack, `${f}: not reproducible from rules.v${version}.json\n${firstDifference(committed, rebuilt)}`);
      }
    } catch (err) {
      fail(pack, `${f}: cannot rebuild from rules.v${version}.json: ${(err as Error).message}`);
    }

    const t = (await readJson(path.join(dir, f))) as {
      id: string;
      workId: string;
      kind: string;
      languageProfileId?: string;
      basedOnEditionId?: string;
      contentHash?: string;
      basedOnContentHash?: string;
      segments: Segment[];
      editorialNotes?: string[];
    };
    if (t.kind !== "training-edition") fail(pack, `${f}: kind must be training-edition`);
    if (t.workId !== workId) fail(pack, `${f}: workId mismatch`);
    if (t.id === original.edition.id) fail(pack, `${f}: id must differ from original`);
    if (t.basedOnEditionId !== original.edition.id) fail(pack, `${f}: basedOnEditionId must point to original`);
    if (!t.languageProfileId || !KNOWN_PROFILES.has(t.languageProfileId)) {
      fail(pack, `${f}: unknown languageProfileId`);
    }
    if (!t.editorialNotes || t.editorialNotes.length === 0) fail(pack, `${f}: editorialNotes missing`);
    checkSegments(pack, t.id, t.segments);
    checkContentHash(pack, f, t);
    const originalHash = (original.edition as unknown as { contentHash?: string }).contentHash;
    if (t.basedOnContentHash !== originalHash) {
      fail(pack, `${f}: basedOnContentHash does not match the original it derives from`);
    }
    checkPassageLength(pack, t.id, t.segments);
    if (t.segments.length !== original.edition.segments.length) {
      fail(pack, `${f}: segment count differs from original`);
    }
    t.segments.forEach((s, i) => {
      const o = original.edition.segments[i];
      if (!o) return;
      if (s.id !== o.id) fail(pack, `${f}/${s.id}: id differs from original ${o.id}`);
      const ol = o.text.split("\n").length;
      const tl = s.text.split("\n").length;
      if (ol !== tl) fail(pack, `${f}/${s.id}: line count ${tl} != original ${ol}`);
      const ratio = s.wordCount / Math.max(1, o.wordCount);
      if (ratio < 0.9 || ratio > 1.1) {
        fail(pack, `${f}/${s.id}: word count ${s.wordCount} vs original ${o.wordCount} (rewrite?)`);
      }
    });
  }
}

/**
 * The generated catalog and the files under public/ are derived, and derived
 * files rot. Regenerate them in memory and compare byte for byte — the same
 * check D8 applies to training editions, for the same reason: every other
 * check here compares a file with itself.
 */
async function checkGeneratedAssets() {
  const where = "generated";
  let built;
  try {
    built = await buildContentAssets();
  } catch (e) {
    fail(where, `pnpm build:content would fail: ${(e as Error).message}`);
    return;
  }

  const generatedRoot = path.resolve(process.cwd(), "src", "domain", "content");
  for (const [file, expected] of [
    [path.join(generatedRoot, "catalog.generated.ts"), built.catalog],
    [path.join(generatedRoot, "editorial-notes.generated.ts"), built.notes],
  ] as const) {
    let actual: string;
    try {
      actual = await readFile(file, "utf8");
    } catch {
      fail(where, `${path.basename(file)} is missing — run pnpm build:content`);
      continue;
    }
    if (actual !== expected) {
      fail(
        where,
        `${path.basename(file)} is not what content/ produces — run pnpm build:content ` +
          `(first difference: ${firstDifference(actual, expected)})`,
      );
    }
  }

  const assetDir = path.resolve(process.cwd(), "public", "content", "editions");
  let onDisk: string[] = [];
  try {
    onDisk = (await readdir(assetDir)).filter((f) => f.endsWith(".json")).sort();
  } catch {
    fail(where, `public/content/editions/ is missing — run pnpm build:content`);
    return;
  }
  for (const asset of built.assets) {
    let actual: string;
    try {
      actual = await readFile(path.join(assetDir, asset.file), "utf8");
    } catch {
      fail(where, `${asset.file} is missing — run pnpm build:content`);
      continue;
    }
    if (actual !== asset.contents) {
      fail(where, `${asset.file} has been edited by hand — it is generated`);
    }
  }
  // An orphan is a text nothing can reach but a stale cache still can.
  const expectedNames = new Set(built.assets.map((a) => a.file));
  for (const f of onDisk) {
    if (!expectedNames.has(f)) {
      fail(where, `${f} is in public/content/editions/ but no edition points at it`);
    }
  }
}

async function main() {
  const entries = await readdir(contentRoot);
  const packs: string[] = [];
  for (const e of entries) {
    const st = await stat(path.join(contentRoot, e));
    if (st.isDirectory()) packs.push(e);
  }
  if (packs.length === 0) fail("content", "no packs found");
  for (const p of packs) {
    try {
      await validatePack(p);
    } catch (err) {
      fail(p, `unreadable: ${(err as Error).message}`);
    }
  }
  await checkGeneratedAssets();

  for (const [key, why] of KNOWN_LENGTH_DEVIATIONS) {
    if (!seenDeviations.has(key)) {
      warn(key.split("/")[0], `kjent lengdeavvik ${key} finnes ikke lenger — fjern unntaket «${why}»`);
    }
  }

  if (problems.length) {
    console.error(problems.join("\n"));
    console.error(`\n${problems.length} problem(s)`);
    process.exit(1);
  }
  if (warnings.length) {
    console.warn(warnings.join("\n"));
    console.warn(`\n${warnings.length} advarsel/advarsler (ikke blokkerende)`);
  }
  console.log(`content ok: ${packs.join(", ")}`);
}

main();
