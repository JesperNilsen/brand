/**
 * `pnpm review:edition <editionId>` — read a training edition against its
 * original, one change at a time, with each change attributed to the rule that
 * made it.
 *
 * This is the tool D11 is about. Every pack in the repository was drafted by
 * an agent and none has been read by a human, and the thing that has to be
 * checked is not whether the rules ran — the validator proves that — but
 * whether what they produced is defensible Norwegian.
 *
 * Read-only, deliberately, with no `--approve`. A flag that writes the
 * approval is one keystroke away from certifying nine hundred words nobody
 * read; recording a review means a human editing `content/<pack>/review.json`.
 */
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { analyzeText, hitCounts, lineColumn, type RuleHit } from "../src/domain/language/rules";
import { requireBaseRuleSet } from "../src/domain/language/base-rules";
import { loadRules } from "./lib/load-rules";
import { loadReviews } from "./lib/review";

const contentRoot = path.resolve(process.cwd(), "content");

type Options = { editionId: string; rule?: string; summary: boolean };
type Segment = { id: string; order: number; text: string; label?: string };

function parseArgs(argv: string[]): Options {
  const opts: Options = { editionId: "", summary: false };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === "--summary") opts.summary = true;
    else if (a === "--rule") opts.rule = argv[++i];
    else if (a.startsWith("--")) throw new Error(`Ukjent flagg: ${a}`);
    else if (!opts.editionId) opts.editionId = a;
    else throw new Error(`Uventet argument: ${a}`);
  }
  if (!opts.editionId) {
    throw new Error("Bruk: pnpm review:edition <editionId> [--rule <regel>] [--summary]");
  }
  return opts;
}

/** Find which pack and which rules version produced an edition id. */
async function locate(editionId: string): Promise<{ pack: string; dir: string; version: number }> {
  const packs = (await readdir(contentRoot, { withFileTypes: true }))
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .sort();
  const known: string[] = [];
  for (const pack of packs) {
    const dir = path.join(contentRoot, pack);
    for (const f of await readdir(dir)) {
      const m = /^training-edition\.v(\d+)\.json$/.exec(f);
      if (!m) continue;
      const parsed = JSON.parse(await readFile(path.join(dir, f), "utf8")) as { id: string };
      known.push(parsed.id);
      if (parsed.id === editionId) return { pack, dir, version: Number(m[1]) };
    }
  }
  throw new Error(`Ukjent utgave: ${editionId}\nKjente utgaver:\n  ${known.join("\n  ")}`);
}

/**
 * Whether a replacement key comes from the shared base set or the pack.
 *
 * `loadRules` composes the two and throws the provenance away, and changing
 * its return type would touch the validator, which rebuilds editions from it.
 * So the two halves are loaded again here, only to label the output.
 */
function ruleOrigin(
  ruleKey: string,
  packReplacements: Record<string, string>,
  baseReplacements: Record<string, string>,
): string {
  if (ruleKey.startsWith("pattern:") || ruleKey.startsWith("lowercase:")) return "pakke";
  if (ruleKey in packReplacements) return "pakke";
  if (ruleKey in baseReplacements) return "grunn";
  return "?";
}

function flatten(s: string): string {
  return s.replace(/\s+/g, " ");
}

async function main(): Promise<void> {
  const opts = parseArgs(process.argv.slice(2));
  const { pack, dir, version } = await locate(opts.editionId);

  const rules = await loadRules(dir, version);
  const rawPack = JSON.parse(
    await readFile(path.join(dir, `rules.v${version}.json`), "utf8"),
  ) as { baseRules?: string; replacements?: Record<string, string>; retained?: Record<string, string> };
  const base = rawPack.baseRules ? requireBaseRuleSet(rawPack.baseRules) : undefined;
  const packReplacements = rawPack.replacements ?? {};
  const baseReplacements = base?.replacements ?? {};

  const original = JSON.parse(await readFile(path.join(dir, "original.json"), "utf8")) as {
    edition: { id: string; segments: Segment[] };
  };
  const committed = JSON.parse(
    await readFile(path.join(dir, `training-edition.v${version}.json`), "utf8"),
  ) as { id: string; contentHash: string; segments: Segment[] };

  const reviews = await loadReviews(dir);
  const entry = reviews[opts.editionId];

  console.log(
    `Redaksjonell lesning — ${opts.editionId}\n` +
      `${pack} · original ${original.edition.id} · regler v${version}` +
      `${base ? ` · grunnregler ${base.id} (${base.version})` : " · ingen grunnregler"}\n` +
      `Status: ${entry ? `${entry.reviewStatus}${entry.reviewedBy ? ` av ${entry.reviewedBy}` : ""}${entry.reviewedAt ? ` (${entry.reviewedAt})` : ""}` : "ikke ført i review.json"}\n`,
  );

  let total = 0;
  let shown = 0;
  const allHits: RuleHit[] = [];

  for (const seg of [...original.edition.segments].sort((a, b) => a.order - b.order)) {
    const report = analyzeText(seg.text, rules);
    const target = committed.segments.find((s) => s.id === seg.id);
    if (!target) {
      throw new Error(`${opts.editionId}: segment ${seg.id} finnes ikke i den forpliktede utgaven`);
    }
    // Without this the report describes a text nobody types.
    if (report.wouldBe !== target.text) {
      throw new Error(
        `${opts.editionId}/${seg.id}: reglene gir ikke den forpliktede teksten. ` +
          `Kjør «pnpm validate:content» — utgaven er redigert for hånd, og det er den som må rettes, ikke lesningen.`,
      );
    }

    total += report.hits.length;
    allHits.push(...report.hits);
    const hits = opts.rule
      ? report.hits.filter((h) => h.ruleKey.includes(opts.rule!))
      : report.hits;
    if (hits.length === 0 || opts.summary) continue;

    console.log(`── ${seg.id}${seg.label ? ` · ${seg.label}` : ""} (${hits.length})`);
    for (const h of hits) {
      shown += 1;
      const { line, column } = lineColumn(seg.text, h.start);
      const origin = ruleOrigin(h.ruleKey, packReplacements, baseReplacements);
      console.log(`  ${`${line}:${column}`.padEnd(8)} «${h.from}» → «${h.to}»  [${origin}: ${h.ruleKey}]`);
      console.log(`  ${" ".repeat(8)} …${flatten(h.context.before)}[${h.from}]${flatten(h.context.after)}…`);
    }
    console.log("");
  }

  const counts = hitCounts({ ruleSetId: "", family: "historical-orthography", hits: allHits, silent: [], wouldBe: "" });
  console.log(
    `${total} endringer i ${original.edition.segments.length} segmenter, ${counts.length} regler` +
      (opts.rule ? ` — ${shown} vist med «${opts.rule}»` : ""),
  );
  for (const c of counts) {
    const origin = ruleOrigin(c.ruleKey, packReplacements, baseReplacements);
    console.log(`  ${c.ruleKey.padEnd(28)} ${String(c.count).padStart(3)}  [${origin}]`);
  }

  const unused = Object.keys(rules.replacements ?? {}).filter(
    (k) => !allHits.some((h) => h.ruleKey === k),
  );
  if (unused.length) {
    console.log(`\nRegler som ikke traff (${unused.length}): ${unused.join(", ")}`);
  }
  const retained = rawPack.retained ?? {};
  if (Object.keys(retained).length) {
    console.log("\nBevisst beholdt:");
    for (const [k, why] of Object.entries(retained)) console.log(`  «${k}» — ${why}`);
  }

  console.log(
    `\nFor å føre lesningen: legg inn «${opts.editionId}» i ${path.relative(process.cwd(), path.join(dir, "review.json"))} ` +
      `med reviewedContentHash ${committed.contentHash}`,
  );
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exitCode = 1;
});
