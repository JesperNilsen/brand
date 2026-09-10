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
import {
  cpSync,
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { editionContentHash } from "./lib/hash";

const ROOT = process.cwd();
// A pack with exactly ONE original, because the cases here add a synthetic
// second one — pointing this at a pack that already has two would overwrite a
// real file and fail for that reason instead of the one under test. That is
// exactly what happened the day kielland-noveletter grew.
const PACK = "content/ibsen-brand";

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
      t.basedOnEditionId = "ibsen-brand.original.v9";
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

/**
 * The other half: the BUILDER must refuse to rebase a published edition.
 *
 * The cases above all run `validate:content`, which is the wrong instrument for
 * this one — and that is the finding, not an inconvenience. `validate:content`
 * rebuilds a training edition from whichever original the file names, so a file
 * rebased onto a newer original validates perfectly clean: it really is
 * reproducible, from the text it now claims. The claim that changed is which
 * text that is, and nothing downstream holds the old value to compare against.
 *
 * So the gate has to sit in the builder, and these cases drive the builder
 * directly and then check the file on disk.
 */
type BuilderCase = {
  name: string;
  /** Arguments after `--pack <pack> --version 1`. */
  args: string[];
  /** Refusal expected: the message must match. `null` means it must succeed. */
  expects: RegExp | null;
  /** After a refusal the committed file must be byte-identical. */
  keepsFile?: boolean;
  /**
   * Output a SUCCESS case must produce.
   *
   * Without it the two success cases pass against the old builder too — it
   * rebased happily, which is the whole bug. Requiring the builder to announce
   * the rebase is what makes them discriminate.
   */
  says?: RegExp;
  /** Extra setup beyond the second original, and the file the case writes. */
  setup?: (dir: string) => void;
  writes?: string;
};

/** A rules.v2.json in the temp tree, so a NEW edition can be cut there. */
function addSecondRules(dir: string) {
  const file = join(dir, PACK, "rules.v1.json");
  const rules = JSON.parse(readFileSync(file, "utf8")) as Record<string, unknown>;
  rules.editionId = "ibsen-brand.training.v2";
  rules.version = "2.0.0";
  writeFileSync(join(dir, PACK, "rules.v2.json"), `${JSON.stringify(rules, null, 2)}\n`);
}

const builderCases: BuilderCase[] = [
  {
    // Requirement 1, and the reason the guard is conditional: a NEW cut still
    // takes the newest original without being asked twice. A lock that also
    // caught the first build of an edition would make every new cut a
    // two-command job for no gain.
    name: "a new edition still takes the newest original with no extra flag",
    args: [],
    expects: null,
    setup: addSecondRules,
    writes: join(PACK, "training-edition.v2.json"),
    says: /wrote .*training-edition\.v2\.json.*from original\.v2\.json/,
  },
  {
    // The one that bit on 2026-09-09, in exactly the shape it bit.
    name: "rebuilding a published edition picks up a newer original by default",
    args: [],
    expects: /finnes allerede og hviler på [\s\S]*ville skrevet den fra/,
    keepsFile: true,
  },
  {
    name: "the refusal says what would have changed, not just that something is wrong",
    args: [],
    expects: /segmenter ville fått annen tekst[\s\S]*contentHash ville flyttet seg/,
    keepsFile: true,
  },
  {
    name: "naming the newer original explicitly is still not consent to rebase",
    args: ["--original", "2"],
    expects: /finnes allerede og hviler på/,
    keepsFile: true,
  },
  {
    name: "--rebase-original without --original is refused",
    args: ["--rebase-original"],
    expects: /må stå sammen med --original/,
    keepsFile: true,
  },
  {
    // The documented way to reproduce a published edition: byte-identical.
    name: "--original 1 reproduces the committed edition exactly",
    args: ["--original", "1"],
    expects: null,
    keepsFile: true,
  },
  {
    // And the one deliberate way through, for when a rebase is the point.
    name: "--original 2 --rebase-original rebases, and says so",
    args: ["--original", "2", "--rebase-original"],
    expects: null,
    keepsFile: false,
    says: /rebaser .*training-edition\.v1\.json: .*original → .*original\.v2/,
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

// ---------------------------------------------------------------------------

console.log("\ncheck-originals_test: proving a published edition cannot change original\n");

const trainingV1 = join(PACK, "training-edition.v1.json");

for (const c of builderCases) {
  const dir = tempTree();
  try {
    addSecondOriginal(dir);
    c.setup?.(dir);
    const target = c.writes ?? trainingV1;
    const version = /training-edition\.v(\d+)\.json$/.exec(target)![1];
    const existed = existsSync(join(dir, target));
    const before = existed ? readFileSync(join(dir, target), "utf8") : null;
    const tsx = join(ROOT, "node_modules/.bin/tsx");
    const r = spawnSync(
      tsx,
      ["scripts/import/build-training-edition.ts", "--pack", "ibsen-brand", "--version", version, ...c.args],
      { cwd: dir, encoding: "utf8" },
    );
    const out = `${r.stdout ?? ""}${r.stderr ?? ""}`;
    const code = r.status ?? -1;
    const after = existsSync(join(dir, target)) ? readFileSync(join(dir, target), "utf8") : null;

    if (c.expects === null) {
      if (code !== 0) {
        note(false, c.name, `builder failed:\n        ${out.trim().split("\n").join("\n        ")}`);
      } else if (!existed && after === null) {
        note(false, c.name, "the new edition was not written");
      } else if (c.keepsFile && after !== before) {
        note(false, c.name, "the committed edition was rewritten, but should be byte-identical");
      } else if (c.keepsFile === false && after === before) {
        note(false, c.name, "the edition is unchanged — the rebase did not happen");
      } else if (c.says && !c.says.test(out)) {
        note(false, c.name, `succeeded, but said nothing about it:\n        ${out.trim()}`);
      } else {
        note(true, c.name);
      }
      continue;
    }
    if (code === 0) {
      note(false, c.name, "builder exited 0 — it does not refuse this");
    } else if (!c.expects.test(out)) {
      note(false, c.name, `refused, but not for this reason:\n        ${out.trim().split("\n").join("\n        ")}`);
    } else if (c.keepsFile && after !== before) {
      note(false, c.name, "refused, but the file on disk was written anyway");
    } else {
      note(true, c.name);
    }
  } catch (e) {
    note(false, c.name, String(e));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

const total = cases.length + builderCases.length;

console.log("");
if (failures > 0) {
  console.error(
    `check-originals_test: ${failures} of ${total} case(s) failed.\n\n` +
      "Either the versioning stopped holding or a case no longer describes the\n" +
      "tree. Fix whichever it is rather than deleting the case: without these,\n" +
      "growing a work silently rewrites the text every earlier session names.\n",
  );
  process.exit(1);
}
console.log(`check-originals_test: ${total} case(s) ok — a work can grow safely.`);
