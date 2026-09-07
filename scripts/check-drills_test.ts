/**
 * Proves the drill-bank rules in `scripts/lib/drills.ts` actually bite.
 *
 * The bank is the one thing in content/ that a human writes by hand rather
 * than generates, so it is the one thing no byte-for-byte rebuild check can
 * protect. Everything else under content/ is caught by regeneration: a
 * hand-edited training edition fails because it is not what its rules produce.
 * A hand-cut bank has no such twin. Its only defence is these rules, and a
 * rule nobody has watched fail is indistinguishable from one that cannot.
 *
 * So each rule is mutated in a real temp copy of the tree and `pnpm
 * validate:content` is run against it — the actual gate, not a mock of it.
 * The two the entry names by name are the verbatim rule and the stale-hash
 * rule; the rest are here because a bank that can repeat an id or pad itself
 * with two-character "quotes" is not honest either.
 *
 *   pnpm check:drills
 */
import { cpSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";

const ROOT = process.cwd();
const BANK = "content/ibsen-brand/drills.v1.json";
const EDITION = "content/ibsen-brand/training-edition.v1.json";

type Bank = {
  editionContentHash: string;
  items: { id: string; kind: string; text: string; segmentId: string }[];
};

const readBank = (dir: string): Bank => JSON.parse(readFileSync(join(dir, BANK), "utf8")) as Bank;
const writeBank = (dir: string, b: Bank) =>
  writeFileSync(join(dir, BANK), `${JSON.stringify(b, null, 2)}\n`);

const cases: { name: string; mutate: (dir: string) => void; expects: RegExp }[] = [
  {
    // The rule the whole design rests on: the bank is the edition, cut short.
    name: "an item edited to a phrase that is not in the edition",
    mutate: (d) => {
      const b = readBank(d);
      b.items[0].text = "Dette står ikke i Brand og har aldri gjort det.";
      writeBank(d, b);
    },
    expects: /finnes ikke ordrett i ibsen-brand\.training\.v1/,
  },
  {
    // The immutability binding: an edition may not be re-cut under a bank.
    name: "the edition's hash moves without the bank being rebuilt",
    mutate: (d) => {
      const b = readBank(d);
      b.editionContentHash = `sha256:${"0".repeat(64)}`;
      writeBank(d, b);
    },
    expects: /editionContentHash sha256:0000.* does not match ibsen-brand\.training\.v1/,
  },
  {
    // The same failure from the other side, which is how it will actually
    // happen: someone re-cuts the edition and forgets the bank.
    name: "the edition is re-cut and the bank is left behind",
    mutate: (d) => {
      const p = join(d, EDITION);
      const e = JSON.parse(readFileSync(p, "utf8")) as { contentHash: string };
      e.contentHash = `sha256:${"f".repeat(64)}`;
      writeFileSync(p, `${JSON.stringify(e, null, 2)}\n`);
    },
    expects: /editionContentHash .* does not match ibsen-brand\.training\.v1|contentHash .* != computed/,
  },
  {
    name: "a duplicate item id",
    mutate: (d) => {
      const b = readBank(d);
      b.items[1].id = b.items[0].id;
      writeBank(d, b);
    },
    expects: /duplicate item id/,
  },
  {
    name: "the same text twice under different ids",
    mutate: (d) => {
      const b = readBank(d);
      b.items[1].text = b.items[0].text;
      b.items[1].segmentId = b.items[0].segmentId;
      writeBank(d, b);
    },
    expects: /same text as an earlier item/,
  },
  {
    name: "an item shorter than the floor worth typing",
    mutate: (d) => {
      const b = readBank(d);
      const w = b.items.find((i) => i.kind === "word")!;
      w.text = w.text.slice(0, 3);
      writeBank(d, b);
    },
    expects: /under gulvet på 4 for «word»/,
  },
  {
    name: "an item pointing at a segment the edition does not have",
    mutate: (d) => {
      const b = readBank(d);
      b.items[0].segmentId = "akt9-99";
      writeBank(d, b);
    },
    expects: /segmentId akt9-99 is not in ibsen-brand\.training\.v1/,
  },
];

function tempTree(): string {
  const dir = mkdtempSync(join(tmpdir(), "check-drills-"));
  for (const d of ["content", "public", "src", "scripts"]) {
    cpSync(join(ROOT, d), join(dir, d), { recursive: true });
  }
  cpSync(join(ROOT, "tsconfig.json"), join(dir, "tsconfig.json"));
  symlinkSync(join(ROOT, "node_modules"), join(dir, "node_modules"));
  return dir;
}

function run(dir: string): { code: number; out: string } {
  const r = spawnSync(join(ROOT, "node_modules/.bin/tsx"), ["scripts/validate-content.ts"], {
    cwd: dir,
    encoding: "utf8",
  });
  return { code: r.status ?? -1, out: `${r.stdout ?? ""}${r.stderr ?? ""}` };
}

let failures = 0;
const note = (ok: boolean, name: string, detail = "") => {
  if (!ok) failures++;
  console.log(`  ${ok ? "ok  " : "FAIL"}  ${name}${detail ? `\n        ${detail}` : ""}`);
};

console.log("check-drills_test: proving validate:content fails on a dishonest bank\n");

{
  const dir = tempTree();
  try {
    const { code, out } = run(dir);
    note(code === 0, "the committed bank passes", code === 0 ? "" : out.trim());
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

for (const c of cases) {
  const dir = tempTree();
  try {
    c.mutate(dir);
    const { code, out } = run(dir);
    if (code === 0) note(false, c.name, "validate:content exited 0 — it does not catch this");
    else if (!c.expects.test(out)) {
      note(false, c.name, `failed, but not for this reason:\n        ${out.trim().split("\n").join("\n        ")}`);
    } else note(true, c.name);
  } catch (e) {
    note(false, c.name, String(e));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

console.log("");
if (failures > 0) {
  console.error(
    `check-drills_test: ${failures} of ${cases.length + 1} case(s) failed.\n\n` +
      "Either scripts/lib/drills.ts stopped checking something, or a mutation no\n" +
      "longer describes the bank. Fix whichever it is rather than deleting the case:\n" +
      "the bank is hand-written, so these rules are the only thing standing between\n" +
      "it and an unsourced second corpus.\n",
  );
  process.exit(1);
}
console.log(`check-drills_test: ${cases.length + 1} case(s) ok — the rules bite.`);
