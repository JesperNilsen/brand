/**
 * Proposes drill candidates from an edition's own text. It does not author
 * them, and it never writes `drills.v1.json`.
 *
 * This is T-11's shape, applied to short practice items instead of glosses:
 * the candidates are *derived from the corpus*, the selection is *written by
 * hand*, and the result sits beside the edition under the same immutability
 * rules. The reason is rights, not taste. Every item comes out of an edition
 * already in the repo — public-domain Ibsen, Hamsun, Kielland — so the bank
 * inherits exactly the rights the edition has and raises no new question.
 * Sourcing quotes from anywhere else would be a different problem with a
 * different answer, and `pnpm validate:content` refuses any item that is not
 * in the edition verbatim, so the bank cannot quietly become a second corpus.
 *
 * Why a proposer and not a generator. A machine can find every line that
 * contains an ø, and it cannot tell which of them is worth typing twenty
 * times. Selection is editorial: it decides what the reader practises. So this
 * writes `drills-candidates.vN.json` — untracked, a working file — and a
 * human cuts it down into the bank that ships.
 *
 *   pnpm build:drills                      # every pack, latest training edition
 *   pnpm build:drills ibsen-brand          # one pack
 */
import { readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const contentRoot = path.resolve(process.cwd(), "content");

type Segment = { id: string; order: number; text: string; wordCount: number };
type Edition = { id: string; workId: string; contentHash: string; segments: Segment[] };

export type Candidate = {
  kind: "quote" | "phrase" | "word";
  text: string;
  segmentId: string;
  /** Why the proposer put this forward. Read by a human, not by a machine. */
  because: string;
};

/**
 * Lines that are apparatus rather than text: a speaker label (`BRAND.`,
 * `BONDEN (skriger).`) and a stage direction (`(Oppe i sneen …`). They are how
 * a verse drama is set on the page, not language anyone should drill.
 */
const SPEAKER = /^[A-ZÆØÅ][A-ZÆØÅ\s.,'-]*(\s*\([^)]*\))?\.?$/;
const DIRECTION = /^\(/;

function isProse(line: string): boolean {
  const t = line.trim();
  if (t.length === 0) return false;
  if (DIRECTION.test(t)) return false;
  if (SPEAKER.test(t)) return false;
  return true;
}

/** Norwegian vowels an ISO keyboard puts under the little finger. */
const NORDIC = /[æøåÆØÅ]/;
/**
 * Orthography this corpus keeps and modern Norwegian does not. T-11 names the
 * class ("Ansigt", "Katheder", "Fjerpen"); these are the letter patterns that
 * produce it, so the proposer keeps working when a new work lands.
 */
const ARCHAIC = [/gt\b/, /^[A-ZÆØÅ]?[a-zæøå]*th/, /aa/, /ie\b/, /dt\b/, /nn?d\b/];
/** Marks that break typing rhythm: the reason a clause is worth drilling. */
const DENSE = /[;:—–-]|[,.]{1}.*[,.]{1}/;

const stripPunct = (w: string) => w.replace(/^[^\p{L}]+|[^\p{L}]+$/gu, "");

function candidatesFor(edition: Edition): Candidate[] {
  const out: Candidate[] = [];
  const seenWords = new Set<string>();

  for (const segment of edition.segments) {
    for (const raw of segment.text.split("\n")) {
      const line = raw.trim();
      if (!isProse(line)) continue;

      // A verse line that ends a sentence stands alone: it is a quote.
      if (/[.!?]$/.test(line) && line.length >= 20 && line.length <= 90) {
        out.push({ kind: "quote", text: line, segmentId: segment.id, because: "hel setning på én verselinje" });
      }
      // Punctuation-dense clauses, drilled for rhythm rather than for meaning.
      if (DENSE.test(line) && line.length >= 12 && line.length <= 60) {
        out.push({ kind: "phrase", text: line, segmentId: segment.id, because: "tegnsett tett — rytme" });
      }

      for (const word of line.split(/\s+/)) {
        const w = stripPunct(word);
        if (w.length < 4 || seenWords.has(w.toLowerCase())) continue;
        const why = NORDIC.test(w)
          ? "æ/ø/å"
          : ARCHAIC.some((r) => r.test(w))
            ? "1800-tallsortografi"
            : null;
        if (!why) continue;
        seenWords.add(w.toLowerCase());
        out.push({ kind: "word", text: w, segmentId: segment.id, because: why });
      }
    }
  }
  return out;
}

async function latestTrainingEdition(dir: string): Promise<Edition> {
  const files = (await readdir(dir))
    .filter((f) => /^training-edition\.v\d+\.json$/.test(f))
    .sort((a, b) => Number(/v(\d+)/.exec(a)![1]) - Number(/v(\d+)/.exec(b)![1]));
  const file = files.at(-1);
  if (!file) throw new Error(`${dir}: no training edition`);
  return JSON.parse(await readFile(path.join(dir, file), "utf8")) as Edition;
}

async function main() {
  const only = process.argv[2];
  const packs = (await readdir(contentRoot, { withFileTypes: true }))
    .filter((d) => d.isDirectory() && (!only || d.name === only))
    .map((d) => d.name)
    .sort();
  if (packs.length === 0) throw new Error(only ? `no such pack: ${only}` : "no packs");

  for (const pack of packs) {
    const dir = path.join(contentRoot, pack);
    const edition = await latestTrainingEdition(dir);
    const version = /\.v(\d+)$/.exec(edition.id)?.[1] ?? "1";
    const items = candidatesFor(edition);
    const file = path.join(dir, `drills-candidates.v${version}.json`);
    await writeFile(
      file,
      `${JSON.stringify(
        {
          note:
            "KANDIDATER, ikke banken. Skrevet av `pnpm build:drills`, ikke sporet i git. " +
            "Klipp den ned for hånd til drills.v" +
            version +
            ".json — maskinen foreslår, mennesket velger.",
          editionId: edition.id,
          editionContentHash: edition.contentHash,
          counts: {
            quote: items.filter((i) => i.kind === "quote").length,
            phrase: items.filter((i) => i.kind === "phrase").length,
            word: items.filter((i) => i.kind === "word").length,
          },
          candidates: items,
        },
        null,
        2,
      )}\n`,
      "utf8",
    );
    console.log(
      `build:drills — ${pack}: ${items.length} kandidater til ${path.relative(process.cwd(), file)}`,
    );
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
