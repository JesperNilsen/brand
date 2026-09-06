/**
 * Reporting: the ending of the scan that produces findings instead of text.
 *
 * `analyzeText` runs exactly the pipeline the builder runs, but keeps every
 * stage's matches and reports them against the text the caller handed in. That
 * last part is the work: stage two matches inside stage one's output, so a raw
 * offset from stage two points into a text the caller has never seen. Each
 * stage therefore carries a map back to the original, and a hit is reported at
 * the span of the original it belongs to.
 *
 * Nothing here writes a file, and nothing here rewrites the caller's text.
 */
import { applyHits, stageHits, stagesFor } from "./match";
import {
  DEFAULT_RULE_FAMILY,
  type RuleFamily,
  type RuleHit,
  type RuleKind,
  type RuleReport,
  type Rules,
} from "./types";

/** How much of the surrounding text a finding carries, in characters. */
const CONTEXT = 48;

export type AnalyzeOptions = {
  /** Names the rule set in the report. Defaults to the rule set's own edition id. */
  ruleSetId?: string;
  /** Defaults to the corpus family. Naming it is how a report says which norm it applied. */
  family?: RuleFamily;
};

/**
 * Report every place a rule would fire, without applying anything anywhere the
 * caller can see. `wouldBe` is what the rules would produce.
 */
export function analyzeText(text: string, rules: Rules, options: AnalyzeOptions = {}): RuleReport {
  const properNames = rules.lowercaseNouns
    ? new Set(rules.lowercaseNouns.properNames)
    : undefined;
  const stages = stagesFor(rules.patterns, rules.replacements, properNames);

  let cur = text;
  // For each character of `cur`, the span of `text` it came from.
  let from: number[] = [];
  let to: number[] = [];
  for (let i = 0; i < text.length; i += 1) {
    from.push(i);
    to.push(i + 1);
  }

  const hits: RuleHit[] = [];
  const fired = new Set<string>();

  for (const stage of stages) {
    const found = stageHits(cur, stage);
    if (found.length === 0) continue;

    const nextFrom: number[] = [];
    const nextTo: number[] = [];
    let out = "";
    let at = 0;

    for (const h of found) {
      fired.add(h.ruleKey);

      // Where this match lives in the caller's text.
      const start = h.start < from.length ? from[h.start] : text.length;
      const end = h.end > h.start ? to[h.end - 1] : start;
      hits.push({
        ruleKind: h.ruleKind,
        ruleKey: h.ruleKey,
        from: h.from,
        to: h.to,
        start,
        end,
        context: {
          before: text.slice(Math.max(0, start - CONTEXT), start),
          after: text.slice(end, end + CONTEXT),
        },
        ...(h.note ? { note: h.note } : {}),
      });

      for (let i = at; i < h.start; i += 1) {
        nextFrom.push(from[i]);
        nextTo.push(to[i]);
      }
      out += cur.slice(at, h.start);
      // Everything the rule inserts is attributed to the whole span it replaced.
      for (let k = 0; k < h.to.length; k += 1) {
        nextFrom.push(start);
        nextTo.push(end);
      }
      out += h.to;
      at = h.end;
    }

    for (let i = at; i < cur.length; i += 1) {
      nextFrom.push(from[i]);
      nextTo.push(to[i]);
    }
    out += cur.slice(at);

    cur = out;
    from = nextFrom;
    to = nextTo;
  }

  const silent: { ruleKind: RuleKind; ruleKey: string }[] = [];
  for (const p of rules.patterns ?? []) {
    const key = `pattern:${p.from}`;
    if (!fired.has(key)) silent.push({ ruleKind: "pattern", ruleKey: key });
  }
  for (const key of Object.keys(rules.replacements ?? {})) {
    if (!fired.has(key)) silent.push({ ruleKind: "replacement", ruleKey: key });
  }

  return {
    ruleSetId: options.ruleSetId ?? rules.editionId,
    family: options.family ?? DEFAULT_RULE_FAMILY,
    // Stage order is how they were found; position order is how they are read.
    // A stable sort keeps stage order among hits at the same offset, so a
    // later stage acting on an earlier stage's output still reads in sequence.
    hits: [...hits].sort((a, b) => a.start - b.start),
    silent,
    wouldBe: cur,
  };
}

/** Occurrence counts per rule, highest first — the summary a reviewer reads. */
export function hitCounts(report: RuleReport): { ruleKey: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const h of report.hits) counts.set(h.ruleKey, (counts.get(h.ruleKey) ?? 0) + 1);
  return [...counts.entries()]
    .map(([ruleKey, count]) => ({ ruleKey, count }))
    .sort((a, b) => b.count - a.count || a.ruleKey.localeCompare(b.ruleKey));
}

/** Line and column (1-based) of an offset, for a report a human reads. */
export function lineColumn(text: string, offset: number): { line: number; column: number } {
  let line = 1;
  let lineStart = 0;
  for (let i = 0; i < offset && i < text.length; i += 1) {
    if (text[i] === "\n") {
      line += 1;
      lineStart = i + 1;
    }
  }
  return { line, column: offset - lineStart + 1 };
}
