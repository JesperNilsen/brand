/**
 * Text filters — practice-form transforms applied to the target text.
 *
 * A filter is NOT a language normalisation and NOT a game mode. It changes how
 * demanding the same edition is to type: whether capitals and punctuation are
 * present, and whether verse lines survive as line breaks.
 *
 * It is applied when a SessionPlan is built (see src/lib/session-flow.ts), so
 * the typing engine still compares against exactly the text it was handed and
 * never learns about filters. The chosen filter is recorded on the SessionPlan
 * and on the stored SessionResult, because results typed under different
 * filters are not comparable.
 */
import type { TextSegment } from "../types";

export type TextFilterId = "as-printed" | "no-punctuation" | "words-only";

export const DEFAULT_TEXT_FILTER_ID: TextFilterId = "as-printed";

export type TextFilter = {
  id: TextFilterId;
  displayName: string;
  description: string;
  /** True when the filter alters the text, so results need a marker. */
  altersText: boolean;
  apply(text: string): string;
};

/**
 * Characters that may stay when they join two letters (is-tjern, Paris’s).
 * Every Unicode hyphen and apostrophe variant that appears in the printed
 * editions belongs here; anything omitted would silently glue two words
 * together instead of separating them.
 */
const JOINERS = new Set([
  "-", // hyphen-minus
  "‐", // hyphen
  "‑", // non-breaking hyphen
  "’", // right single quotation mark
  "'", // apostrophe
  "ʼ", // modifier letter apostrophe
]);

function isLetterOrNumber(ch: string | undefined): boolean {
  return ch !== undefined && /[\p{L}\p{N}]/u.test(ch);
}

/**
 * Remove punctuation, keeping hyphens and apostrophes that sit inside a word.
 * Letter case and line breaks are untouched.
 *
 * Separating punctuation becomes a SPACE rather than nothing. Deleting it
 * would fuse the words on either side: the printed editions set em dashes
 * tight against the words they separate, so «ord—ord» must become «ord ord»
 * and never «ordord». Line-end hyphenation is not reconstructed; the archived
 * source texts join wrapped lines, so it does not reach this function.
 */
export function stripPunctuation(text: string): string {
  const chars = Array.from(text);
  let out = "";
  for (let i = 0; i < chars.length; i += 1) {
    const ch = chars[i];
    if (!/[\p{P}\p{S}]/u.test(ch)) {
      out += ch;
      continue;
    }
    if (
      JOINERS.has(ch) &&
      isLetterOrNumber(chars[i - 1]) &&
      isLetterOrNumber(chars[i + 1])
    ) {
      out += ch;
      continue;
    }
    out += " ";
  }
  return out;
}

/** Collapse runs of spaces/tabs, trim each line, drop lines left empty. */
export function tidyWhitespace(text: string): string {
  return text
    .split("\n")
    .map((line) => line.replace(/[ \t]+/g, " ").trim())
    .filter((line) => line.length > 0)
    .join("\n");
}

const asPrinted: TextFilter = {
  id: "as-printed",
  displayName: "Som trykt",
  description: "Teksten slik utgaven har den, med tegnsetting og verselinjer.",
  altersText: false,
  apply: (text) => text,
};

const noPunctuation: TextFilter = {
  id: "no-punctuation",
  displayName: "Uten tegnsetting",
  description: "Store bokstaver og verselinjer beholdes; tegnsetting fjernes.",
  altersText: true,
  apply: (text) => tidyWhitespace(stripPunctuation(text)),
};

const wordsOnly: TextFilter = {
  id: "words-only",
  displayName: "Bare ord",
  description: "Små bokstaver, ingen tegnsetting, linjeskift blir mellomrom.",
  altersText: true,
  apply: (text) =>
    tidyWhitespace(stripPunctuation(text.replace(/\n/g, " "))).toLowerCase(),
};

const filters: readonly TextFilter[] = [asPrinted, noPunctuation, wordsOnly];

export function listTextFilters(): readonly TextFilter[] {
  return filters;
}

export function getTextFilter(id: string): TextFilter | undefined {
  return filters.find((f) => f.id === id);
}

export function requireTextFilter(id: string): TextFilter {
  return getTextFilter(id) ?? asPrinted;
}

export function isTextFilterId(value: unknown): value is TextFilterId {
  return typeof value === "string" && getTextFilter(value) !== undefined;
}

export function countWords(text: string): number {
  return text.split(/\s+/).filter((t) => /[\p{L}\p{N}]/u.test(t)).length;
}

/**
 * Apply a filter to a list of segments, recomputing word counts.
 *
 * The mapping is strictly 1:1. A segment that a filter emptied must never
 * disappear from the plan: Nonstop stores its position as a segment id, so a
 * vanished segment would push saved progress past text the reader never typed,
 * and switching back to another practice form would skip it silently.
 * `pnpm validate:content` forbids content that any filter can empty, so the
 * fallback below should never fire; it keeps the mapping total if it ever does.
 */
export function applyTextFilter(
  segments: TextSegment[],
  filterId: TextFilterId,
): TextSegment[] {
  const filter = requireTextFilter(filterId);
  if (!filter.altersText) return segments;
  return segments.map((s) => {
    const text = filter.apply(s.text);
    const wordCount = countWords(text);
    if (wordCount === 0) return s;
    return { ...s, text, wordCount };
  });
}
