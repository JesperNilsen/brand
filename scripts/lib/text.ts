/** Shared text helpers for content scripts (no app imports). */

export function countWords(text: string): number {
  return text
    .split(/\s+/)
    .filter((t) => /[\p{L}\p{N}]/u.test(t)).length;
}

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
