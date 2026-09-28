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
 *  - a drill bank whose item is not in its edition verbatim, whose
 *    editionContentHash has gone stale, or that repeats an id or text or
 *    falls under the per-kind length floor
 *  - a generated catalog or edition asset that is not what `pnpm build:content`
 *    produces from content/ right now, or an asset file nothing points at
 *  - a shelf in content/shelves.json that names a work the catalogue does not
 *    have, or a work that stands on no shelf at all
 *  - an edition whose modules contradict its segments: a moduleId naming no
 *    declared module, a half-modularised edition, modules that are not
 *    contiguous in reading order, or a declared module with no segments
 *  - a work missing authorDeathYear, rightsStatus or originalLanguage, a
 *    training edition missing adaptationStatus, or a rights claim of public
 *    domain over an author who died after 1955 with no written basis
 *  - a training edition where the polite «De» / «Dem» / «Deres» / «I» of a
 *    segment do not survive with their capital: lowercaseNouns has turned
 *    address into the third person, which changes meaning and not spelling
 *    (Q-016), unless the edition is a registered historical defect
 *
 * Warns (exit 0) on:
 *  - training-edition passages outside the 35-120 word range that
 *    docs/spec/CORPUS.md recommends for Passage, unless the segment is a
 *    registered known deviation
 *  - a registered known deviation that is now inside the range, so the list
 *    cannot quietly rot into a permanent exemption
 *  - a registered polite-address defect that no longer occurs, for the same
 *    reason
 *
 *   pnpm validate:content
 */
import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import { countWords } from "./lib/text";
import { editionContentHash } from "./lib/hash";
import { politeAddressProblems } from "./lib/polite-address";
import { buildTrainingEdition, serializeEdition, type OriginalFile } from "./lib/build-edition";
import { baseOverrides, type Rules } from "./lib/rules";
import { loadRules } from "./lib/load-rules";
import { listOriginals, originalEditionId, readOriginal } from "./lib/originals";
import { drillProblems } from "./lib/drills";
import { loadShelves, shelfProblems } from "./lib/shelves";
import { adaptationProblems, rightsProblems } from "./lib/rights";
import { moduleProblems } from "./lib/modules";
import { listLanguageProfiles } from "../src/domain/language/registry";
import { getBaseRuleSet } from "../src/domain/language/base-rules";
import { listTextFilters } from "../src/domain/text-filter";
import { buildContentAssets } from "./build-content-assets";

// The registry is the only list of profiles; a second one here would drift.
import { loadReviews, reviewProblems } from "./lib/review";
import { editionMajorVersion } from "../src/domain/content/registry";

const KNOWN_PROFILES = new Set(listLanguageProfiles().map((p) => p.id));
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
  // Novelletter, hele samlingen: ti segmenter der ETT avsnitt er lengre enn
  // taket alene (eller, for visne-15, der novellen slutter). Grensene er satt
  // av forfatterens egne avsnitt, og å dele et avsnitt for å treffe et tall
  // ville satt leseren midt i en setning ved øktstart. Ikke fase 7-gjeld:
  // dette er så nær rekkevidden teksten kommer.
  ["kielland-noveletter/visne-15", "33 ord; novellens siste avsnitt"],
  ["kielland-noveletter/erotik-03", "131 ord; ett avsnitt"],
  ["kielland-noveletter/erotik-27", "125 ord; ett avsnitt"],
  ["kielland-noveletter/erotik-36", "138 ord; ett avsnitt"],
  ["kielland-noveletter/erotik-44", "152 ord; ett avsnitt"],
  ["kielland-noveletter/middag-15", "145 ord; ett avsnitt"],
  ["kielland-noveletter/venner-01", "124 ord; ett avsnitt"],
  ["kielland-noveletter/venner-06", "132 ord; ett avsnitt"],
  ["kielland-noveletter/venner-30", "124 ord; ett avsnitt"],
  ["kielland-noveletter/waterloo-40", "146 ord; ett avsnitt"],
  // Sult, hele romanen: 122 avsnitt lengre enn taket (36/31/29/26 per stykke,
  // lengste 514 ord). Grensene er Hamsuns egne avsnitt. Å dele dem ved
  // setningsgrenser ble vurdert og forkastet 2026-09-25: provenanssjekken er
  // linjebasert mot den arkiverte kilden, så et del-avsnitt-segment ville
  // krevd en omflytet kildefil og svekket akkurat den kjeden pakken hviler på.
  // Samme avgjørelse som for Novelletter over, for samme grunn.
  ["hamsun-sult/stykke1-04", "194 ord; ett avsnitt"],
  ["hamsun-sult/stykke1-05", "223 ord; ett avsnitt"],
  ["hamsun-sult/stykke1-06", "152 ord; ett avsnitt"],
  ["hamsun-sult/stykke1-08", "130 ord; ett avsnitt"],
  ["hamsun-sult/stykke1-09", "150 ord; ett avsnitt"],
  ["hamsun-sult/stykke1-11", "196 ord; ett avsnitt"],
  ["hamsun-sult/stykke1-12", "243 ord; ett avsnitt"],
  ["hamsun-sult/stykke1-20", "183 ord; ett avsnitt"],
  ["hamsun-sult/stykke1-21", "283 ord; ett avsnitt"],
  ["hamsun-sult/stykke1-23", "151 ord; ett avsnitt"],
  ["hamsun-sult/stykke1-24", "176 ord; ett avsnitt"],
  ["hamsun-sult/stykke1-27", "162 ord; ett avsnitt"],
  ["hamsun-sult/stykke1-28", "126 ord; ett avsnitt"],
  ["hamsun-sult/stykke1-29", "212 ord; ett avsnitt"],
  ["hamsun-sult/stykke1-30", "145 ord; ett avsnitt"],
  ["hamsun-sult/stykke1-36", "267 ord; ett avsnitt"],
  ["hamsun-sult/stykke1-37", "126 ord; ett avsnitt"],
  ["hamsun-sult/stykke1-41", "190 ord; ett avsnitt"],
  ["hamsun-sult/stykke1-43", "135 ord; ett avsnitt"],
  ["hamsun-sult/stykke1-44", "327 ord; ett avsnitt"],
  ["hamsun-sult/stykke1-65", "183 ord; ett avsnitt"],
  ["hamsun-sult/stykke1-75", "184 ord; ett avsnitt"],
  ["hamsun-sult/stykke1-77", "134 ord; ett avsnitt"],
  ["hamsun-sult/stykke1-79", "141 ord; ett avsnitt"],
  ["hamsun-sult/stykke1-80", "160 ord; ett avsnitt"],
  ["hamsun-sult/stykke1-82", "135 ord; ett avsnitt"],
  ["hamsun-sult/stykke1-94", "140 ord; ett avsnitt"],
  ["hamsun-sult/stykke1-102", "125 ord; ett avsnitt"],
  ["hamsun-sult/stykke1-106", "159 ord; ett avsnitt"],
  ["hamsun-sult/stykke1-109", "202 ord; ett avsnitt"],
  ["hamsun-sult/stykke1-114", "140 ord; ett avsnitt"],
  ["hamsun-sult/stykke1-115", "150 ord; ett avsnitt"],
  ["hamsun-sult/stykke1-120", "342 ord; ett avsnitt"],
  ["hamsun-sult/stykke1-125", "212 ord; ett avsnitt"],
  ["hamsun-sult/stykke1-127", "150 ord; ett avsnitt"],
  ["hamsun-sult/stykke1-128", "153 ord; ett avsnitt"],
  ["hamsun-sult/stykke2-03", "125 ord; ett avsnitt"],
  ["hamsun-sult/stykke2-07", "124 ord; ett avsnitt"],
  ["hamsun-sult/stykke2-09", "167 ord; ett avsnitt"],
  ["hamsun-sult/stykke2-10", "291 ord; ett avsnitt"],
  ["hamsun-sult/stykke2-13", "219 ord; ett avsnitt"],
  ["hamsun-sult/stykke2-14", "317 ord; ett avsnitt"],
  ["hamsun-sult/stykke2-24", "140 ord; ett avsnitt"],
  ["hamsun-sult/stykke2-27", "194 ord; ett avsnitt"],
  ["hamsun-sult/stykke2-28", "122 ord; ett avsnitt"],
  ["hamsun-sult/stykke2-29", "151 ord; ett avsnitt"],
  ["hamsun-sult/stykke2-30", "291 ord; ett avsnitt"],
  ["hamsun-sult/stykke2-31", "121 ord; ett avsnitt"],
  ["hamsun-sult/stykke2-32", "326 ord; ett avsnitt"],
  ["hamsun-sult/stykke2-33", "153 ord; ett avsnitt"],
  ["hamsun-sult/stykke2-34", "124 ord; ett avsnitt"],
  ["hamsun-sult/stykke2-39", "128 ord; ett avsnitt"],
  ["hamsun-sult/stykke2-45", "152 ord; ett avsnitt"],
  ["hamsun-sult/stykke2-47", "121 ord; ett avsnitt"],
  ["hamsun-sult/stykke2-51", "136 ord; ett avsnitt"],
  ["hamsun-sult/stykke2-57", "134 ord; ett avsnitt"],
  ["hamsun-sult/stykke2-64", "158 ord; ett avsnitt"],
  ["hamsun-sult/stykke2-65", "127 ord; ett avsnitt"],
  ["hamsun-sult/stykke2-70", "130 ord; ett avsnitt"],
  ["hamsun-sult/stykke2-71", "133 ord; ett avsnitt"],
  ["hamsun-sult/stykke2-75", "206 ord; ett avsnitt"],
  ["hamsun-sult/stykke2-80", "172 ord; ett avsnitt"],
  ["hamsun-sult/stykke2-86", "130 ord; ett avsnitt"],
  ["hamsun-sult/stykke2-91", "233 ord; ett avsnitt"],
  ["hamsun-sult/stykke2-93", "133 ord; ett avsnitt"],
  ["hamsun-sult/stykke2-101", "187 ord; ett avsnitt"],
  ["hamsun-sult/stykke2-103", "123 ord; ett avsnitt"],
  ["hamsun-sult/stykke3-01", "167 ord; ett avsnitt"],
  ["hamsun-sult/stykke3-03", "128 ord; ett avsnitt"],
  ["hamsun-sult/stykke3-06", "143 ord; ett avsnitt"],
  ["hamsun-sult/stykke3-11", "248 ord; ett avsnitt"],
  ["hamsun-sult/stykke3-14", "217 ord; ett avsnitt"],
  ["hamsun-sult/stykke3-16", "287 ord; ett avsnitt"],
  ["hamsun-sult/stykke3-23", "134 ord; ett avsnitt"],
  ["hamsun-sult/stykke3-24", "141 ord; ett avsnitt"],
  ["hamsun-sult/stykke3-27", "127 ord; ett avsnitt"],
  ["hamsun-sult/stykke3-30", "183 ord; ett avsnitt"],
  ["hamsun-sult/stykke3-32", "158 ord; ett avsnitt"],
  ["hamsun-sult/stykke3-52", "144 ord; ett avsnitt"],
  ["hamsun-sult/stykke3-60", "189 ord; ett avsnitt"],
  ["hamsun-sult/stykke3-74", "140 ord; ett avsnitt"],
  ["hamsun-sult/stykke3-78", "140 ord; ett avsnitt"],
  ["hamsun-sult/stykke3-79", "185 ord; ett avsnitt"],
  ["hamsun-sult/stykke3-86", "124 ord; ett avsnitt"],
  ["hamsun-sult/stykke3-91", "201 ord; ett avsnitt"],
  ["hamsun-sult/stykke3-93", "123 ord; ett avsnitt"],
  ["hamsun-sult/stykke3-99", "155 ord; ett avsnitt"],
  ["hamsun-sult/stykke3-109", "128 ord; ett avsnitt"],
  ["hamsun-sult/stykke3-113", "139 ord; ett avsnitt"],
  ["hamsun-sult/stykke3-114", "460 ord; ett avsnitt"],
  ["hamsun-sult/stykke3-115", "242 ord; ett avsnitt"],
  ["hamsun-sult/stykke3-128", "127 ord; ett avsnitt"],
  ["hamsun-sult/stykke3-137", "194 ord; ett avsnitt"],
  ["hamsun-sult/stykke3-160", "144 ord; ett avsnitt"],
  ["hamsun-sult/stykke3-161", "203 ord; ett avsnitt"],
  ["hamsun-sult/stykke3-163", "514 ord; ett avsnitt"],
  ["hamsun-sult/stykke4-04", "252 ord; ett avsnitt"],
  ["hamsun-sult/stykke4-14", "146 ord; ett avsnitt"],
  ["hamsun-sult/stykke4-15", "133 ord; ett avsnitt"],
  ["hamsun-sult/stykke4-17", "149 ord; ett avsnitt"],
  ["hamsun-sult/stykke4-21", "218 ord; ett avsnitt"],
  ["hamsun-sult/stykke4-36", "134 ord; ett avsnitt"],
  ["hamsun-sult/stykke4-45", "164 ord; ett avsnitt"],
  ["hamsun-sult/stykke4-47", "274 ord; ett avsnitt"],
  ["hamsun-sult/stykke4-49", "126 ord; ett avsnitt"],
  ["hamsun-sult/stykke4-51", "270 ord; ett avsnitt"],
  ["hamsun-sult/stykke4-52", "308 ord; ett avsnitt"],
  ["hamsun-sult/stykke4-58", "152 ord; ett avsnitt"],
  ["hamsun-sult/stykke4-59", "146 ord; ett avsnitt"],
  ["hamsun-sult/stykke4-61", "191 ord; ett avsnitt"],
  ["hamsun-sult/stykke4-66", "128 ord; ett avsnitt"],
  ["hamsun-sult/stykke4-67", "127 ord; ett avsnitt"],
  ["hamsun-sult/stykke4-71", "156 ord; ett avsnitt"],
  ["hamsun-sult/stykke4-72", "123 ord; ett avsnitt"],
  ["hamsun-sult/stykke4-77", "145 ord; ett avsnitt"],
  ["hamsun-sult/stykke4-87", "274 ord; ett avsnitt"],
  ["hamsun-sult/stykke4-88", "222 ord; ett avsnitt"],
  ["hamsun-sult/stykke4-89", "184 ord; ett avsnitt"],
  ["hamsun-sult/stykke4-91", "133 ord; ett avsnitt"],
  ["hamsun-sult/stykke4-97", "147 ord; ett avsnitt"],
  ["hamsun-sult/stykke4-98", "139 ord; ett avsnitt"],
  ["hamsun-sult/stykke4-110", "168 ord; ett avsnitt"],
]);
const seenDeviations = new Set<string>();

/**
 * Training editions known to have lowercased the polite second person, keyed
 * by edition id. A written-down decision, not a soft gate: everything else
 * FAILS. Not "the newest edition only", because a superseded edition is still
 * the one a reader mid-session is typing against (D7), and its text does not
 * become less wrong by being old.
 */
const KNOWN_POLITE_DEFECTS = new Map<string, string>([
  [
    "kielland-noveletter.training.v3",
    "Q-016: utgaven som lekket 81 høflige former; erstattet av v4 2026-09-24, beholdt som historikk",
  ],
]);
const seenPoliteDefects = new Set<string>();

/**
 * Whether an unreviewed default edition fails the build or only warns.
 *
 * "warn" today because all four packs were drafted by an agent and none has
 * been read yet: a gate switched on now would land red on main and teach
 * everyone to ignore it. It stays a warning until the backlog is read, and
 * flipping it afterwards is one word. Incoherence in a review file — a hash
 * that does not match, a review of an edition that does not exist — fails
 * regardless: that is a contradiction, not an absence.
 */
const REVIEW_GATE: "warn" | "fail" = "warn";

type Segment = {
  id: string;
  order: number;
  text: string;
  part?: string;
  moduleId?: string;
  label?: string;
  wordCount: number;
  difficulty?: number;
};

/** Every work the packs declare, filled as they are validated. See checkShelves(). */
const catalogWorkIds: string[] = [];

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
    if (s.part !== undefined && (typeof s.part !== "string" || s.part.trim() !== s.part || !s.part)) {
      fail(pack, `${where}: part må være en ikke-tom tittel uten kantmellomrom`);
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

  // Parts must be contiguous, and either every segment has one or none does.
  //
  // The chooser groups by part while keeping the edition's own order, so a part
  // that comes back after another one would either be split into two groups
  // that share a name or force the list out of reading order. Neither is a
  // rendering decision: it is the content saying two different things about
  // where a passage sits.
  const parts = segments.map((s) => s.part);
  const named = parts.filter((p) => p !== undefined).length;
  if (named > 0 && named < parts.length) {
    fail(pack, `${editionId}: ${named} av ${parts.length} segmenter har part — enten alle eller ingen`);
  }
  const seenParts = new Set<string>();
  let previous: string | undefined;
  for (const part of parts) {
    if (part === previous) continue;
    if (part !== undefined && seenParts.has(part)) {
      fail(pack, `${editionId}: part «${part}» kommer tilbake etter en annen del — delene må være sammenhengende`);
    }
    if (part !== undefined) seenParts.add(part);
    previous = part;
  }
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
  const reviewable: { id: string; kind: string; contentHash: string }[] = [];
  const trainingEditions: { id: string; workId: string; contentHash: string; segments: Segment[] }[] = [];
  const packJson = (await readJson(path.join(dir, "pack.json"))) as Record<string, unknown>;
  if (packJson.id !== pack) fail(pack, `pack.json id ${String(packJson.id)} != folder`);
  if (!["draft", "active", "archived"].includes(String(packJson.status))) {
    fail(pack, `pack.json status invalid`);
  }
  for (const p of (packJson.languageProfileIds as string[]) ?? []) {
    if (!KNOWN_PROFILES.has(p)) fail(pack, `unknown language profile ${p}`);
  }

  type OriginalJson = {
    work: Record<string, unknown>;
    edition: {
      id: string;
      workId: string;
      kind: string;
      modules?: { id: string; title: string; order: number }[];
      segments: Segment[];
    };
  };
  // Every original the pack has, oldest first. There is more than one whenever a
  // work has grown — more of the collection, a longer excerpt — because growing
  // the text of a published edition would falsify every session already typed
  // against it. The newest is the one the work's metadata is read from.
  const originalRefs = await listOriginals(dir);
  const originals: OriginalJson[] = [];
  for (const ref of originalRefs) {
    originals.push(await readOriginal<OriginalJson>(dir, ref.version));
  }
  const original = originals.at(-1)!;
  const workId = String(original.work.id);
  if (!(packJson.workIds as string[]).includes(workId)) {
    fail(pack, `work ${workId} not listed in pack.workIds`);
  }
  if (original.work.contentPackId !== pack) fail(pack, `work.contentPackId != ${pack}`);
  catalogWorkIds.push(workId);
  for (const [i, ref] of originalRefs.entries()) {
    const o = originals[i];
    if (o.edition.kind !== "original") fail(pack, `${ref.file} edition.kind must be original`);
    if (o.edition.workId !== workId) fail(pack, `${ref.file}: workId mismatch`);
    const expectedId = originalEditionId(workId, ref.version);
    if (o.edition.id !== expectedId) {
      fail(pack, `${ref.file}: edition.id «${o.edition.id}», expected «${expectedId}»`);
    }
    // One work, one description of it. The work block is repeated in every
    // original file because each is built from its own segment spec, so the
    // gate is that they agree — otherwise the About page's account of a work
    // would depend on which file happened to be read.
    if (i > 0 && JSON.stringify(o.work) !== JSON.stringify(originals[0].work)) {
      fail(pack, `${ref.file}: work-blokken er ikke identisk med den i ${originalRefs[0].file}`);
    }
  }
  const source = original.work.source as Record<string, unknown> | undefined;
  for (const key of ["author", "title", "language", "sourceUrl", "retrievedAt", "provider", "license", "digitalEdition", "verificationStatus", "authorDeathYear", "rightsStatus"]) {
    if (!source || !source[key]) fail(pack, `work.source.${key} missing`);
  }
  for (const problem of rightsProblems(original.work, source)) fail(pack, problem);
  for (const o of originals) {
    checkSegments(pack, o.edition.id, o.edition.segments);
    for (const problem of moduleProblems(o.edition.id, o.edition.modules, o.edition.segments)) {
      fail(pack, problem);
    }
    checkContentHash(pack, o.edition.id, o.edition as unknown as { contentHash?: string; segments: Segment[] });
  }

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
  for (const o of originals) {
    for (const s of o.edition.segments) {
      for (const line of s.text.split("\n")) {
        if (line.length && !sourceLines.has(line)) {
          fail(pack, `${o.edition.id}/${s.id}: line not found in archived source: "${line.slice(0, 60)}"`);
        }
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
    //
    // From ITS OWN original, named by `basedOnEditionId` — not from the newest.
    // Once a work has grown, an older training edition rebuilt from the newer
    // original would legitimately fail, and "rebuild it against whatever is
    // current" is precisely the move that would quietly rewrite the text an
    // earlier session was typed against.
    const committed = await readFile(path.join(dir, f), "utf8");
    const committedJson = JSON.parse(committed) as { basedOnEditionId?: string };
    const basedOn = originals.find((o) => o.edition.id === committedJson.basedOnEditionId);
    if (!basedOn) {
      fail(
        pack,
        `${f}: basedOnEditionId «${String(committedJson.basedOnEditionId)}» navngir ingen original i pakken`,
      );
    } else {
      try {
        const rules = await loadRules(dir, Number(version));
        const rebuilt = serializeEdition(
          buildTrainingEdition(basedOn as unknown as OriginalFile, rules).edition,
        );
        if (rebuilt !== committed) {
          fail(pack, `${f}: not reproducible from rules.v${version}.json + ${basedOn.edition.id}\n${firstDifference(committed, rebuilt)}`);
        }
      } catch (err) {
        fail(pack, `${f}: cannot rebuild from rules.v${version}.json: ${(err as Error).message}`);
      }
    }

    // The profile owns the shared orthography (D9). Once a pack inherits a base
    // set, restating one of its rules is duplication — exactly what the
    // composition exists to remove — and contradicting one is an editorial
    // claim that has to be written down rather than buried in a dictionary.
    const rawRules = JSON.parse(await readFile(rulesFile, "utf8")) as Rules;
    if (rawRules.baseRules) {
      const base = getBaseRuleSet(rawRules.baseRules);
      if (!base) {
        fail(pack, `rules.v${version}.json: unknown base rule set ${rawRules.baseRules}`);
      } else {
        const { redundant, diverging } = baseOverrides(rawRules, base);
        for (const k of redundant) {
          fail(pack, `rules.v${version}.json: «${k}» repeats ${base.id} unchanged — inherit it instead`);
        }
        for (const k of diverging) {
          if (!(rawRules.retained ?? {})[k]) {
            fail(
              pack,
              `rules.v${version}.json: «${k}» overrides ${base.id} («${base.replacements?.[k]}» → «${rawRules.replacements?.[k]}») without a reason in "retained"`,
            );
          }
        }
      }
    }

    const t = (await readJson(path.join(dir, f))) as {
      id: string;
      workId: string;
      kind: string;
      languageProfileId?: string;
      adaptationStatus?: string;
      modules?: { id: string; title: string; order: number }[];
      basedOnEditionId?: string;
      contentHash?: string;
      basedOnContentHash?: string;
      segments: Segment[];
      editorialNotes?: string[];
    };
    if (t.kind !== "training-edition") fail(pack, `${f}: kind must be training-edition`);
    for (const problem of adaptationProblems(f, t)) fail(pack, problem);
    if (t.workId !== workId) fail(pack, `${f}: workId mismatch`);
    if (originals.some((o) => o.edition.id === t.id)) fail(pack, `${f}: id must differ from every original`);
    // `basedOn` is checked above, where the rebuild uses it; here it only has to
    // name one of the pack's originals rather than the newest.
    if (!originals.some((o) => o.edition.id === t.basedOnEditionId)) {
      fail(pack, `${f}: basedOnEditionId must point to an original in this pack`);
    }
    if (!t.languageProfileId || !KNOWN_PROFILES.has(t.languageProfileId)) {
      fail(pack, `${f}: unknown languageProfileId`);
    }
    if (!t.editorialNotes || t.editorialNotes.length === 0) fail(pack, `${f}: editorialNotes missing`);
    checkSegments(pack, t.id, t.segments);
    for (const problem of moduleProblems(t.id, t.modules, t.segments)) fail(pack, problem);
    checkContentHash(pack, f, t);
    const source = originals.find((o) => o.edition.id === t.basedOnEditionId) ?? original;
    const originalHash = (source.edition as unknown as { contentHash?: string }).contentHash;
    if (t.basedOnContentHash !== originalHash) {
      fail(pack, `${f}: basedOnContentHash does not match ${source.edition.id}`);
    }
    // The polite second person has to come through with its capital. This is
    // the one damage lowercaseNouns can do without misspelling a word, and the
    // one a reader cannot see: «Dem» (you) → «dem» (them), still grammatical.
    const polite = politeAddressProblems(f, source.edition.id, t.id, source.edition.segments, t.segments);
    const exempt = KNOWN_POLITE_DEFECTS.get(t.id);
    if (exempt !== undefined) {
      seenPoliteDefects.add(t.id);
      if (polite.length === 0) {
        warn(pack, `${f}: står i KNOWN_POLITE_DEFECTS («${exempt}») men har ingen feil lenger — fjern oppføringen`);
      }
    } else {
      for (const problem of polite) fail(pack, problem);
    }
    checkPassageLength(pack, t.id, t.segments);
    if (t.segments.length !== source.edition.segments.length) {
      fail(pack, `${f}: segment count differs from ${source.edition.id}`);
    }
    t.segments.forEach((s, i) => {
      const o = source.edition.segments[i];
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
    reviewable.push({ id: t.id, kind: t.kind, contentHash: String(t.contentHash) });
    trainingEditions.push({ id: t.id, workId: t.workId, contentHash: String(t.contentHash), segments: t.segments });
  }

  // Drill banks. Checked against the editions this pack just validated, so an
  // item is measured against the exact bytes that shipped rather than a copy.
  for (const problem of await drillProblems(dir, [
    ...(originals.map((o) => o.edition) as unknown as {
      id: string;
      workId: string;
      contentHash: string;
      segments: Segment[];
    }[]),
    ...trainingEditions,
  ])) {
    fail(pack, problem);
  }

  await checkReviews(pack, dir, [
    ...originals.map((o) => ({
      id: o.edition.id,
      kind: o.edition.kind,
      contentHash: String((o.edition as unknown as { contentHash?: string }).contentHash),
    })),
    ...reviewable,
  ]);
}

/**
 * A review file must agree with the editions it describes, and the edition a
 * reader actually types should have been read by a human.
 *
 * The second half is the point of the whole mechanism, so it is aimed at the
 * default edition only: superseded versions are history, and warning about
 * them would bury the one line that matters.
 */
async function checkReviews(
  pack: string,
  dir: string,
  editions: readonly { id: string; kind: string; contentHash: string }[],
) {
  const reviews = await loadReviews(dir);
  for (const problem of reviewProblems(pack, reviews, editions)) fail(pack, problem);

  const training = editions.filter((e) => e.kind === "training-edition");
  if (training.length === 0) return;
  const current = [...training].sort(
    (a, b) => editionMajorVersion(b.id) - editionMajorVersion(a.id),
  )[0];

  const entry = reviews[current.id];
  if (entry?.reviewStatus === "reviewed") return;
  const say = REVIEW_GATE === "fail" ? fail : warn;
  say(
    pack,
    `${current.id} er utgaven leseren faktisk skriver, og den er ${
      entry ? entry.reviewStatus : "ikke ført i review.json"
    }. Les den med «pnpm review:edition ${current.id}» og før den inn.`,
  );
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

/**
 * Shelves are the one list in content/ that spans packs, so they cannot be
 * checked inside validatePack(): «står dette verket på noen hylle» is only
 * answerable once every pack has been read.
 */
async function checkShelves() {
  const where = "shelves";
  let shelves;
  try {
    shelves = await loadShelves(contentRoot);
  } catch (e) {
    fail(where, (e as Error).message);
    return;
  }
  for (const problem of shelfProblems(shelves, catalogWorkIds)) fail(where, problem);
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
  await checkShelves();
  await checkGeneratedAssets();

  for (const [key, why] of KNOWN_LENGTH_DEVIATIONS) {
    if (!seenDeviations.has(key)) {
      warn(key.split("/")[0], `kjent lengdeavvik ${key} finnes ikke lenger — fjern unntaket «${why}»`);
    }
  }
  for (const [id, why] of KNOWN_POLITE_DEFECTS) {
    if (!seenPoliteDefects.has(id)) {
      warn(id.split(".")[0], `kjent tiltalefeil ${id} finnes ikke lenger som utgave — fjern unntaket «${why}»`);
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
