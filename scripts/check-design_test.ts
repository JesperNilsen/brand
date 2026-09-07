/**
 * Proves `scripts/check-design.ts` actually bites.
 *
 * A gate nobody has seen fail is indistinguishable from a gate that cannot
 * fail, and this repo has met the second kind: the exam-pool invariants in a
 * sibling project passed a drop-one and a duplicate-one mutation because they
 * compared lengths, and `.recedes` sat at 1.36:1 for months under a comment
 * that said it was legible. So every claim class in check-design.ts is
 * mutation-tested here, against real files in a real temp copy of the tree.
 * No mocks: the copy is what the gate reads, and the gate is the same script
 * the build runs.
 *
 * Ordering matters. `pnpm check:design` runs this file first and the gate
 * second, the shape the `reader` repo uses for its `check-*` gates
 * (`check-merge-product_test.py` runs before `make merge-check`). A green gate
 * whose self-test was skipped tells you nothing.
 */
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";

const ROOT = process.cwd();
const GATE = join(ROOT, "scripts/check-design.ts");
const TSX = join(ROOT, "node_modules/.bin/tsx");

type Case = {
  name: string;
  /** Mutates the temp copy. */
  mutate: (dir: string) => void;
  /** What the gate's stderr must mention, so a case cannot pass for the wrong reason. */
  expects: RegExp;
};

const edit = (dir: string, rel: string, from: string | RegExp, to: string) => {
  const path = join(dir, rel);
  const before = readFileSync(path, "utf8");
  const after = before.replace(from as never, to);
  if (after === before) throw new Error(`self-test setup: no match for ${from} in ${rel}`);
  writeFileSync(path, after);
};

const CSS = "src/app/globals.css";
const DOC = "DESIGN.md";

const cases: Case[] = [
  {
    // The exact regression the 2026-09-06 audit found and fixed.
    name: "--ink-faint darkened back toward the old #9a938a",
    mutate: (d) => edit(d, CSS, "--ink-faint: #746e65;", "--ink-faint: #9a938a;"),
    expects: /--ink-faint \(text, light\) is 2\.75:1/,
  },
  {
    // The distinction between decorative and interactive borders, which is the
    // whole reason --rule-strong exists.
    name: "--rule-strong made equal to --rule again",
    mutate: (d) => edit(d, CSS, "--rule-strong: #8f8b83;", "--rule-strong: #e3dcd0;"),
    expects: /--rule-strong \(boundary, light\) is 1\.23:1/,
  },
  {
    // The claim that was false for months behind a comment saying otherwise.
    name: ".recedes opacity returned to 0.22",
    mutate: (d) => edit(d, CSS, "opacity: 0.7;", "opacity: 0.22;"),
    expects: /opacity 0\.7; globals\.css says 0\.22/,
  },
  {
    name: "a ratio in DESIGN.md edited to a number the tokens do not produce",
    mutate: (d) => edit(d, DOC, "vs=paper ratio=4.56", "vs=paper ratio=4.99"),
    expects: /states --ink-faint at 4\.99:1 against --paper \(light\); the tokens produce 4\.56:1/,
  },
  {
    name: "the light and dark blocks disagreeing about which tokens exist",
    mutate: (d) => edit(d, CSS, /\n  --cursor: #d19a8a;(?=\n\})/, ""),
    expects: /--cursor is defined in :root but missing from \[data-theme="dark"\]/,
  },
  {
    // Two readers of the same page must not see different colours because one
    // chose dark and the other let the system choose it.
    name: "the two dark blocks disagreeing about a value",
    mutate: (d) =>
      edit(d, CSS, /(@media \(prefers-color-scheme: dark\)[\s\S]*?)--ink: #e9e3d8;/, "$1--ink: #ffffff;"),
    expects: /--ink disagrees between the two dark blocks/,
  },
  {
    // Adoption drift in the direction that actually happens: someone adds one
    // more ad-hoc utility and the doc's count silently stops being true.
    name: "one more ad-hoc size utility added to a component",
    mutate: (d) => edit(d, "src/components/HomeView.tsx", '<span className="block text-lg">', '<span className="block text-lg text-xl">'),
    expects: /states adhoc=17 for the type scale; src\/\*\*\/\*\.tsx has 18/,
  },
  {
    // The direction the entry calls out by name: the migration is finished but
    // the document still says it is not.
    name: "the migration finished while DESIGN.md still says pending",
    mutate: (d) => {
      edit(d, DOC, "status=pending adhoc=17 files=7 tokens=0", "status=pending adhoc=0 files=0 tokens=1");
      for (const f of [
        "src/app/layout.tsx",
        "src/app/om/page.tsx",
        "src/components/HistoryView.tsx",
        "src/components/ChooseView.tsx",
        "src/components/HomeView.tsx",
        "src/components/SessionView.tsx",
        "src/components/ResultView.tsx",
      ]) {
        const p = join(d, f);
        writeFileSync(p, readFileSync(p, "utf8").replace(/\btext-(?:3xl|2xl|xl|lg)\b/g, "text-[var(--text-body)]"));
      }
    },
    expects: /still says the type-scale migration \(T-14\) is pending/,
  },
  {
    name: "DESIGN.md claiming the migration is done while utilities remain",
    mutate: (d) => edit(d, DOC, "status=pending", "status=done"),
    expects: /says the type-scale migration \(T-14\) is done, but 17 ad-hoc/,
  },
];

function run(dir: string): { code: number; out: string } {
  const r = spawnSync(TSX, [GATE], { cwd: dir, encoding: "utf8" });
  return { code: r.status ?? -1, out: `${r.stdout ?? ""}${r.stderr ?? ""}` };
}

function tempTree(): string {
  const dir = mkdtempSync(join(tmpdir(), "check-design-"));
  cpSync(join(ROOT, "src"), join(dir, "src"), { recursive: true });
  cpSync(join(ROOT, "DESIGN.md"), join(dir, "DESIGN.md"));
  return dir;
}

let failures = 0;
const note = (ok: boolean, name: string, detail = "") => {
  if (!ok) failures++;
  console.log(`  ${ok ? "ok  " : "FAIL"}  ${name}${detail ? `\n        ${detail}` : ""}`);
};

console.log("check-design_test: proving the gate fails when it should\n");

{
  const dir = tempTree();
  try {
    const { code, out } = run(dir);
    note(code === 0, "an unmodified tree exits 0", code === 0 ? "" : out.trim());
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

for (const c of cases) {
  const dir = tempTree();
  try {
    c.mutate(dir);
    const { code, out } = run(dir);
    if (code === 0) {
      note(false, c.name, "gate exited 0 — it does not catch this");
    } else if (!c.expects.test(out)) {
      note(false, c.name, `gate failed, but not for this reason:\n        ${out.trim().split("\n").join("\n        ")}`);
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
    `check-design_test: ${failures} of ${cases.length + 1} case(s) failed.\n\n` +
      "A gate that cannot be shown to fail is not a gate. Either check-design.ts\n" +
      "stopped checking something, or a mutation above no longer describes the\n" +
      "tree (a token renamed, a rule moved) — fix whichever it is rather than\n" +
      "deleting the case.\n",
  );
  process.exit(1);
}
console.log(`check-design_test: ${cases.length + 1} case(s) ok — the gate bites.`);
