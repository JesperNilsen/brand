/** Shared text helpers for content scripts (no app imports). */

// Tokenising and case-matching moved to the rule engine, which needs them in
// `src/`. Re-exported here so build scripts and tests keep one import site.
export { isWordToken, matchCase, tokenize } from "../../src/domain/language/rules/text";

export function countWords(text: string): number {
  return text
    .split(/\s+/)
    .filter((t) => /[\p{L}\p{N}]/u.test(t)).length;
}
