/**
 * `pnpm sprakrens <fil>` — report what a rule set would change in a text,
 * without changing anything.
 *
 * This is the diagnostic half of the rule engine. It exists so a rule set can
 * be measured against a text before anyone commits to rewriting it: which
 * rules fire, where, how often, and — the half that is easy to forget — which
 * rules never fire at all.
 *
 * Deliberately uncoloured: the output is read as often through a pipe or in a
 * diff as in a terminal. The match is delimited instead.
 *
 * It opens no file for writing. The report goes to stdout.
 */
import { readFile } from "node:fs/promises";
import path from "node:path";
import {
  analyzeText,
  hitCounts,
  lineColumn,
  DEFAULT_RULE_FAMILY,
  type RuleReport,
  type Rules,
} from "../src/domain/language/rules";
import { DEFAULT_LANGUAGE_PROFILE_ID, requireLanguageProfile } from "../src/domain/language/registry";
import { getBaseRuleSet, listBaseRuleSets } from "../src/domain/language/base-rules";
import type { LanguageBaseRuleSet } from "../src/domain/types";
import { countWords } from "./lib/text";

type Options = { file: string; ruleSetId?: string; json: boolean; summary: boolean };

function parseArgs(argv: string[]): Options {
  const opts: Options = { file: "", json: false, summary: false };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === "--json") opts.json = true;
    else if (a === "--summary") opts.summary = true;
    else if (a === "--rules") opts.ruleSetId = argv[++i];
    else if (a.startsWith("--")) throw new Error(`Ukjent flagg: ${a}`);
    else if (!opts.file) opts.file = a;
    else throw new Error(`Uventet argument: ${a}`);
  }
  if (!opts.file) {
    throw new Error(
      "Bruk: pnpm sprakrens <fil.txt> [--rules <regelsett-id>] [--summary] [--json]",
    );
  }
  return opts;
}

/** The rule set to measure against: the one asked for, or the profile's newest. */
function resolveRuleSet(id: string | undefined): LanguageBaseRuleSet {
  const profile = requireLanguageProfile(DEFAULT_LANGUAGE_PROFILE_ID);
  const available = listBaseRuleSets(profile.id);
  if (!id) {
    const newest = available[available.length - 1];
    if (!newest) throw new Error(`${profile.id} har ingen grunnregelsett`);
    return newest;
  }
  const found = getBaseRuleSet(id);
  if (!found) {
    throw new Error(
      `Ukjent regelsett: ${id}\nTilgjengelige: ${available.map((s: LanguageBaseRuleSet) => s.id).join(", ")}`,
    );
  }
  return found;
}

function asRules(set: LanguageBaseRuleSet): Rules {
  return {
    editionId: set.id,
    version: set.version,
    languageProfileId: set.languageProfileId,
    patterns: set.patterns,
    replacements: set.replacements,
  };
}

/** Context with newlines flattened, so one finding stays on one line. */
function flatten(s: string): string {
  return s.replace(/\s+/g, " ");
}

function printReport(report: RuleReport, text: string, opts: Options, file: string): void {
  const counts = hitCounts(report);
  console.log(
    `Språkrens — ${report.ruleSetId} · familie: ${report.family}\n` +
      `${path.relative(process.cwd(), file)} · ${text.length} tegn · ${countWords(text)} ord\n`,
  );

  if (report.hits.length === 0) {
    console.log("Ingen treff. Teksten er allerede på denne formen.\n");
  } else if (!opts.summary) {
    const pad = " ".repeat(9);
    for (const h of report.hits) {
      const { line, column } = lineColumn(text, h.start);
      console.log(`  ${`${line}:${column}`.padEnd(9)} «${h.from}» → «${h.to}»  [${h.ruleKey}]`);
      console.log(
        `  ${pad} …${flatten(h.context.before)}[${h.from}]${flatten(h.context.after)}…`,
      );
      if (h.note) console.log(`  ${pad} ${h.note}`);
    }
    console.log("");
  }

  console.log(`${report.hits.length} forekomster fordelt på ${counts.length} regler:`);
  for (const c of counts) console.log(`  ${c.ruleKey.padEnd(24)} ${c.count}`);

  console.log(
    `\nStille (${report.silent.length} regler traff ikke): ` +
      (report.silent.length === 0
        ? "ingen — hele settet var i bruk"
        : report.silent.map((s) => s.ruleKey).join(", ")),
  );
}

async function main(): Promise<void> {
  const opts = parseArgs(process.argv.slice(2));
  const set = resolveRuleSet(opts.ruleSetId);
  const file = path.resolve(process.cwd(), opts.file);
  const text = await readFile(file, "utf8");

  const report = analyzeText(text, asRules(set), {
    ruleSetId: `${set.id} (${set.version})`,
    family: set.family ?? DEFAULT_RULE_FAMILY,
  });

  if (opts.json) {
    console.log(JSON.stringify(report, null, 2));
    return;
  }
  printReport(report, text, opts, file);
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exitCode = 1;
});
