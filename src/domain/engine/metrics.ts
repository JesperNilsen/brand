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

/** One kind of mistyping: this target character came out as that one. */
export type CharacterMiss = {
  expected: string;
  typed: string;
  count: number;
};

/** How many times one character appeared in the target text(s) counted. */
export type CharacterCount = {
  char: string;
  count: number;
};

export type CharacterDeviations = {
  misses: CharacterMiss[];
  opportunities: CharacterCount[];
};

export const EMPTY_DEVIATIONS: CharacterDeviations = {
  misses: [],
  opportunities: [],
};

/**
 * Character-level deviations (Q-013/T-02), walked over exactly the same
 * `compared` prefix as countCharacters() above — the positions the session
 * actually reached, bounded by target length. Not a new mechanism: this is
 * that same position-by-position loop, extended to record which target
 * character it was and what came out instead, rather than only whether it
 * matched.
 *
 * `targetText`/`typedText` are expected already in their `normalizeText()`
 * form here, the same form the engine itself compares on (both are
 * normalised once, in engine.ts, before any position is ever compared) — so
 * this does not normalise again.
 *
 * The `\u0000` separating the two halves of a miss key is deliberate, and is
 * deliberately written as an escape rather than as the character itself. It
 * keeps pairs from colliding ("a" + "bc" must not key the same as "ab" + "c"),
 * and NUL is the one character a target text can never contain.
 *
 * It was first embedded as a raw byte, and that made git classify this whole
 * file as BINARY — `git diff` printed "Bin 2872 -> 5941 bytes" instead of a
 * diff, so the loop below merged without review ever being shown it. Keep the
 * escape; `.gitattributes` now forces a textual diff as a second line of
 * defence.
 */
export function countCharacterDeviations(
  targetText: string,
  typedText: string,
): CharacterDeviations {
  const compared = Math.min(typedText.length, targetText.length);
  const missCounts = new Map<string, CharacterMiss>();
  const opportunityCounts = new Map<string, CharacterCount>();

  for (let i = 0; i < compared; i += 1) {
    const expected = targetText[i];
    const typed = typedText[i];

    const opportunity = opportunityCounts.get(expected);
    if (opportunity) {
      opportunity.count += 1;
    } else {
      opportunityCounts.set(expected, { char: expected, count: 1 });
    }

    if (typed === expected) continue;
    const key = `${expected}\u0000${typed}`;
    const miss = missCounts.get(key);
    if (miss) {
      miss.count += 1;
    } else {
      missCounts.set(key, { expected, typed, count: 1 });
    }
  }

  return {
    misses: [...missCounts.values()],
    opportunities: [...opportunityCounts.values()],
  };
}

/** Sum deviations from several segments (used by multi-segment sessions). */
export function addDeviations(
  a: CharacterDeviations,
  b: CharacterDeviations,
): CharacterDeviations {
  const missCounts = new Map<string, CharacterMiss>();
  for (const miss of [...a.misses, ...b.misses]) {
    const key = `${miss.expected}\u0000${miss.typed}`;
    const existing = missCounts.get(key);
    missCounts.set(key, existing
      ? { ...existing, count: existing.count + miss.count }
      : { ...miss });
  }
  const opportunityCounts = new Map<string, CharacterCount>();
  for (const opportunity of [...a.opportunities, ...b.opportunities]) {
    const existing = opportunityCounts.get(opportunity.char);
    opportunityCounts.set(opportunity.char, existing
      ? { ...existing, count: existing.count + opportunity.count }
      : { ...opportunity });
  }
  return {
    misses: [...missCounts.values()],
    opportunities: [...opportunityCounts.values()],
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

/** One decimal: how WPM is stored. */
export function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

/** Four decimals: how a 0..1 ratio such as accuracy is stored. */
export function round4(n: number): number {
  return Math.round(n * 10000) / 10000;
}
