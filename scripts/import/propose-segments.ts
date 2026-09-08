/**
 * Propose a segment spec for a work that is too long to cut by hand.
 *
 * `segments.json` names every segment by its first and last line, which is
 * exactly right for an opening excerpt of a dozen segments and unworkable for a
 * collection of four hundred. This proposes the cut mechanically — never
 * splitting a paragraph, staying inside the passage length CORPUS.md asks for —
 * and prints it for a human to read, adjust and commit.
 *
 * It proposes. It does not author: the output goes to stdout, and the file it
 * would become is written by the person who read it. The same rule the drill
 * bank follows, for the same reason — a machine's suggestion sitting in a
 * content file is indistinguishable from an editorial decision once committed.
 *
 *   pnpm tsx scripts/import/propose-segments.ts \
 *     --pack kielland-noveletter --part "Haabet er lysegrønt" \
 *     --file source/haabet-er-lysegroent.txt --prefix haabet
 */
import { readFile } from "node:fs/promises";
import path from "node:path";
import { countWords } from "../lib/text";

/** CORPUS.md's passage range; the validator warns outside it. */
const MIN_WORDS = 35;
const MAX_WORDS = 120;

function arg(name: string): string {
  const i = process.argv.indexOf(`--${name}`);
  if (i === -1 || !process.argv[i + 1]) throw new Error(`Missing --${name}`);
  return process.argv[i + 1];
}

export type Proposed = {
  id: string;
  part: string;
  label: string;
  start: string;
  end: string;
};

/**
 * Group paragraphs into segments of MIN..MAX words.
 *
 * Paragraphs are never split: a segment boundary inside a paragraph would put
 * the reader mid-sentence at the start of a session, and `build-original.ts`
 * addresses segments by whole lines anyway. A paragraph longer than MAX becomes
 * its own segment — the alternative is to break the author's own unit, and the
 * length rule is advisory where the text is not.
 */
export function proposeSegments(
  paragraphs: string[],
  part: string,
  prefix: string,
): Proposed[] {
  const out: Proposed[] = [];
  let current: string[] = [];
  let words = 0;

  const flush = () => {
    if (current.length === 0) return;
    const n = out.length + 1;
    out.push({
      id: `${prefix}-${String(n).padStart(2, "0")}`,
      part,
      label: `${part}, ${n}`,
      start: current[0],
      end: current.at(-1)!,
    });
    current = [];
    words = 0;
  };

  for (const paragraph of paragraphs) {
    const w = countWords(paragraph);
    // Starting a new segment when this paragraph would overshoot, unless the
    // one in hand is still too short to stand alone.
    if (current.length > 0 && words + w > MAX_WORDS && words >= MIN_WORDS) flush();
    current.push(paragraph);
    words += w;
    if (words >= MAX_WORDS) flush();
  }
  flush();
  return out;
}

async function main() {
  const pack = arg("pack");
  const part = arg("part");
  const file = arg("file");
  const prefix = arg("prefix");
  const dir = path.resolve(process.cwd(), "content", pack);
  const raw = await readFile(path.join(dir, file), "utf8");
  const paragraphs = raw
    .normalize("NFC")
    .split("\n")
    .map((l) => l.trim().replace(/[ \t]{2,}/g, " "))
    .filter((l) => l.length > 0);

  const segments = proposeSegments(paragraphs, part, prefix);
  const counts = segments.map((s) => {
    const from = paragraphs.indexOf(s.start);
    const to = paragraphs.indexOf(s.end, from);
    return paragraphs.slice(from, to + 1).reduce((n, p) => n + countWords(p), 0);
  });
  process.stderr.write(
    `${part}: ${segments.length} segmenter, ${counts.reduce((a, b) => a + b, 0)} ord ` +
      `(minst ${Math.min(...counts)}, størst ${Math.max(...counts)}, ` +
      `${counts.filter((c) => c < MIN_WORDS || c > MAX_WORDS).length} utenfor ${MIN_WORDS}-${MAX_WORDS})\n`,
  );
  process.stdout.write(`${JSON.stringify(segments, null, 2)}\n`);
}

if (process.argv[1] && process.argv[1].endsWith("propose-segments.ts")) {
  main().catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  });
}
