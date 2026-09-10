import { describe, expect, it } from "vitest";
import {
  FOCUS_LIMIT,
  MIN_OPPORTUNITIES,
  focusCharacterLabel,
  practiceClasses,
  rankPracticeFocus,
} from "@/domain/engine/practice-focus";
import type { CharacterCount, CharacterMiss } from "@/domain/engine/metrics";

const miss = (expected: string, typed: string, count: number): CharacterMiss => ({
  expected,
  typed,
  count,
});
const opp = (char: string, count: number): CharacterCount => ({ char, count });

describe("rankPracticeFocus (Q-014 point 1 and 2)", () => {
  /**
   * The gate the queue entry names, and the only reason this module is not
   * three lines of sort(). Written so it FAILS against a ranking on raw miss
   * count: by count the order is e (20), aa (6), oe (1); by rate it is aa
   * (0.20), e (0.005), and oe is not shown at all.
   */
  it("ranks on rate, not on count, and withholds anything under the floor", () => {
    const misses = [miss("e", "r", 20), miss("å", "a", 6), miss("ø", "o", 1)];
    const opportunities = [opp("e", 4000), opp("å", 30), opp("ø", 2)];

    const ranked = rankPracticeFocus(misses, opportunities);

    expect(ranked.map((f) => f.expected)).toEqual(["å", "e"]);
    expect(ranked[0].rate).toBeCloseTo(6 / 30);
    expect(ranked[1].rate).toBeCloseTo(20 / 4000);
    // The 20 misses must not buy `e` the top row, and 1-of-2 must not buy `ø`
    // a row at all: 2 is under MIN_OPPORTUNITIES, so 50 % is not a rate yet.
    expect(ranked.find((f) => f.expected === "ø")).toBeUndefined();
    expect(2).toBeLessThan(MIN_OPPORTUNITIES);
  });

  it("sums a target character across the different wrong characters it produced", () => {
    // Split three ways, `æ` would rank as 4/100 rather than 12/100 and fall
    // below `o` — the same weakness counted at a third of its weight.
    const misses = [
      miss("æ", "a", 4),
      miss("æ", "e", 5),
      miss("æ", "ae", 3),
      miss("o", "0", 8),
    ];
    const opportunities = [opp("æ", 100), opp("o", 100)];

    const ranked = rankPracticeFocus(misses, opportunities);

    expect(ranked[0]).toMatchObject({ expected: "æ", misses: 12, opportunities: 100 });
    // What it most often becomes is kept: that is how it goes wrong.
    expect(ranked[0].topTyped).toBe("e");
    expect(ranked[1].expected).toBe("o");
  });

  it("is stable when rates and counts tie, and honours the limit", () => {
    const misses = [miss("b", "v", 5), miss("a", "e", 5), miss("c", "s", 5)];
    const opportunities = [opp("a", 100), opp("b", 100), opp("c", 100)];

    expect(rankPracticeFocus(misses, opportunities).map((f) => f.expected)).toEqual([
      "a",
      "b",
      "c",
    ]);
    expect(rankPracticeFocus(misses, opportunities, 2)).toHaveLength(2);
    expect(FOCUS_LIMIT).toBeGreaterThan(0);
  });

  it("says nothing when a session recorded no misses at all", () => {
    expect(rankPracticeFocus([], [opp("e", 400)])).toEqual([]);
  });

  it("omits a character whose opportunities were never recorded", () => {
    // Defensive: a miss without a matching opportunity would divide by zero
    // and rank Infinity straight to the top.
    const ranked = rankPracticeFocus([miss("q", "g", 3)], []);
    expect(ranked).toEqual([]);
  });
});

describe("practiceClasses (Q-014 point 3)", () => {
  it("sums a class before the floor, so a rare member still counts", () => {
    // No single guillemet clears MIN_OPPORTUNITIES here, and neither does the
    // semicolon — but the class they belong to plainly does. That is what a
    // class is for.
    const misses = [miss("«", "<", 2), miss(";", ",", 3), miss("æ", "a", 4)];
    const opportunities = [opp("«", 6), opp(";", 9), opp("æ", 40), opp("e", 500)];

    const classes = practiceClasses(misses, opportunities);
    const punctuation = classes.find((c) => c.id === "punctuation");
    const nordic = classes.find((c) => c.id === "nordic");

    expect(punctuation).toMatchObject({ misses: 5, opportunities: 15 });
    expect(punctuation!.rate).toBeCloseTo(5 / 15);
    expect(nordic).toMatchObject({ misses: 4, opportunities: 40 });
    // Neither member would survive rankPracticeFocus on its own.
    expect(rankPracticeFocus(misses, opportunities).map((f) => f.expected)).toEqual(["æ"]);
  });

  it("omits a class the text never gave the reader a chance to get wrong", () => {
    const classes = practiceClasses([], [opp("e", 400)]);
    expect(classes).toEqual([]);
  });

  it("counts a class with opportunities but no misses, at rate zero", () => {
    // «Measured, and you got them all» is a real answer, and a different one
    // from «the text had none» above.
    const classes = practiceClasses([], [opp("ø", 30)]);
    expect(classes).toEqual([
      { id: "nordic", label: "Æ, ø og å", misses: 0, opportunities: 30, rate: 0 },
    ]);
  });
});

describe("focusCharacterLabel", () => {
  it("names the characters that have no visible glyph", () => {
    expect(focusCharacterLabel(" ")).toBe("mellomrom");
    expect(focusCharacterLabel("\n")).toBe("linjeskift");
    expect(focusCharacterLabel("æ")).toBe("æ");
  });
});
