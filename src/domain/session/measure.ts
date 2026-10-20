/**
 * Måling: the keystroke-level measurement of a session, accumulated while it
 * is typed and finalised into SessionMeasurement when it ends.
 *
 * Pure functions over an immutable MeasureState, held by the runner on
 * RunnerState so it survives segment boundaries. Every event carries its own
 * ACTIVE time — `runnerElapsedMs` at the event's timestamp — so a pause is
 * excluded the same way it is from durationMs. Nothing here samples on a
 * timer: the 100 ms tick only ends sessions.
 *
 * Definitions are in docs/spec/TYPING_ENGINE.md. In short:
 * - buckets are right-closed: an event at active time t belongs to bucket
 *   max(0, ceil(t / bucketMs) − 1), so the final event at t = durationMs lands
 *   in the last bucket, never one past it;
 * - at most MAX_BUCKETS: when an event would land past the cap, bucketMs
 *   doubles and neighbouring pairs merge;
 * - jevnhet is computed on the true 1-second raw counts, with a running
 *   (Welford) mean and variance kept apart from the buckets, so merging can
 *   never change it.
 */
import type { Keystroke } from "../engine/engine";
import { round1, round4 } from "../engine/metrics";
import type { EndRule } from "../modes/types";
import type { KeyMeasurement, SessionMeasurement } from "../types";

export const INITIAL_BUCKET_MS = 1000;
export const MAX_BUCKETS = 600;
/** Longest interval between first-try-correct keystrokes that counts as speed. */
export const FLOW_MAX_GAP_MS = 2000;
/** Jevnhet says nothing about a session shorter than this. */
export const CONSISTENCY_MIN_DURATION_MS = 5000;
/** A final partial second shorter than this is left out of jevnhet. */
export const PARTIAL_SECOND_MIN_MS = 500;

const SECOND_MS = 1000;

/** Running count, mean and sum of squared deviations (Welford). */
type RunningStats = { n: number; mean: number; m2: number };

type Buckets = {
  bucketMs: number;
  keystrokes: number[];
  errors: number[];
  correct: number[];
};

export type MeasureState = Buckets & {
  /** Characters standing correct right now, in the final-text sense. */
  runningCorrect: number;
  keystrokeCount: number;
  incorrectKeystrokeCount: number;
  /**
   * Jevnhet's own clock, in true seconds, never merged. `second` is the
   * open second and `secondCount` its keystrokes so far; every second before
   * it, idle ones included as 0, is already folded into `closedSeconds`.
   */
  second: number;
  secondCount: number;
  closedSeconds: RunningStats;
  keys: ReadonlyMap<string, KeyMeasurement>;
  /**
   * The first position of the current segment no keystroke has touched yet.
   * A keystroke at or past it is a first try. Segments only advance, so one
   * frontier and the segment it belongs to are enough.
   */
  frontierSegment: number;
  frontier: number;
  /** Active time of the previous keystroke (a backspace counts). */
  lastAtMs: number | null;
  /** Whether the previous keystroke was a first try and correct. */
  lastWasFirstTryCorrect: boolean;
};

export function createMeasure(): MeasureState {
  return {
    bucketMs: INITIAL_BUCKET_MS,
    keystrokes: [],
    errors: [],
    correct: [],
    runningCorrect: 0,
    keystrokeCount: 0,
    incorrectKeystrokeCount: 0,
    second: 0,
    secondCount: 0,
    closedSeconds: { n: 0, mean: 0, m2: 0 },
    keys: new Map(),
    frontierSegment: 0,
    frontier: 0,
    lastAtMs: null,
    lastWasFirstTryCorrect: false,
  };
}

/** Right-closed: (i·size, (i+1)·size] is bucket i, and time 0 is bucket 0. */
function indexAt(t: number, size: number): number {
  return Math.max(0, Math.ceil(t / size) - 1);
}

/** Double bucketMs: sum each pair, and keep the later of the pair's running counts. */
function mergePairs(b: Buckets): Buckets {
  const keystrokes: number[] = [];
  const errors: number[] = [];
  const correct: number[] = [];
  for (let i = 0; i < b.keystrokes.length; i += 2) {
    const later = Math.min(i + 1, b.keystrokes.length - 1);
    keystrokes.push(b.keystrokes[i] + (b.keystrokes[i + 1] ?? 0));
    errors.push(b.errors[i] + (b.errors[i + 1] ?? 0));
    correct.push(b.correct[later]);
  }
  return { bucketMs: b.bucketMs * 2, keystrokes, errors, correct };
}

/** Fresh arrays of at least `length` buckets; new ones are idle and carry `carry`. */
function extendTo(b: Buckets, length: number, carry: number): Buckets {
  const keystrokes = [...b.keystrokes];
  const errors = [...b.errors];
  const correct = [...b.correct];
  while (keystrokes.length < length) {
    keystrokes.push(0);
    errors.push(0);
    correct.push(carry);
  }
  return { bucketMs: b.bucketMs, keystrokes, errors, correct };
}

/**
 * The bucket an event at active time `t` goes to, with the buckets grown (and
 * merged, as often as the cap needs) to hold it. Time never runs backwards
 * here: an event is never placed before the newest bucket, which is what keeps
 * the last `correct` equal to the running count.
 */
function bucketFor(m: Buckets, t: number, carry: number): { b: Buckets; index: number } {
  let b: Buckets = m;
  let index = Math.max(indexAt(t, b.bucketMs), b.keystrokes.length - 1);
  while (index >= MAX_BUCKETS) {
    b = mergePairs(b);
    index = Math.max(indexAt(t, b.bucketMs), b.keystrokes.length - 1);
  }
  return { b: extendTo(b, index + 1, carry), index };
}

function addSample(s: RunningStats, x: number): RunningStats {
  const n = s.n + 1;
  const delta = x - s.mean;
  const mean = s.mean + delta / n;
  return { n, mean, m2: s.m2 + delta * (x - mean) };
}

/** `count` idle seconds at once (Chan's combination with a group of zeros). */
function addZeros(s: RunningStats, count: number): RunningStats {
  if (count <= 0) return s;
  const n = s.n + count;
  const delta = -s.mean;
  return {
    n,
    mean: s.mean + (delta * count) / n,
    m2: s.m2 + (delta * delta * s.n * count) / n,
  };
}

/**
 * Feed the keystrokes of one insert, all at the same active time, typed in
 * segment `segmentIndex` (the segment they were typed in, before the runner
 * advances past it).
 */
export function measureKeystrokes(
  m: MeasureState,
  keystrokes: readonly Keystroke[],
  activeMs: number,
  segmentIndex: number,
): MeasureState {
  if (keystrokes.length === 0) return m;
  const t = Math.max(0, activeMs);
  const { b, index } = bucketFor(m, t, m.runningCorrect);

  let runningCorrect = m.runningCorrect;
  let incorrect = m.incorrectKeystrokeCount;
  let frontier = segmentIndex === m.frontierSegment ? m.frontier : 0;
  let lastAtMs = m.lastAtMs;
  let lastWasFirstTryCorrect = m.lastWasFirstTryCorrect;
  const keys = new Map(m.keys);

  for (const k of keystrokes) {
    const wrong = k.typed !== k.expected;
    b.keystrokes[index] += 1;
    if (wrong) {
      b.errors[index] += 1;
      incorrect += 1;
    } else if (k.accepted) {
      runningCorrect += 1;
    }

    const firstTry = k.index >= frontier;
    const firstTryCorrect = firstTry && !wrong;
    if (firstTry) {
      frontier = k.index + 1;
      const gap = lastAtMs === null ? 0 : t - lastAtMs;
      const flow =
        firstTryCorrect && lastWasFirstTryCorrect && gap > 0 && gap <= FLOW_MAX_GAP_MS;
      const key = keys.get(k.expected);
      keys.set(k.expected, {
        char: k.expected,
        firstTries: (key?.firstTries ?? 0) + 1,
        firstTryCorrect: (key?.firstTryCorrect ?? 0) + (firstTryCorrect ? 1 : 0),
        flowMsSum: (key?.flowMsSum ?? 0) + (flow ? gap : 0),
        flowCount: (key?.flowCount ?? 0) + (flow ? 1 : 0),
      });
    }
    lastAtMs = t;
    lastWasFirstTryCorrect = firstTryCorrect;
  }
  b.correct[index] = runningCorrect;

  let { second, secondCount, closedSeconds } = m;
  const sec = Math.max(indexAt(t, SECOND_MS), second);
  if (sec > second) {
    closedSeconds = addZeros(addSample(closedSeconds, secondCount), sec - second - 1);
    second = sec;
    secondCount = 0;
  }
  secondCount += keystrokes.length;

  return {
    ...m,
    ...b,
    runningCorrect,
    keystrokeCount: m.keystrokeCount + keystrokes.length,
    incorrectKeystrokeCount: incorrect,
    second,
    secondCount,
    closedSeconds,
    keys,
    frontierSegment: segmentIndex,
    frontier,
    lastAtMs,
    lastWasFirstTryCorrect,
  };
}

/**
 * A backspace. It is not a character keystroke — it adds nothing to the
 * counts — but it is the previous keystroke for the next one, so it breaks
 * the chain a speed interval needs. Removing a correct character takes it off
 * the running count.
 */
export function measureBackspace(
  m: MeasureState,
  removedWasCorrect: boolean,
  activeMs: number,
): MeasureState {
  const t = Math.max(0, activeMs);
  const next: MeasureState = { ...m, lastAtMs: t, lastWasFirstTryCorrect: false };
  if (!removedWasCorrect) return next;
  const runningCorrect = m.runningCorrect - 1;
  const { b, index } = bucketFor(m, t, m.runningCorrect);
  b.correct[index] = runningCorrect;
  return { ...next, ...b, runningCorrect };
}

/** Monkeytype's kogasa: 100 · (1 − tanh(c + c³/3 + c⁵/5)), c a coefficient of variation. */
export function kogasa(c: number): number {
  return 100 * (1 - Math.tanh(c + c ** 3 / 3 + c ** 5 / 5));
}

/**
 * Jevnhet over the session's whole seconds, plus the final partial second
 * when it lasted at least PARTIAL_SECOND_MIN_MS. Idle seconds count as 0.
 * One decimal, like WPM.
 */
function consistencyOf(m: MeasureState, durationMs: number): number | undefined {
  if (durationMs < CONSISTENCY_MIN_DURATION_MS) return undefined;
  const whole = Math.floor(durationMs / SECOND_MS);
  const seconds =
    whole + (durationMs - whole * SECOND_MS >= PARTIAL_SECOND_MIN_MS ? 1 : 0);
  let stats = m.closedSeconds;
  // The open second is either inside the session's counted seconds or it is
  // the dropped partial one; every closed second lies before it.
  if (m.second < seconds) {
    stats = addZeros(addSample(stats, m.secondCount), seconds - m.second - 1);
  }
  if (stats.n === 0 || !(stats.mean > 0)) return undefined;
  const c = Math.sqrt(Math.max(0, stats.m2) / stats.n) / stats.mean;
  return round1(kogasa(c));
}

function byChar(a: KeyMeasurement, b: KeyMeasurement): number {
  return a.char < b.char ? -1 : a.char > b.char ? 1 : 0;
}

/**
 * The stored measurement. `durationMs` is the session's own (active time);
 * the buckets are padded with idle ones to exactly ceil(durationMs / bucketMs),
 * merging first if the padding would pass the cap. `untypedCharacterCount` is
 * what the session never reached; it is kept only for an `all-segments` rule.
 */
export function finalizeMeasure(
  m: MeasureState,
  durationMs: number,
  endRule: EndRule,
  untypedCharacterCount: number,
): SessionMeasurement {
  const duration = Math.max(0, durationMs);
  let b: Buckets = m;
  if (duration > 0) {
    const wanted = (size: number, have: number) => Math.max(Math.ceil(duration / size), have);
    while (wanted(b.bucketMs, b.keystrokes.length) > MAX_BUCKETS) b = mergePairs(b);
    b = extendTo(b, wanted(b.bucketMs, b.keystrokes.length), m.runningCorrect);
  } else {
    b = extendTo(b, 0, m.runningCorrect);
  }

  const minutes = duration / 60000;
  const consistency = consistencyOf(m, duration);
  return {
    bucketMs: b.bucketMs,
    keystrokes: b.keystrokes,
    errors: b.errors,
    correct: b.correct,
    keystrokeCount: m.keystrokeCount,
    incorrectKeystrokeCount: m.incorrectKeystrokeCount,
    rawWpm: minutes <= 0 ? 0 : round1(m.keystrokeCount / 5 / minutes),
    keystrokeAccuracy:
      m.keystrokeCount === 0
        ? 0
        : round4((m.keystrokeCount - m.incorrectKeystrokeCount) / m.keystrokeCount),
    ...(consistency === undefined ? {} : { consistency }),
    ...(endRule.kind === "all-segments"
      ? { missedCharacterCount: Math.max(0, untypedCharacterCount) }
      : {}),
    keys: [...m.keys.values()].map((k) => ({ ...k })).sort(byChar),
  };
}

/** One point of the result graph, at the end of a bucket. */
export type MeasurementPoint = {
  /** Active ms from the start; the last point is at durationMs. */
  t: number;
  /** Net WPM so far: correct characters standing at t / 5 / minutes to t. */
  wpm: number;
  /** Raw WPM inside this bucket alone. */
  rawWpm: number;
  errors: number;
};

/**
 * The graph's points. Point i sits at the end of bucket i, clipped to the
 * session's end, so the last one is at durationMs and its wpm is netWpm
 * before rounding. Values are not rounded here.
 */
export function measurementSeries(
  measurement: SessionMeasurement,
  durationMs: number,
): MeasurementPoint[] {
  const size = measurement.bucketMs;
  return measurement.keystrokes.map((keystrokes, i) => {
    const t = Math.min((i + 1) * size, durationMs);
    const span = t - i * size;
    return {
      t,
      wpm: t <= 0 ? 0 : measurement.correct[i] / 5 / (t / 60000),
      rawWpm: span <= 0 ? 0 : keystrokes / 5 / (span / 60000),
      errors: measurement.errors[i],
    };
  });
}
