import { describe, expect, it } from "vitest";
import type { EndRule, SessionPlan } from "@/domain/modes/types";
import {
  createRunner,
  runnerBackspace,
  runnerInsert,
  runnerPause,
  runnerRemainingMs,
  runnerResume,
  runnerStop,
  runnerTick,
  toSessionResult,
  type RunnerState,
} from "@/domain/session/runner";
import {
  createMeasure,
  finalizeMeasure,
  kogasa,
  measureKeystrokes,
  measurementSeries,
} from "@/domain/session/measure";
import type { ErrorMode, SessionResult, TextSegment } from "@/domain/types";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

/**
 * A local copy of mulberry32, on purpose. The scripts below are reproducible
 * from a seed alone, and they must stay the same scripts when the production
 * PRNG in `src/domain/modes/random.ts` is ever changed for its own reasons.
 */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const WORDS = [
  "og", "det", "er", "ikke", "Brand", "så", "på", "hvad", "jeg", "vil",
  "være", "ånd", "før", "kirken", "Gud", "kræver", "alt", "eller", "intet",
  "fjeldet", "Agnes", "Ejnar", "mod", "lys", "døden", "her", "skal", "du",
  "gå", "op", "mot", "isen", "hjem", "ræd", "barnet", "Alf", "fra", "hvem",
  "trodser", "kaldet", "Fogden", "Doktoren", "nød", "kjærlighed", "viljen",
];
const PUNCTUATION = [",", ".", ";", "!", "?", ":", "–"];
const WRONG = "abcdefghijklmnopqrstuvwxyzæøå ,.";

function randomText(rand: () => number, words: number): string {
  const out: string[] = [];
  for (let i = 0; i < words; i += 1) {
    let word = WORDS[Math.floor(rand() * WORDS.length)];
    if (rand() < 0.15) word += PUNCTUATION[Math.floor(rand() * PUNCTUATION.length)];
    out.push(word);
  }
  return out.join(" ");
}

/** A wrong character: never the expected one. */
function wrongFor(expected: string, rand: () => number): string {
  let ch = expected;
  while (ch === expected) ch = WRONG[Math.floor(rand() * WRONG.length)];
  return ch;
}

function seg(id: string, text: string, order: number): TextSegment {
  return { id, order, text, wordCount: text.split(/\s+/).length };
}

function plan(overrides: Partial<SessionPlan>): SessionPlan {
  return {
    id: "plan1",
    gameModeId: "passage",
    languageProfileId: "brand-riksmaal",
    contentPackId: "pack",
    workId: "work",
    editionId: "edition",
    editionVersion: "1.0.0",
    editionContentHash: "sha256:test",
    errorMode: "flow",
    textFilterId: "as-printed",
    segments: [seg("a", "nå", 1)],
    endRule: { kind: "all-segments" },
    ...overrides,
  };
}

const round1 = (n: number) => Math.round(n * 10) / 10;
const sum = (xs: readonly number[]) => xs.reduce((a, b) => a + b, 0);

function isOpen(s: RunnerState): boolean {
  return s.status === "idle" || s.status === "active" || s.status === "paused";
}

function measured(result: SessionResult) {
  expect(result.measurement).toBeDefined();
  return result.measurement!;
}

// ---------------------------------------------------------------------------
// The property test: seeded multi-segment scripts
// ---------------------------------------------------------------------------

type ScriptOutcome = {
  where: string;
  endRule: EndRule;
  result: SessionResult;
  /** Character keystrokes the script sent while the runner was taking input. */
  sentKeystrokes: number;
  sentWrong: number;
  totalTargetCharacters: number;
};

/**
 * One script, generated on the fly from its seed: what to press depends on
 * where the runner is, so the script and the simulation are the same loop.
 */
function runScript(seed: number, index: number): ScriptOutcome {
  const rand = mulberry32(seed);
  const int = (lo: number, hi: number) => lo + Math.floor(rand() * (hi - lo + 1));

  const errorMode: ErrorMode = rand() < 0.5 ? "flow" : "stop-on-error";
  const ruleRoll = rand();
  const endRule: EndRule =
    ruleRoll < 1 / 3
      ? { kind: "all-segments" }
      : ruleRoll < 2 / 3
        ? { kind: "user-stop" }
        : { kind: "time", limitMs: int(5, 90) * 1000 + int(0, 999) };
  const segments = Array.from({ length: int(1, 5) }, (_, i) =>
    seg(`s${i}`, randomText(rand, int(2, 20)), i + 1),
  );
  const totalTargetCharacters = sum(segments.map((s) => s.text.length));

  let s = createRunner(plan({ segments, errorMode, endRule }));
  let now = 1_000_000 + int(0, 10_000);
  let sentKeystrokes = 0;
  let sentWrong = 0;

  const accepting = () =>
    (s.status === "idle" || s.status === "active") &&
    !(s.startedAt !== null && runnerRemainingMs(s, now) === 0);
  const position = () => s.engine.typedText.length;
  const remaining = () => s.engine.targetText.length - position();
  const expected = () => s.engine.targetText[position()];

  const insert = (text: string, wrong: boolean) => {
    if (accepting()) {
      sentKeystrokes += Math.min(Array.from(text).length, remaining());
      if (wrong) sentWrong += 1;
    }
    s = runnerInsert(s, text, now);
  };

  // The first action is a keystroke, so the clock starts.
  insert(expected(), false);

  const actions = int(10, 250);
  for (let a = 0; a < actions && isOpen(s); a += 1) {
    const roll = rand();
    if (roll < 0.04) {
      if (s.status === "active") {
        s = runnerPause(s, now);
        now += int(0, 60_000);
        s = runnerResume(s, now);
      }
      continue;
    }
    now += int(50, 1500);
    if (roll < 0.07) {
      s = runnerTick(s, now);
    } else if (roll < 0.2) {
      s = runnerBackspace(s, now);
    } else if (roll < 0.3) {
      insert(wrongFor(expected(), rand), true);
    } else if (roll < 0.36) {
      // A composed multi-character insert. When it runs past the end of the
      // segment, the overflow is not a keystroke.
      const n = int(2, 3);
      let text = s.engine.targetText.slice(position(), position() + n);
      if (text.length < n) text += "x";
      insert(text, false);
    } else {
      insert(expected(), false);
    }
  }

  let ending = "closed in the loop";
  if (isOpen(s)) {
    const roll = rand();
    if (endRule.kind === "time" && roll < 0.5) {
      ending = "limit";
      now += endRule.limitMs;
      s = runnerTick(s, now);
    } else if (roll < 0.75) {
      ending = "stop";
      if (s.status === "active" && rand() < 0.3) {
        ending = "stop while paused";
        s = runnerPause(s, now);
        now += int(0, 60_000);
      }
      now += int(0, 1500);
      s = runnerStop(s, now);
    } else {
      ending = "type to the end";
      while (isOpen(s)) {
        now += int(50, 400);
        insert(expected(), false);
      }
    }
  }

  return {
    where: `seed ${seed} script ${index} (${errorMode}, ${endRule.kind}, ${ending})`,
    endRule,
    result: toSessionResult(s, now, `p${index}`),
    sentKeystrokes,
    sentWrong,
    totalTargetCharacters,
  };
}

const BASE_SEEDS = [0x5eed, 0xb4a2d, 20_261_020];
const SCRIPTS_PER_SEED = 80;

describe("measurement: seeded scripts across modes, pauses and endings", () => {
  const outcomes: ScriptOutcome[] = [];
  for (const base of BASE_SEEDS) {
    for (let i = 0; i < SCRIPTS_PER_SEED; i += 1) {
      const index = outcomes.length;
      outcomes.push(runScript((base ^ Math.imul(i + 1, 0x9e3779b9)) >>> 0, index));
    }
  }

  it("covers at least 200 scripts, every end rule and both error modes", () => {
    expect(outcomes.length).toBeGreaterThanOrEqual(200);
    const kinds = new Set(outcomes.map((o) => o.endRule.kind));
    expect([...kinds].sort()).toEqual(["all-segments", "time", "user-stop"]);
    const modes = new Set(outcomes.map((o) => o.result.errorMode));
    expect(modes.size).toBe(2);
  });

  it("ends the series exactly at netWpm, and the buckets add up", () => {
    for (const o of outcomes) {
      const { result, where } = o;
      const m = measured(result);
      const series = measurementSeries(m, result.durationMs);

      expect(m.keystrokes.length, where).toBeLessThanOrEqual(600);
      expect(m.errors.length, where).toBe(m.keystrokes.length);
      expect(m.correct.length, where).toBe(m.keystrokes.length);
      if (result.durationMs > 0) {
        expect(m.keystrokes.length, where).toBe(Math.ceil(result.durationMs / m.bucketMs));
      }

      const last = series.at(-1);
      expect(last, where).toBeDefined();
      expect(last!.t, where).toBe(result.durationMs);
      expect(m.correct.at(-1), where).toBe(result.correctCharacterCount);
      expect(round1(last!.wpm), where).toBe(result.netWpm);

      expect(sum(m.keystrokes), where).toBe(m.keystrokeCount);
      expect(sum(m.errors), where).toBe(m.incorrectKeystrokeCount);
      expect(m.keystrokeCount, where).toBe(o.sentKeystrokes);
      expect(m.incorrectKeystrokeCount, where).toBe(o.sentWrong);
    }
  });

  it("keeps the derived fields inside their definitions", () => {
    for (const o of outcomes) {
      const { result, where } = o;
      const m = measured(result);

      if (o.endRule.kind === "all-segments") {
        expect(m.missedCharacterCount, where).toBe(
          o.totalTargetCharacters - result.typedCharacterCount,
        );
      } else {
        expect(Object.hasOwn(m, "missedCharacterCount"), where).toBe(false);
      }
      if (result.durationMs < 5000) {
        expect(Object.hasOwn(m, "consistency"), where).toBe(false);
      }
      if (m.consistency !== undefined) {
        expect(m.consistency, where).toBeGreaterThanOrEqual(0);
        expect(m.consistency, where).toBeLessThanOrEqual(100);
      }

      const firstTries = sum(m.keys.map((k) => k.firstTries));
      const firstTryCorrect = sum(m.keys.map((k) => k.firstTryCorrect));
      expect(firstTries, where).toBeLessThanOrEqual(m.keystrokeCount);
      expect(firstTryCorrect, where).toBeLessThanOrEqual(firstTries);
      for (const k of m.keys) {
        expect(k.flowCount, where).toBeLessThanOrEqual(k.firstTryCorrect);
        expect(k.flowMsSum, where).toBeLessThanOrEqual(2000 * k.flowCount);
        expect(k.flowMsSum, where).toBeGreaterThanOrEqual(k.flowCount);
      }
      const chars = m.keys.map((k) => k.char);
      expect(chars, where).toEqual([...chars].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0)));
      expect(new Set(chars).size, where).toBe(chars.length);
    }
  });
});

// ---------------------------------------------------------------------------
// Time base and buckets
// ---------------------------------------------------------------------------

describe("measurement: time base", () => {
  it("puts a keystroke after a 30 s pause in the bucket of its active time", () => {
    const start = 50_000;
    let s = createRunner(
      plan({ gameModeId: "nonstop", segments: [seg("a", "abcdefghij", 1)], endRule: { kind: "user-stop" } }),
    );
    // Five keystrokes one second apart, at active 0, 1, 2, 3 and 4 s.
    for (let i = 0; i < 5; i += 1) s = runnerInsert(s, "abcde"[i], start + i * 1000);
    // The pause begins one second after the fifth, at active 5 s, and lasts 30 s.
    s = runnerPause(s, start + 5000);
    s = runnerResume(s, start + 35_000);
    s = runnerInsert(s, "f", start + 35_200);
    s = runnerStop(s, start + 35_200);

    const result = toSessionResult(s, start + 35_200, "pause");
    const m = measured(result);
    expect(result.durationMs).toBe(5200);
    expect(m.bucketMs).toBe(1000);
    expect(m.keystrokes).toHaveLength(Math.ceil(result.durationMs / 1000));
    expect(m.keystrokes).toEqual([2, 1, 1, 1, 0, 1]);
    expect(m.keystrokes[5]).toBe(1);
    // The idle bucket carries the running count forward.
    expect(m.correct).toEqual([2, 3, 4, 5, 5, 6]);
  });

  it("buckets are right-closed and the 600 cap doubles bucketMs", () => {
    const ks = (index: number) => [{ index, expected: "a", typed: "a", accepted: true }];
    let m = createMeasure();
    m = measureKeystrokes(m, ks(0), 0, 0);
    m = measureKeystrokes(m, ks(1), 600_000, 0);
    // t = 600 000 is the end of bucket 599: still fits at 1 000 ms.
    const fits = finalizeMeasure(m, 600_000, { kind: "user-stop" }, 0);
    expect(fits.bucketMs).toBe(1000);
    expect(fits.keystrokes).toHaveLength(600);
    expect(fits.keystrokes.at(-1)).toBe(1);

    // One millisecond later it would be bucket 600, so pairs merge.
    m = measureKeystrokes(m, ks(2), 600_001, 0);
    const merged = finalizeMeasure(m, 600_001, { kind: "user-stop" }, 0);
    expect(merged.bucketMs).toBe(2000);
    expect(merged.keystrokes).toHaveLength(Math.ceil(600_001 / 2000));
    expect(merged.keystrokes[0]).toBe(1);
    expect(merged.keystrokes[299]).toBe(1);
    expect(merged.keystrokes[300]).toBe(1);
    expect(sum(merged.keystrokes)).toBe(3);
    expect(merged.correct.at(-1)).toBe(3);
    // The merged pair keeps the LATER running count.
    expect(merged.correct[0]).toBe(1);
    expect(merged.correct[299]).toBe(2);
  });

  it("finalize pads an idle tail to the session's duration, merging if needed", () => {
    let m = createMeasure();
    m = measureKeystrokes(m, [{ index: 0, expected: "a", typed: "a", accepted: true }], 0, 0);
    const out = finalizeMeasure(m, 700_000, { kind: "user-stop" }, 0);
    expect(out.bucketMs).toBe(2000);
    expect(out.keystrokes).toHaveLength(350);
    expect(out.correct.every((c) => c === 1)).toBe(true);
  });

  it("does not record a keystroke on the time-up path", () => {
    let s = createRunner(
      plan({ gameModeId: "timed", segments: [seg("a", "abcdef", 1)], endRule: { kind: "time", limitMs: 1000 } }),
    );
    s = runnerInsert(s, "a", 0);
    s = runnerInsert(s, "b", 600);
    s = runnerInsert(s, "c", 1200);
    const m = measured(toSessionResult(s, 1200, "t"));
    expect(m.keystrokeCount).toBe(2);
    expect(m.keystrokes).toEqual([2]);
  });

  it("counts a keystroke stop-on-error rejects, as an error", () => {
    let s = createRunner(plan({ segments: [seg("a", "abc", 1)], errorMode: "stop-on-error" }));
    s = runnerInsert(s, "a", 0);
    s = runnerInsert(s, "x", 300); // rejected
    s = runnerInsert(s, "b", 600);
    s = runnerInsert(s, "c", 900);
    const result = toSessionResult(s, 900, "soe");
    const m = measured(result);
    expect(result.typedCharacterCount).toBe(3);
    expect(m.keystrokeCount).toBe(4);
    expect(m.incorrectKeystrokeCount).toBe(1);
    expect(m.keystrokeAccuracy).toBe(0.75);
    expect(m.missedCharacterCount).toBe(0);
  });

  it("backspacing a correct character takes it off the running count", () => {
    let s = createRunner(
      plan({ gameModeId: "nonstop", segments: [seg("a", "abcdef", 1)], endRule: { kind: "user-stop" } }),
    );
    s = runnerInsert(s, "a", 0);
    s = runnerInsert(s, "b", 200);
    s = runnerBackspace(s, 400);
    s = runnerInsert(s, "x", 600); // wrong, accepted in flow
    s = runnerBackspace(s, 800); // removes a wrong one: no change
    s = runnerStop(s, 900);
    const result = toSessionResult(s, 900, "bs");
    const m = measured(result);
    expect(m.correct).toEqual([1]);
    expect(result.correctCharacterCount).toBe(1);
    expect(m.keystrokeCount).toBe(3);
  });
});

// ---------------------------------------------------------------------------
// Consistency (jevnhet)
// ---------------------------------------------------------------------------

describe("measurement: consistency", () => {
  it("kogasa: 0 is perfectly even, c = 1 is about 8.90", () => {
    expect(kogasa(0)).toBe(100);
    // 100 · (1 − tanh(1 + 1/3 + 1/5)) = 100 · (1 − tanh(23/15)) = 8.9007.
    // (The plan wrote ≈ 8.87; that does not follow from the formula.)
    expect(kogasa(1)).toBeCloseTo(8.9007, 4);
    expect(kogasa(0.5)).toBeGreaterThan(kogasa(1));
  });

  it("is 100 for a constant speed over 10 s", () => {
    // Four keystrokes in every right-closed second: 0–1 s holds 0, 250, 500
    // and 750; every later second holds its 250, 500, 750 and 1000.
    const times = [0, 250, 500, 750];
    for (let sec = 1; sec < 10; sec += 1) {
      for (const q of [250, 500, 750, 1000]) times.push(sec * 1000 + q);
    }
    const text = randomText(mulberry32(7), 30);
    expect(text.length).toBeGreaterThan(times.length);
    let s = createRunner(
      plan({ gameModeId: "nonstop", segments: [seg("a", text, 1)], endRule: { kind: "user-stop" } }),
    );
    const start = 10_000;
    for (const t of times) s = runnerInsert(s, s.engine.targetText[s.engine.typedText.length], start + t);
    s = runnerStop(s, start + 10_000);
    const m = measured(toSessionResult(s, start + 10_000, "even"));
    expect(m.consistency).toBe(100);
  });

  it("drops a final partial second under 500 ms and keeps one of 500 ms or more", () => {
    // 4 keystrokes in each of 10 whole seconds, then one more at 10.2 s.
    const times = [0, 250, 500, 750];
    for (let sec = 1; sec < 10; sec += 1) {
      for (const q of [250, 500, 750, 1000]) times.push(sec * 1000 + q);
    }
    times.push(10_200);
    let m = createMeasure();
    times.forEach((t, i) => {
      m = measureKeystrokes(m, [{ index: i, expected: "a", typed: "a", accepted: true }], t, 0);
    });
    expect(finalizeMeasure(m, 10_499, { kind: "user-stop" }, 0).consistency).toBe(100);
    const kept = finalizeMeasure(m, 10_500, { kind: "user-stop" }, 0).consistency;
    expect(kept).toBeLessThan(100);
    // Eleven seconds: ten of 4 and one of 1.
    const counts = [...new Array<number>(10).fill(4), 1];
    const mean = sum(counts) / 11;
    const c = Math.sqrt(sum(counts.map((x) => (x - mean) ** 2)) / 11) / mean;
    expect(kept).toBe(round1(kogasa(c)));
  });

  it("is absent under 5 s", () => {
    let s = createRunner(
      plan({ gameModeId: "nonstop", segments: [seg("a", "abcdefghijkl", 1)], endRule: { kind: "user-stop" } }),
    );
    for (let i = 0; i < 10; i += 1) s = runnerInsert(s, "abcdefghij"[i], i * 400);
    s = runnerStop(s, 4999);
    const m = measured(toSessionResult(s, 4999, "short"));
    expect(Object.hasOwn(m, "consistency")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// «Ikke nådd»
// ---------------------------------------------------------------------------

describe("measurement: missed characters", () => {
  it("is present for all-segments, and counts the rest of the passage", () => {
    let s = createRunner(plan({ segments: [seg("a", "abcde", 1), seg("b", "fghij", 2)] }));
    s = runnerInsert(s, "abcde", 0);
    s = runnerInsert(s, "f", 300);
    s = runnerStop(s, 600);
    const m = measured(toSessionResult(s, 600, "missed"));
    expect(m.missedCharacterCount).toBe(4);
  });

  it("is 0, not absent, for a completed passage", () => {
    let s = createRunner(plan({ segments: [seg("a", "ab", 1)] }));
    s = runnerInsert(s, "a", 0);
    s = runnerInsert(s, "b", 300);
    expect(s.status).toBe("completed");
    expect(measured(toSessionResult(s, 300, "done")).missedCharacterCount).toBe(0);
  });

  it("is absent under a time rule and under user-stop", () => {
    for (const endRule of [{ kind: "time", limitMs: 60_000 }, { kind: "user-stop" }] as EndRule[]) {
      let s = createRunner(plan({ segments: [seg("a", "abcdef", 1)], endRule }));
      s = runnerInsert(s, "a", 0);
      s = runnerStop(s, 500);
      const m = measured(toSessionResult(s, 500, "x"));
      expect(Object.hasOwn(m, "missedCharacterCount")).toBe(false);
    }
  });
});

// ---------------------------------------------------------------------------
// Per key
// ---------------------------------------------------------------------------

describe("measurement: per key", () => {
  function keysOf(steps: [string | null, number][], errorMode: ErrorMode = "flow", text = "abcdefgh") {
    let s = createRunner(
      plan({ gameModeId: "nonstop", segments: [seg("a", text, 1)], endRule: { kind: "user-stop" }, errorMode }),
    );
    let last = 0;
    for (const [input, t] of steps) {
      s = input === null ? runnerBackspace(s, t) : runnerInsert(s, input, t);
      last = t;
    }
    s = runnerStop(s, last);
    const m = measured(toSessionResult(s, last, "k"));
    return Object.fromEntries(m.keys.map((k) => [k.char, k]));
  }

  it("times the interval between consecutive first-try-correct keystrokes", () => {
    const k = keysOf([["a", 0], ["b", 300], ["c", 700]]);
    expect(k.a).toEqual({ char: "a", firstTries: 1, firstTryCorrect: 1, flowMsSum: 0, flowCount: 0 });
    expect(k.b).toEqual({ char: "b", firstTries: 1, firstTryCorrect: 1, flowMsSum: 300, flowCount: 1 });
    expect(k.c).toEqual({ char: "c", firstTries: 1, firstTryCorrect: 1, flowMsSum: 400, flowCount: 1 });
  });

  it("a backspace breaks the chain, and a retyped position is not a first try", () => {
    const k = keysOf([["a", 0], ["b", 300], [null, 500], ["b", 700], ["c", 900], ["d", 1100]]);
    expect(k.b).toMatchObject({ firstTries: 1, firstTryCorrect: 1, flowCount: 1, flowMsSum: 300 });
    // c follows a retyped b, which was not a first try.
    expect(k.c).toMatchObject({ firstTries: 1, firstTryCorrect: 1, flowCount: 0 });
    expect(k.d).toMatchObject({ flowCount: 1, flowMsSum: 200 });
  });

  it("drops intervals over 2 000 ms", () => {
    const k = keysOf([["a", 0], ["b", 2000], ["c", 4001]]);
    expect(k.b).toMatchObject({ flowCount: 1, flowMsSum: 2000 });
    expect(k.c).toMatchObject({ flowCount: 0, flowMsSum: 0 });
  });

  it("a wrong first try in stop-on-error is a first try; the retry is not", () => {
    const k = keysOf([["a", 0], ["x", 200], ["b", 400], ["c", 600]], "stop-on-error");
    expect(k.b).toMatchObject({ firstTries: 1, firstTryCorrect: 0, flowCount: 0 });
    // c follows b's retry, which was not a first try.
    expect(k.c).toMatchObject({ firstTries: 1, firstTryCorrect: 1, flowCount: 0 });
  });

  it("a multi-character insert can only time its first character", () => {
    const k = keysOf([["a", 0], ["bcd", 300], ["e", 500]]);
    expect(k.b).toMatchObject({ flowCount: 1, flowMsSum: 300 });
    expect(k.c).toMatchObject({ firstTryCorrect: 1, flowCount: 0 });
    expect(k.d).toMatchObject({ firstTryCorrect: 1, flowCount: 0 });
    expect(k.e).toMatchObject({ flowCount: 1, flowMsSum: 200 });
  });

  it("counts per EXPECTED character, so a wrong keystroke is charged to the key it missed", () => {
    const k = keysOf([["a", 0], ["x", 300]]);
    expect(k.b).toMatchObject({ firstTries: 1, firstTryCorrect: 0 });
    expect(k.x).toBeUndefined();
  });

  it("every segment has its own first tries", () => {
    let s = createRunner(
      plan({ gameModeId: "nonstop", segments: [seg("a", "ab", 1), seg("b", "ab", 2)], endRule: { kind: "user-stop" } }),
    );
    s = runnerInsert(s, "a", 0);
    s = runnerInsert(s, "b", 200);
    s = runnerInsert(s, "a", 400);
    s = runnerStop(s, 400);
    const m = measured(toSessionResult(s, 400, "segs"));
    expect(m.keys.find((k) => k.char === "a")).toMatchObject({ firstTries: 2, firstTryCorrect: 2 });
  });
});

// ---------------------------------------------------------------------------
// A full hour
// ---------------------------------------------------------------------------

describe("measurement: a 3 600 s Timed run", () => {
  const limitMs = 3_600_000;
  const rand = mulberry32(3600);
  const segments = Array.from({ length: 50 }, (_, i) => seg(`h${i}`, randomText(rand, 110), i + 1));
  let s = createRunner(plan({ gameModeId: "timed", segments, endRule: { kind: "time", limitMs } }));
  let now = 5_000_000;
  const activeTimes: number[] = [];
  const active = () => (s.startedAt === null ? 0 : now - s.startedAt - s.pausedMs);
  let pausedOnce = false;
  while (s.status !== "completed") {
    if (!pausedOnce && active() > 1_800_000) {
      pausedOnce = true;
      s = runnerPause(s, now);
      now += 45_000;
      s = runnerResume(s, now);
    }
    if (activeTimes.length > 0) {
      now += rand() < 0.02 ? 1000 + Math.floor(rand() * 3000) : 120 + Math.floor(rand() * 280);
    }
    if (activeTimes.length > 0 && active() >= limitMs) {
      s = runnerTick(s, now);
      break;
    }
    const expected = s.engine.targetText[s.engine.typedText.length];
    // A typo is a neighbouring letter, the way typos are.
    const typed = rand() < 0.03 ? (expected === "a" ? "s" : "a") : expected;
    activeTimes.push(active());
    s = runnerInsert(s, typed, now);
  }
  const result = toSessionResult(s, now, "hour");

  it("fits in at most 600 buckets of 8 000 ms", () => {
    const m = measured(result);
    expect(result.durationMs).toBe(limitMs);
    expect(m.keystrokes.length).toBeLessThanOrEqual(600);
    expect(m.bucketMs).toBe(8000);
    expect(m.keystrokes).toHaveLength(450);
    expect(sum(m.keystrokes)).toBe(activeTimes.length);
  });

  it("has the consistency of its true 1-second counts, untouched by the merge", () => {
    const seconds = Math.floor(limitMs / 1000);
    const counts = new Array<number>(seconds).fill(0);
    for (const t of activeTimes) counts[Math.max(0, Math.ceil(t / 1000) - 1)] += 1;
    const mean = sum(counts) / seconds;
    const variance = sum(counts.map((c) => (c - mean) ** 2)) / seconds;
    const c = Math.sqrt(variance) / mean;
    const expected = round1(100 * (1 - Math.tanh(c + c ** 3 / 3 + c ** 5 / 5)));
    expect(measured(result).consistency).toBe(expected);
  });

  it("serialises to at most 16 KB", () => {
    const bytes = new TextEncoder().encode(JSON.stringify(result)).length;
    expect(bytes).toBeLessThanOrEqual(16 * 1024);
  });
});
