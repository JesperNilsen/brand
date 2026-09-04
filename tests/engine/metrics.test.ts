import { describe, expect, it } from "vitest";
import {
  addCounts,
  computeMetrics,
  countCharacters,
  EMPTY_COUNTS,
} from "@/domain/engine/metrics";

describe("countCharacters", () => {
  it("bounds compared characters by target length and counts matches", () => {
    const c = countCharacters("frem", "frxm", 1);
    expect(c.comparedCharacterCount).toBe(4);
    expect(c.correctCharacterCount).toBe(3);
    expect(c.typedCharacterCount).toBe(4);
    expect(c.targetCharacterCount).toBe(4);
    expect(c.errorCount).toBe(1);
  });

  it("handles partial input", () => {
    const c = countCharacters("boken", "bo", 0);
    expect(c.comparedCharacterCount).toBe(2);
    expect(c.correctCharacterCount).toBe(2);
  });
});

describe("computeMetrics", () => {
  it("applies the spec formulas", () => {
    // 60 chars in 60 s: gross = 60/5/1 = 12 wpm; accuracy 0.9 → net 10.8
    const counts = {
      targetCharacterCount: 60,
      typedCharacterCount: 60,
      comparedCharacterCount: 60,
      correctCharacterCount: 54,
      errorCount: 6,
    };
    const m = computeMetrics(counts, 60_000);
    expect(m.grossWpm).toBe(12);
    expect(m.accuracy).toBe(0.9);
    expect(m.netWpm).toBe(10.8);
    expect(m.provisional).toBe(false);
  });

  it("flags sessions under five seconds as provisional and avoids divide-by-zero", () => {
    const m = computeMetrics(countCharacters("nå", "nå", 0), 0);
    expect(m.grossWpm).toBe(0);
    expect(m.provisional).toBe(true);
    const m2 = computeMetrics(countCharacters("nå", "nå", 0), 4999);
    expect(m2.provisional).toBe(true);
    expect(m2.grossWpm).toBeGreaterThan(0);
  });

  it("adds counts across segments", () => {
    const a = countCharacters("ab", "ab", 0);
    const b = countCharacters("cd", "cx", 1);
    const sum = addCounts(addCounts(EMPTY_COUNTS, a), b);
    expect(sum.comparedCharacterCount).toBe(4);
    expect(sum.correctCharacterCount).toBe(3);
    expect(sum.errorCount).toBe(1);
  });
});
