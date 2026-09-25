/**
 * Propose `properNames` for a pack from the whole of its text.
 *
 * `lowercaseNouns` eats every capitalised word that is not sentence-initial
 * and not in `properNames`. So the list has to be derived from everything the
 * rule will see, not from the names a reader happened to notice: Noveletter's
 * six names were right for one story and silently wrong for seven, and the
 * cost was ~245 lowercased names and 81 polite «De»/«Dem»/«Deres» turned into
 * the third person (Q-016). The list for v4 was re-derived by hand from
 * 2 124 candidates. This is that derivation as a tool, so the next pack does
 * not do it by hand — *Sult* has ~2 880 candidates.
 *
 * It proposes. It does not author: the output goes to stdout, and the person
 * who reads it writes `rules.vN.json`. Same contract as `propose-segments.ts`,
 * for the same reason.
 *
 * Two things it gets right that a grep would not:
 *
 *  - It decides "mid-sentence" with `isSentenceInitial`, the exact heuristic
 *    `lowercaseNouns` uses. The list is therefore precisely what the rule
 *    would lowercase — no more, no less.
 *  - With `--rules N` it runs the pack's patterns and replacements first.
 *    `properNames` is matched on the lowercase stage, which runs AFTER those,
 *    so a name has to be listed in its post-pattern form: Gift lists «Håb»,
 *    not «Haab». Without `--rules` (a first draft, no rules file yet) it lists
 *    raw forms and says so.
 *
 *   pnpm tsx scripts/import/propose-proper-names.ts --pack hamsun-sult --rules 1
 *   pnpm tsx scripts/import/propose-proper-names.ts --pack hamsun-sult --min 2
 */
import { readFile } from "node:fs/promises";
import path from "node:path";
import {
  applyRules,
  isSentenceInitial,
  isWordToken,
  tokenize,
  type Rules,
} from "../../src/domain/language/rules";
import { loadRules } from "../lib/load-rules";
import { latestOriginal, readOriginal } from "../lib/originals";
import { POLITE } from "../lib/polite-address";

type Segment = { id: string; text: string };
type Original = { edition: { id: string; segments: Segment[] } };

export type Candidate = {
  token: string;
  count: number;
  /** Up to two `[segId] …before‹token›after…` snippets. */
  contexts: string[];
  polite: boolean;
  /** Already in the rules file's properNames. */
  already: boolean;
};

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  if (i === -1) return undefined;
  const v = process.argv[i + 1];
  if (!v || v.startsWith("--")) throw new Error(`Missing value for --${name}`);
  return v;
}

const CONTEXT = 36;

function snippet(text: string, start: number, end: number): string {
  const before = text.slice(Math.max(0, start - CONTEXT), start).replace(/\s+/g, " ");
  const after = text.slice(end, end + CONTEXT).replace(/\s+/g, " ");
  return `…${before}‹${text.slice(start, end)}›${after}…`;
}

/**
 * Every capitalised, non-sentence-initial word token, with counts and
 * contexts. `already` is the set the rules file lists today.
 */
export function proposeProperNames(
  segments: readonly Segment[],
  already: ReadonlySet<string> = new Set(),
): Candidate[] {
  const found = new Map<string, Candidate>();
  for (const seg of segments) {
    const tokens = tokenize(seg.text);
    let at = 0;
    tokens.forEach((tok, i) => {
      const start = at;
      at += tok.length;
      if (!isWordToken(tok)) return;
      const first = tok[0];
      if (!first || first === first.toLowerCase()) return;
      if (isSentenceInitial(tokens, i)) return;
      let c = found.get(tok);
      if (!c) {
        c = {
          token: tok,
          count: 0,
          contexts: [],
          polite: (POLITE as readonly string[]).includes(tok),
          already: already.has(tok),
        };
        found.set(tok, c);
      }
      c.count += 1;
      if (c.contexts.length < 2) c.contexts.push(`[${seg.id}] ${snippet(seg.text, start, at)}`);
    });
  }
  return [...found.values()].sort(
    (a, b) => b.count - a.count || a.token.localeCompare(b.token, "no"),
  );
}

function render(candidates: Candidate[], min: number): string[] {
  const out: string[] = [];
  const width = Math.max(...candidates.map((c) => c.token.length), 5);
  const line = (c: Candidate) => {
    const tags = [c.polite ? "POLITE" : "", c.already ? "already" : ""].filter(Boolean).join(" ");
    out.push(`${c.token.padEnd(width)}  ${String(c.count).padStart(4)}  ${tags}`.trimEnd());
    for (const ctx of c.contexts) out.push(`${" ".repeat(width + 8)}${ctx}`);
  };
  const main = candidates.filter((c) => c.count >= min);
  const tail = candidates.filter((c) => c.count < min);
  for (const c of main) line(c);
  if (tail.length) {
    out.push("");
    out.push(`# under --min ${min}, alfabetisk (${tail.length}):`);
    for (const c of [...tail].sort((a, b) => a.token.localeCompare(b.token, "no"))) line(c);
  }
  return out;
}

async function main(): Promise<void> {
  const pack = arg("pack");
  if (!pack) {
    throw new Error(
      "Bruk: pnpm tsx scripts/import/propose-proper-names.ts --pack <pakke> [--original N] [--rules N] [--min K]",
    );
  }
  const dir = path.resolve(process.cwd(), "content", pack);
  const originalVersion = arg("original") ? Number(arg("original")) : (await latestOriginal(dir)).version;
  const rulesVersion = arg("rules") ? Number(arg("rules")) : undefined;
  const min = arg("min") ? Number(arg("min")) : 1;

  const original = await readOriginal<Original>(dir, originalVersion);
  let segments: Segment[] = original.edition.segments;
  let already = new Set<string>();

  if (rulesVersion !== undefined) {
    const rules = await loadRules(dir, rulesVersion);
    const raw = JSON.parse(await readFile(path.join(dir, `rules.v${rulesVersion}.json`), "utf8")) as Rules;
    already = new Set(raw.lowercaseNouns?.properNames ?? []);
    const usage = new Map<string, number>();
    segments = segments.map((s) => ({ id: s.id, text: applyRules(s.text, rules, usage) }));
  }

  const candidates = proposeProperNames(segments, already);
  const total = candidates.reduce((n, c) => n + c.count, 0);

  console.log(`# properNames-kandidater for ${original.edition.id}`);
  console.log(
    rulesVersion !== undefined
      ? `# etter mønstre og erstatninger i rules.v${rulesVersion}.json — formene under er dem properNames må inneholde`
      : `# RÅ former (ingen --rules): et mønster som aa→å endrer formen properNames må inneholde. Kjør igjen med --rules N når reglene finnes.`,
  );
  console.log(`# ${candidates.length} distinkte, ${total} forekomster. POLITE = høflig tiltale, skal alltid inn. already = står i listen alt.`);
  console.log("");
  for (const l of render(candidates, min)) console.log(l);
  console.error(`${candidates.length} distinkte kandidater, ${total} forekomster, ${candidates.filter((c) => c.polite).length} høflige former`);
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  main().catch((err: unknown) => {
    console.error(err instanceof Error ? err.message : String(err));
    process.exitCode = 1;
  });
}
