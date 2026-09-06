/**
 * The one place rule matching happens.
 *
 * Rewriting and reporting are the same scan with two different endings, so
 * they share this module rather than each carrying their own copy of the
 * matching rules. That matters more than it sounds: the report is what a human
 * reads when deciding whether an edition is fit to publish, and a report
 * produced by a second, slightly different matcher would be a report about a
 * text nobody types.
 */
import { isWordToken, matchCase, tokenize } from "./text";
import type { RuleKind, RulePattern } from "./types";

/** Characters that end a sentence, or a dialogue dash that starts one. */
export const SENTENCE_BOUNDARY = /[.!?…—]/;
/** Opening quote marks used in the source texts (Danish „…“, guillemets, straight). */
export const OPENING_QUOTE = /[„«"'‘“]/;

/**
 * True if the word token at `tokens[i]` starts a sentence.
 *
 * Deliberately narrow: the first word of the segment, or a word whose
 * preceding non-word run contains a sentence-ending mark or an opening quote.
 * It does not parse abbreviations and does not tell a parenthetical dash from
 * a true sentence break. Both limits are tested rather than hidden, because
 * the failure they cause is a wrongly-cased word in a literary text.
 */
export function isSentenceInitial(tokens: string[], i: number): boolean {
  if (i === 0) return true;
  const between = tokens[i - 1];
  return SENTENCE_BOUNDARY.test(between) || OPENING_QUOTE.test(between);
}

/**
 * One step of the pipeline. Patterns are separate stages because they run over
 * each other's output today, and that sequencing is part of what the published
 * editions were built with.
 */
export type Stage =
  | { kind: "pattern"; pattern: RulePattern }
  | { kind: "replacement"; dict: Record<string, string> }
  | { kind: "lowercase"; properNames: ReadonlySet<string> };

/** A match within one stage's own input text. */
export type StageHit = {
  ruleKind: RuleKind;
  /** How `usage` counts it, and how the report names it. */
  ruleKey: string;
  from: string;
  to: string;
  start: number;
  end: number;
  note?: string;
};

/** The stages a rule set runs, in the order the builder runs them. */
export function stagesFor(
  patterns: readonly RulePattern[] | undefined,
  replacements: Record<string, string> | undefined,
  properNames?: ReadonlySet<string>,
): Stage[] {
  const stages: Stage[] = (patterns ?? []).map((pattern) => ({ kind: "pattern", pattern }) as const);
  stages.push({ kind: "replacement", dict: replacements ?? {} });
  if (properNames) stages.push({ kind: "lowercase", properNames });
  return stages;
}

function patternHits(text: string, pattern: RulePattern): StageHit[] {
  const flags = pattern.flags ?? "g";
  if (flags.includes("y")) {
    // A sticky pattern means something different once scanned rather than
    // replaced, and no rule set uses one. Refuse rather than guess.
    throw new Error(`Sticky flag is not supported in rule patterns: /${pattern.from}/${flags}`);
  }
  const global = flags.includes("g");
  const re = new RegExp(pattern.from, global ? flags : `${flags}g`);
  const hits: StageHit[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    hits.push({
      ruleKind: "pattern",
      ruleKey: `pattern:${pattern.from}`,
      from: m[0],
      // `applyRules` replaces with a function returning `p.to`, so `$1` and
      // friends are literal text, not capture references. Preserved exactly.
      to: pattern.to,
      start: m.index,
      end: m.index + m[0].length,
      note: pattern.note,
    });
    if (!global) break;
    // Mirror what a global String.replace does with an empty match.
    if (m[0].length === 0) re.lastIndex += 1;
  }
  return hits;
}

function replacementHits(text: string, dict: Record<string, string>): StageHit[] {
  const hits: StageHit[] = [];
  let at = 0;
  for (const tok of tokenize(text)) {
    const start = at;
    at += tok.length;
    if (!isWordToken(tok)) continue;
    const key = tok.toLowerCase();
    const rep = dict[key];
    if (rep === undefined) continue;
    hits.push({
      ruleKind: "replacement",
      ruleKey: key,
      from: tok,
      to: matchCase(tok, rep),
      start,
      end: at,
    });
  }
  return hits;
}

function lowercaseHits(text: string, properNames: ReadonlySet<string>): StageHit[] {
  const tokens = tokenize(text);
  const hits: StageHit[] = [];
  let at = 0;
  tokens.forEach((tok, i) => {
    const start = at;
    at += tok.length;
    if (!isWordToken(tok)) return;
    const first = tok[0];
    if (!first || first === first.toLowerCase()) return;
    if (properNames.has(tok)) return;
    if (isSentenceInitial(tokens, i)) return;
    hits.push({
      ruleKind: "lowercase",
      ruleKey: `lowercase:${tok}`,
      from: tok,
      to: first.toLowerCase() + tok.slice(1),
      start,
      end: at,
    });
  });
  return hits;
}

/** Every match one stage makes over its own input. Offsets are into `text`. */
export function stageHits(text: string, stage: Stage): StageHit[] {
  switch (stage.kind) {
    case "pattern":
      return patternHits(text, stage.pattern);
    case "replacement":
      return replacementHits(text, stage.dict);
    case "lowercase":
      return lowercaseHits(text, stage.properNames);
  }
}

/** Apply non-overlapping hits, which a single scan always produces in order. */
export function applyHits(text: string, hits: readonly StageHit[]): string {
  if (hits.length === 0) return text;
  let out = "";
  let at = 0;
  for (const h of hits) {
    out += text.slice(at, h.start) + h.to;
    at = h.end;
  }
  return out + text.slice(at);
}
