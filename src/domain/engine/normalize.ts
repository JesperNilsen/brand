/**
 * Transport-level normalisation only (see docs/spec/TYPING_ENGINE.md).
 * Newlines become "\n" and Unicode is NFC-normalised. Nothing else is touched:
 * punctuation, whitespace runs and letter case are preserved exactly.
 */
export function normalizeText(input: string): string {
  return input.replace(/\r\n?/g, "\n").normalize("NFC");
}
