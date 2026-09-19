/**
 * `pnpm review:packet <editionId>` — the reading, regrouped by word pair.
 *
 * `review:edition` prints changes in reading order, which is right for reading
 * the text and wrong for judging it: the same pair («ej» → «ei») is then judged
 * fourteen separate times. This regroups by pair so a class is decided once,
 * keeps every occurrence with its context underneath so a class with an
 * exception is still visible, and leaves a verdict line to fill in.
 *
 * It lived outside the repository until now, as `~/dev/brand-review-packets/
 * packet.mjs`, and post-processed the tool's stdout with its own regexes —
 * nothing in the repo referenced it, so nothing failed when the two drifted.
 * It now reads `renderReading()` directly, the same lines the reader sees.
 *
 * Read-only. It writes a packet; it writes nothing into `content/`. Recording
 * a review is still a human editing `content/<pack>/review.json` — see the
 * header of `review-edition.ts` for why there is no `--approve` anywhere here.
 */
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { renderReading } from "./review-edition";

type Hit = { segment: string; pos: string; context: string };
type Pair = { from: string; to: string; rule: string; hits: Hit[] };
type Options = { editionId: string; out?: string };

/**
 * Classes LANGUAGE_PROFILE.md and D12 leave to a human, not to a rule.
 *
 * The -ede test is on the CHANGE, not on the word: «blækkede» → «blekkede» is
 * æ → e and keeps the ending, so it is ordinary orthography, and «Billede» →
 * «billede» is the lowercase-noun rule. What needs a decision is an ending that
 * actually moves — «hadede» → «hatet», «gloede» → «glodde» — because which
 * ending it moves to varies with the verb.
 */
const OPEN: { test: (from: string, to: string) => boolean; why: string }[] = [
  {
    test: (from, to) => /ede$/i.test(from) && !/ede$/i.test(to),
    why: "preteritum -ede: endelsen flyttes, og hvilken endelse varierer med verbet (D12 målte klassen og forkastet den som mekanisk regel)",
  },
  {
    test: (from) => /^(sagde|nogle|meget|selv|sjøl|mye)$/i.test(from),
    why: "ordvalg/bøyning, ikke ortografi — LANGUAGE_PROFILE forbyr å bytte forfatterens ordvalg",
  },
];

function parseArgs(argv: string[]): Options {
  const opts: Options = { editionId: "" };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === "--out") opts.out = argv[++i];
    else if (a.startsWith("--")) throw new Error(`Ukjent flagg: ${a}`);
    else if (!opts.editionId) opts.editionId = a;
    else throw new Error(`Uventet argument: ${a}`);
  }
  if (!opts.editionId) throw new Error("Bruk: pnpm review:packet <editionId> [--out <fil>]");
  return opts;
}

/** Regroup the reading's lines by word pair, keeping every occurrence. */
function group(lines: string[]): { pairs: Pair[]; header: string[]; changes: number } {
  const pairs = new Map<string, Pair>();
  const header: string[] = [];
  let segment: string | null = null;
  let last: Hit | null = null;
  let changes = 0;

  for (const raw of lines.flatMap((l) => l.split("\n"))) {
    const seg = /^──\s+(\S+)\s+·\s+(.*?)\s+\((\d+)\)\s*$/.exec(raw);
    if (seg) {
      segment = seg[1];
      continue;
    }
    const chg = /^\s{2}(\d+:\d+)\s+«(.+?)»\s+→\s+«(.+?)»\s+\[(.+?)\]\s*$/.exec(raw);
    if (chg) {
      const [, pos, from, to, rule] = chg;
      const key = `${from} → ${to}`;
      if (!pairs.has(key)) pairs.set(key, { from, to, rule, hits: [] });
      last = { segment: segment ?? "?", pos, context: "" };
      pairs.get(key)!.hits.push(last);
      changes += 1;
      continue;
    }
    if (last && /^\s{6,}\S/.test(raw) && !raw.includes("→")) {
      last.context = raw.trim();
      last = null;
      continue;
    }
    if (segment === null && raw.trim() && !raw.startsWith(">")) header.push(raw.trim());
  }

  const sorted = [...pairs.values()].sort(
    (a, b) => b.hits.length - a.hits.length || a.from.localeCompare(b.from, "no"),
  );
  return { pairs: sorted, header, changes };
}

function render(editionId: string, lines: string[]): { text: string; summary: string } {
  const { pairs, header, changes } = group(lines);
  const flagged = pairs.filter((p) => OPEN.some((o) => o.test(p.from, p.to)));
  const out: string[] = [];

  out.push(`# Lesepakke — ${editionId}`);
  out.push("");
  out.push(
    header
      .filter((l) => !l.startsWith("Redaksjonell lesning"))
      .map((l) => `${l}  `)
      .join("\n"),
  );
  out.push("");
  out.push(
    `${changes} endringer, ${pairs.length} distinkte ordpar. Gruppert etter ordpar, ikke etter ` +
      `lesningsrekkefølge: en klasse avgjøres én gang, og alle forekomstene står under den så et ` +
      `unntak fortsatt er synlig.`,
  );
  out.push("");
  out.push("Fyll ut **Dom:** under hvert par — `ok`, `→ annen form`, eller `behold originalen`.");
  out.push("Det som ender som «behold» eller «annen form» blir regelendringer i en ny `rules.vN.json`,");
  out.push("aldri håndredigering av utgaven: `validate:content` bygger utgaven på nytt og sammenligner.");
  out.push("");

  if (flagged.length) {
    out.push("## Krever avgjørelse først");
    out.push("");
    for (const p of flagged) {
      const why = OPEN.find((o) => o.test(p.from, p.to))!.why;
      out.push(`- **«${p.from}» → «${p.to}»** (${p.hits.length}) — ${why}`);
    }
    out.push("");
  }

  out.push("## Ordparene");
  out.push("");
  for (const p of pairs) {
    out.push(
      `### «${p.from}» → «${p.to}» · ${p.hits.length} ${p.hits.length === 1 ? "forekomst" : "forekomster"}`,
    );
    out.push("");
    out.push(`Regel: \`${p.rule}\``);
    out.push("");
    for (const h of p.hits) out.push(`- \`${h.segment} ${h.pos}\` ${h.context.replace(/\|/g, "\\|")}`);
    out.push("");
    out.push("**Dom:** ");
    out.push("");
  }

  return {
    text: out.join("\n"),
    summary: `${changes} endringer, ${pairs.length} ordpar, ${flagged.length} flagget`,
  };
}

async function main(): Promise<void> {
  const opts = parseArgs(process.argv.slice(2));
  const lines = await renderReading({ editionId: opts.editionId, summary: false });
  const { text, summary } = render(opts.editionId, lines);
  const target = opts.out ?? path.join("review-packets", `${opts.editionId}.md`);
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, text);
  console.log(`${target}: ${summary}`);
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exitCode = 1;
});
