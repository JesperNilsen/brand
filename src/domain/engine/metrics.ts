/**
 * Measurement definitions (docs/spec/TYPING_ENGINE.md). The same functions
 * feed the live meter, the stored SessionResult and the history view.
 *
 *   grossWpm = (typedCharacters / 5) / elapsedMinutes
 *   netWpm   = grossWpm * accuracy
 *   accuracy = correctCharacters / comparedCharacters
 *
 * comparedCharacters = positions with user input, bounded by target length.
 * errorCount = mistyped insertions during the session (corrected or not).
 * Sessions shorter than PROVISIONAL_THRESHOLD_MS are flagged `provisional`.
 */

export const PROVISIONAL_THRESHOLD_MS = 5000;

export type CharacterCounts = {
  targetCharacterCount: number;
  typedCharacterCount: number;
  comparedCharacterCount: number;
  correctCharacterCount: number;
  errorCount: number;
};

export type Metrics = CharacterCounts & {
  durationMs: number;
  grossWpm: number;
  netWpm: number;
  accuracy: number;
  provisional: boolean;
};

export function countCharacters(
  targetText: string,
  typedText: string,
  errorCount: number,
): CharacterCounts {
  const compared = Math.min(typedText.length, targetText.length);
  let correct = 0;
  for (let i = 0; i < compared; i += 1) {
    if (typedText[i] === targetText[i]) correct += 1;
  }
  return {
    targetCharacterCount: targetText.length,
    typedCharacterCount: compared,
    comparedCharacterCount: compared,
    correctCharacterCount: correct,
    errorCount,
  };
}

export function computeMetrics(
  counts: CharacterCounts,
  durationMs: number,
): Metrics {
  const minutes = durationMs / 60000;
  const accuracy =
    counts.comparedCharacterCount === 0
      ? 0
      : counts.correctCharacterCount / counts.comparedCharacterCount;
  const grossWpm =
    minutes <= 0 ? 0 : counts.typedCharacterCount / 5 / minutes;
  const netWpm = grossWpm * accuracy;
  return {
    ...counts,
    durationMs,
    grossWpm: round1(grossWpm),
    netWpm: round1(netWpm),
    accuracy: round4(accuracy),
    provisional: durationMs < PROVISIONAL_THRESHOLD_MS,
  };
}

/** Sum counts from several segments (used by multi-segment sessions). */
export function addCounts(a: CharacterCounts, b: CharacterCounts): CharacterCounts {
  return {
    targetCharacterCount: a.targetCharacterCount + b.targetCharacterCount,
    typedCharacterCount: a.typedCharacterCount + b.typedCharacterCount,
    comparedCharacterCount:
      a.comparedCharacterCount + b.comparedCharacterCount,
    correctCharacterCount: a.correctCharacterCount + b.correctCharacterCount,
    errorCount: a.errorCount + b.errorCount,
  };
}

export const EMPTY_COUNTS: CharacterCounts = {
  targetCharacterCount: 0,
  typedCharacterCount: 0,
  comparedCharacterCount: 0,
  correctCharacterCount: 0,
  errorCount: 0,
};

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

function round4(n: number): number {
  return Math.round(n * 10000) / 10000;
}
