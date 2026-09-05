/**
 * Build content/<pack>/original.json from an archived source text and a
 * segments.json that names each segment by its first and last line. The
 * segment text is always copied verbatim from the archived source (leading
 * indentation trimmed, runs of spaces collapsed, blank lines and page markers
 * dropped), so the original edition can never drift from its provenance.
 *
 *   pnpm tsx scripts/import/build-original.ts --pack ibsen-brand
 *
 * segments.json shape:
 * {
 *   "sourceFile": "source/runeberg-brand-0003-0014.txt",
 *   "work": { id, contentPackId, author, title, publishedYear, source },
 *   "edition": { id, version, editorialNotes? },
 *   "speakerLinePattern": "^[A-ZÆØÅ][A-ZÆØÅ ]*( \\(.*\\))?\\.$",   // optional
 *   "segments": [{ id, label?, start, end, difficulty? }]
 * }
 */
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { countWords } from "../lib/text";
import { editionContentHash } from "../lib/hash";

type SegmentSpec = {
  id: string;
  label?: string;
  start: string;
  end: string;
  difficulty?: 1 | 2 | 3 | 4 | 5;
};

type Spec = {
  sourceFile: string;
  work: Record<string, unknown>;
  edition: { id: string; version: string; editorialNotes?: string[] };
  speakerLinePattern?: string;
  segments: SegmentSpec[];
};

function arg(name: string): string {
  const i = process.argv.indexOf(`--${name}`);
  if (i === -1 || !process.argv[i + 1]) throw new Error(`Missing --${name}`);
  return process.argv[i + 1];
}

async function main() {
  const pack = arg("pack");
  const dir = path.resolve(process.cwd(), "content", pack);
  const spec = JSON.parse(await readFile(path.join(dir, "segments.json"), "utf8")) as Spec;
  const raw = await readFile(path.join(dir, spec.sourceFile), "utf8");
  const lines = raw
    .normalize("NFC")
    .split("\n")
    .map((l) => l.trim().replace(/[ \t]{2,}/g, " "))
    .filter((l) => l.length > 0 && !/^=== \d+$/.test(l));
  const speaker = spec.speakerLinePattern ? new RegExp(spec.speakerLinePattern) : null;

  let cursor = 0;
  const segments = spec.segments.map((s, index) => {
    const startIdx = lines.indexOf(s.start, cursor);
    if (startIdx === -1) throw new Error(`${s.id}: start line not found: ${s.start}`);
    const endIdx = lines.indexOf(s.end, startIdx);
    if (endIdx === -1) throw new Error(`${s.id}: end line not found: ${s.end}`);
    let from = startIdx;
    if (speaker && from > 0 && speaker.test(lines[from - 1])) from -= 1;
    const text = lines.slice(from, endIdx + 1).join("\n");
    cursor = endIdx + 1;
    return {
      id: s.id,
      order: index + 1,
      text,
      label: s.label,
      wordCount: countWords(text),
      difficulty: s.difficulty,
    };
  });

  const original = {
    work: spec.work,
    edition: {
      id: spec.edition.id,
      workId: spec.work.id,
      kind: "original",
      version: spec.edition.version,
      contentHash: editionContentHash(segments),
      segments,
      editorialNotes: spec.edition.editorialNotes ?? [],
    },
  };
  const out = path.join(dir, "original.json");
  await writeFile(out, JSON.stringify(original, null, 2) + "\n", "utf8");
  process.stdout.write(
    `wrote ${path.relative(process.cwd(), out)} (${segments.length} segments, ${segments.reduce((n, s) => n + s.wordCount, 0)} words)\n`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
