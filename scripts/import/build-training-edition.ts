/**
 * Build content/<pack>/training-edition.v1.json from original.json and a
 * rules.json that documents every orthographic normalisation. Word choice,
 * syntax and rhythm are never touched: the builder only substitutes whole
 * words listed in `replacements` (case preserved) and applies the explicit
 * regex `patterns`. Everything else is copied verbatim.
 *
 *   pnpm tsx scripts/import/build-training-edition.ts --pack ibsen-brand
 *
 * rules.json shape:
 * {
 *   "editionId": "ibsen-brand.training.v1",
 *   "version": "1.0.0",
 *   "languageProfileId": "brand-riksmaal",
 *   "notes": ["free-text editorial notes"],
 *   "patterns": [{ "from": "aa", "to": "å", "flags": "g", "note": "..." }],
 *   "replacements": { "af": "av", "hvad": "hva" },
 *   "retained": { "sprød": "rim med død" }
 * }
 */
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { countWords, isWordToken, matchCase, tokenize } from "../lib/text";

type Rules = {
  editionId: string;
  version: string;
  languageProfileId: string;
  notes?: string[];
  patterns?: { from: string; to: string; flags?: string; note?: string }[];
  replacements?: Record<string, string>;
  retained?: Record<string, string>;
};

function arg(name: string): string {
  const i = process.argv.indexOf(`--${name}`);
  if (i === -1 || !process.argv[i + 1]) throw new Error(`Missing --${name}`);
  return process.argv[i + 1];
}

export function applyRules(text: string, rules: Rules, usage: Map<string, number>): string {
  let out = text;
  for (const p of rules.patterns ?? []) {
    const re = new RegExp(p.from, p.flags ?? "g");
    out = out.replace(re, () => {
      usage.set(`pattern:${p.from}`, (usage.get(`pattern:${p.from}`) ?? 0) + 1);
      return p.to;
    });
  }
  const dict = rules.replacements ?? {};
  out = tokenize(out)
    .map((tok) => {
      if (!isWordToken(tok)) return tok;
      const key = tok.toLowerCase();
      const rep = dict[key];
      if (rep === undefined) return tok;
      usage.set(key, (usage.get(key) ?? 0) + 1);
      return matchCase(tok, rep);
    })
    .join("");
  return out;
}

async function main() {
  const pack = arg("pack");
  const dir = path.resolve(process.cwd(), "content", pack);
  const original = JSON.parse(await readFile(path.join(dir, "original.json"), "utf8"));
  const rules = JSON.parse(await readFile(path.join(dir, "rules.json"), "utf8")) as Rules;
  const usage = new Map<string, number>();

  const segments = original.edition.segments.map(
    (s: { id: string; order: number; text: string; label?: string; difficulty?: number }) => {
      const text = applyRules(s.text, rules, usage);
      return { ...s, text, wordCount: countWords(text) };
    },
  );

  const applied = [...usage.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  const dict = rules.replacements ?? {};
  const editorialNotes = [
    ...(rules.notes ?? []),
    ...(rules.patterns ?? []).map(
      (p) => `Mønster: /${p.from}/ → «${p.to}» (${usage.get(`pattern:${p.from}`) ?? 0} forekomster)${p.note ? ` — ${p.note}` : ""}`,
    ),
    ...applied
      .filter(([k]) => !k.startsWith("pattern:"))
      .map(([k, n]) => `Ortografi: «${k}» → «${dict[k]}» (${n})`),
    ...Object.entries(rules.retained ?? {}).map(([k, why]) => `Beholdt: «${k}» — ${why}`),
  ];
  const unused = Object.keys(dict).filter((k) => !usage.has(k));

  const edition = {
    id: rules.editionId,
    workId: original.edition.workId,
    kind: "training-edition",
    version: rules.version,
    languageProfileId: rules.languageProfileId,
    basedOnEditionId: original.edition.id,
    segments,
    editorialNotes,
  };
  const out = path.join(dir, "training-edition.v1.json");
  await writeFile(out, JSON.stringify(edition, null, 2) + "\n", "utf8");
  process.stdout.write(`wrote ${path.relative(process.cwd(), out)} (${applied.length} rules applied)\n`);
  if (unused.length) process.stdout.write(`unused replacements: ${unused.join(", ")}\n`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
