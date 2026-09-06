/**
 * Tokenising and case-matching for the rule engine.
 *
 * Moved here from `scripts/lib/text.ts` so the matcher can live under `src/`:
 * the report path is meant to run in the browser eventually, and a matcher
 * that imports from `scripts/` cannot. `countWords` stayed behind — it is a
 * build-time statistic, not part of matching.
 */

/** Split into word and non-word tokens; words may contain letters, digits, apostrophes and inner hyphens. */
export function tokenize(text: string): string[] {
  return text.split(/([\p{L}\p{N}]+(?:[-'’][\p{L}\p{N}]+)*)/u).filter((t) => t.length > 0);
}

export function isWordToken(token: string): boolean {
  return /^[\p{L}\p{N}]/u.test(token);
}

/** Apply the case pattern of `source` to `replacement`. */
export function matchCase(source: string, replacement: string): string {
  if (source === source.toUpperCase() && source !== source.toLowerCase()) {
    return replacement.toUpperCase();
  }
  const first = source[0];
  if (first && first === first.toUpperCase() && first !== first.toLowerCase()) {
    return replacement[0].toUpperCase() + replacement.slice(1);
  }
  return replacement;
}
