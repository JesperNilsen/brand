/**
 * Proves that a work can grow WITHOUT rewriting the editions already typed.
 *
 * A training edition has been versioned since D7, for a reason that applies
 * just as hard to the original: a stored result names the exact text it was
 * typed against, so that text has to still exist. `build-original.ts` wrote a
 * fixed `original.json`, which meant the only way to add text to a work was to
 * overwrite the original — and every training edition derived from it. Nothing
 * would have failed; the sessions would simply have started naming a text that
 * no longer existed. That is the failure this file exists to make impossible.
 *
 * Each case builds a real second original in a temp copy of the tree and runs
 * the real `validate:content` against it. The happy case matters as much as the
 * failures here: the whole point is that adding `original.v2.json` leaves the
 * v1 edition and everything derived from it untouched and still valid.
 *
 *   pnpm check:originals
 */
import { cpSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { editionContentHash } from "./lib/hash";

const ROOT = process.cwd();
const PACK = "content/kielland-noveletter";

type Original = {
  work: Record<string, unknown>;
  edition: {
    id: string;
    workId: string;
    kind: string;
    version: string;
    contentHash: string;
    segments: { id: string; order: number; text: string; wordCount: number }[];
    editorialNotes?: string[];
  };
};

const read = (dir: string, file: string): Original =>
  JSON.parse(readFileSync(join(dir, PACK, file), "utf8")) as Original;
const write = (dir: string, file: string, o: Original) =>
  writeFileSync(join(dir, PACK, file), `${JSON.stringify(o, null, 2)}\n`);

/**
 * A second original, shorter than the first by one segment.
 *
 * Shorter rather than longer because a temp tree has no more archived source to
 * draw on, and provenance is checked line by line — a synthetic *addition*
 * would fail for the wrong reason and prove nothing. What is being tested is
 * that two originals of different text can coexist, and dropping a segment
 * produces exactly that.
 */
function addSecondOriginal(dir: string): Original {
  const v1 = read(dir, "original.json");
  const segments = v1.edition.segments.slice(0, -1);
  const v2: Original = {
    work: v1.work,
    edition: {
      ...v1.edition,
      id: `${v1.edition.workId}.original.v2`,
      version: "2.0.0",
      contentHash: editionContentHash(segments),
      segments,
    },
  };
  write(dir, "original.v2.json", v2);
  return v2;
}

const cases: { name: string; mutate: (dir: string) => void; expects: RegExp | null }[] = [
  {
    // The point of the whole change: a second original lands, and the editions
    // built from the first stay valid, unchanged, still rebuildable.
    name: "a second original leaves the first and its training editions alone",
    mutate: (d) => addSecondOriginal(d),
    expects: null,
  },
  {
    name: "an original whose id does not match its file's version",
    mutate: (d) => {
      const v2 = addSecondOriginal(d);
      v2.edition.id = `${v2.edition.workId}.original.v7`;
      write(d, "original.v2.json", v2);
    },
    expects: /original\.v2\.json: edition\.id «.*original\.v7», expected «.*original\.v2»/,
  },
  {
    // Two files describing one work is a drift risk, so it is gated: the About
    // page's account of a work must not depend on which file was read.
    name: "two originals disagreeing about the work",
    mutate: (d) => {
      const v2 = addSecondOriginal(d);
      (v2.work as { title: string }).title = "Noveletter (utvidet)";
      write(d, "original.v2.json", v2);
    },
    expects: /work-blokken er ikke identisk/,
  },
  {
    // The rebuild has to follow basedOnEditionId, or an older training edition
    // would be "reproduced" from a text it was never cut from.
    name: "a training edition naming an original that does not exist",
    mutate: (d) => {
      addSecondOriginal(d);
      const file = join(d, PACK, "training-edition.v1.json");
      const t = JSON.parse(readFileSync(file, "utf8")) as { basedOnEditionId: string };
      t.basedOnEditionId = "kielland-noveletter.original.v9";
      writeFileSync(file, `${JSON.stringify(t, null, 2)}\n`);
    },
    expects: /navngir ingen original i pakken/,
  },
  {
    // And the one the versioning exists to prevent: an original edited in place.
    name: "the first original's text edited rather than superseded",
    mutate: (d) => {
      const v1 = read(d, "original.json");
      v1.edition.segments[0].text = `${v1.edition.segments[0].text} Lagt til.`;
      write(d, "original.json", v1);
    },
    expects: /contentHash|line not found in archived source/,
  },
];

function tempTree(): string {
  const dir = mkdtempSync(join(tmpdir(), "check-originals-"));
  for (const d of ["content", "public", "src", "scripts"]) {
    cpSync(join(ROOT, d), join(dir, d), { recursive: true });
  }
  cpSync(join(ROOT, "tsconfig.json"), join(dir, "tsconfig.json"));
  symlinkSync(join(ROOT, "node_modules"), join(dir, "node_modules"));
  return dir;
}

/**
 * `pnpm build:content` then `pnpm validate:content`, which is the real order.
 *
 * Regenerating first is not a convenience: adding an original changes the
 * catalog, and a validator run against a stale catalog fails for that reason
 * instead of the one under test. A build that refuses outright counts as the
 * gate catching it, so its output is matched too.
 */
function run(dir: string): { code: number; out: string } {
  const tsx = join(ROOT, "node_modules/.bin/tsx");
  const build = spawnSync(tsx, ["scripts/build-content-assets.ts"], { cwd: dir, encoding: "utf8" });
  const buildOut = `${build.stdout ?? ""}${build.stderr ?? ""}`;
  if ((build.status ?? -1) !== 0) return { code: build.status ?? -1, out: buildOut };
  const r = spawnSync(tsx, ["scripts/validate-content.ts"], { cwd: dir, encoding: "utf8" });
  return { code: r.status ?? -1, out: `${buildOut}${r.stdout ?? ""}${r.stderr ?? ""}` };
}

let failures = 0;
function note(ok: boolean, name: string, detail = "") {
  if (!ok) failures += 1;
  console.log(`  ${ok ? "ok  " : "FAIL"}  ${name}${detail ? `\n        ${detail}` : ""}`);
}

console.log("check-originals_test: proving a work can grow without rewriting its past\n");

for (const c of cases) {
  const dir = tempTree();
  try {
    c.mutate(dir);
    const { code, out } = run(dir);
    if (c.expects === null) {
      if (code === 0) note(true, c.name);
      else note(false, c.name, `validate:content failed:\n        ${out.trim().split("\n").join("\n        ")}`);
    } else if (code === 0) {
      note(false, c.name, "validate:content exited 0 — it does not catch this");
    } else if (!c.expects.test(out)) {
      note(false, c.name, `failed, but not for this reason:\n        ${out.trim().split("\n").join("\n        ")}`);
    } else {
      note(true, c.name);
    }
  } catch (e) {
    note(false, c.name, String(e));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

console.log("");
if (failures > 0) {
  console.error(
    `check-originals_test: ${failures} of ${cases.length} case(s) failed.\n\n` +
      "Either the versioning stopped holding or a case no longer describes the\n" +
      "tree. Fix whichever it is rather than deleting the case: without these,\n" +
      "growing a work silently rewrites the text every earlier session names.\n",
  );
  process.exit(1);
}
console.log(`check-originals_test: ${cases.length} case(s) ok — a work can grow safely.`);
