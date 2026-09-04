import { describe, expect, it } from "vitest";
import {
  applyTextFilter,
  countWords,
  getTextFilter,
  isTextFilterId,
  listTextFilters,
  requireTextFilter,
  stripPunctuation,
  tidyWhitespace,
} from "@/domain/text-filter";
import type { TextSegment } from "@/domain/types";

function seg(id: string, text: string, order = 1): TextSegment {
  return { id, order, text, wordCount: countWords(text) };
}

describe("stripPunctuation", () => {
  it("replaces sentence punctuation and quotation marks with a space", () => {
    expect(stripPunctuation("Hej, fremmedkarl, far ei så fort!")).toBe(
      "Hej  fremmedkarl  far ei så fort ",
    );
    expect(stripPunctuation("Hvor er du? Her!")).toBe("Hvor er du  Her ");
  });

  it("never fuses the words on either side of a separator", () => {
    // The printed editions set em dashes tight against the words they
    // separate. Deleting the dash would produce "ordord".
    expect(stripPunctuation("ord—ord")).toBe("ord ord");
    expect(stripPunctuation("Skjønhed–og–Natur")).toBe("Skjønhed og Natur");
    expect(stripPunctuation("«sitat»tekst")).toBe(" sitat tekst");
    expect(stripPunctuation("ja/nei")).toBe("ja nei");
  });

  it("keeps hyphens and apostrophes inside words, separates them elsewhere", () => {
    expect(stripPunctuation("is-tjern")).toBe("is-tjern");
    expect(stripPunctuation("Paris’s Bærme")).toBe("Paris’s Bærme");
    // ";" and "-" each become a space; the space already between them stays.
    expect(stripPunctuation("En har jo kun det ene liv; -")).toBe(
      "En har jo kun det ene liv   ",
    );
  });

  it("treats every hyphen and apostrophe variant as a joiner", () => {
    expect(stripPunctuation("is\u2010tjern")).toBe("is\u2010tjern");
    expect(stripPunctuation("is\u2011tjern")).toBe("is\u2011tjern");
    expect(stripPunctuation("Paris\u02bcs")).toBe("Paris\u02bcs");
  });

  it("leaves Norwegian letters untouched", () => {
    expect(stripPunctuation("Æ, ø og å — «sitat»")).toBe("Æ  ø og å    sitat ");
  });

  it("removes stage-direction parentheses but keeps their words", () => {
    expect(stripPunctuation("BONDEN (skriger).")).toBe("BONDEN  skriger  ");
  });
});

describe("tidyWhitespace", () => {
  it("collapses space runs, trims lines and drops emptied lines", () => {
    expect(tidyWhitespace("a  b \n\n  c  ")).toBe("a b\nc");
    expect(tidyWhitespace("  ")).toBe("");
  });
});

describe("filters", () => {
  const verse = "BONDEN (skriger).\nStands, mann! Guds bittre -! Her er breen";

  it("as-printed changes nothing", () => {
    const f = requireTextFilter("as-printed");
    expect(f.altersText).toBe(false);
    expect(f.apply(verse)).toBe(verse);
  });

  it("no-punctuation keeps capitals and line breaks", () => {
    const out = requireTextFilter("no-punctuation").apply(verse);
    expect(out).toBe("BONDEN skriger\nStands mann Guds bittre Her er breen");
    expect(out.split("\n")).toHaveLength(2);
  });

  it("words-only lowercases and flattens line breaks to spaces", () => {
    const out = requireTextFilter("words-only").apply(verse);
    expect(out).toBe("bonden skriger stands mann guds bittre her er breen");
    expect(out).not.toContain("\n");
    expect(out).not.toMatch(/ {2,}/);
  });

  it("words-only preserves æøå and intra-word hyphens", () => {
    expect(requireTextFilter("words-only").apply("Is-tjern, Ø og Å!")).toBe(
      "is-tjern ø og å",
    );
  });

  it("words-only separates rather than fuses across tight punctuation", () => {
    expect(requireTextFilter("words-only").apply("ord—ord")).toBe("ord ord");
    expect(requireTextFilter("no-punctuation").apply("Ord—Ord")).toBe("Ord Ord");
  });

  it("registry exposes exactly the three levels and falls back safely", () => {
    expect(listTextFilters().map((f) => f.id)).toEqual([
      "as-printed",
      "no-punctuation",
      "words-only",
    ]);
    expect(getTextFilter("nope")).toBeUndefined();
    expect(requireTextFilter("nope").id).toBe("as-printed");
    expect(isTextFilterId("words-only")).toBe(true);
    expect(isTextFilterId("shouting")).toBe(false);
    expect(isTextFilterId(undefined)).toBe(false);
  });
});

describe("applyTextFilter", () => {
  const segments = [
    seg("a", "Hvor er du?\nHer!", 1),
    seg("b", "Og hvert et veispor har vi tapt.", 2),
  ];

  it("returns the same array for as-printed", () => {
    expect(applyTextFilter(segments, "as-printed")).toBe(segments);
  });

  it("recomputes word counts and preserves ids and order", () => {
    const out = applyTextFilter(segments, "words-only");
    expect(out.map((s) => s.id)).toEqual(["a", "b"]);
    expect(out[0].text).toBe("hvor er du her");
    expect(out[0].wordCount).toBe(4);
    expect(out[1].order).toBe(2);
  });

  it("maps segments 1:1 so a filter can never change which text a plan covers", () => {
    // A dropped segment would push saved Nonstop progress past text the reader
    // never typed, and switching practice form would skip it silently.
    // validate:content forbids such content; this keeps the mapping total.
    const punctuationOnly = [seg("x", "— ! …", 1), seg("y", "ord", 2)];
    const out = applyTextFilter(punctuationOnly, "words-only");
    expect(out.map((s) => s.id)).toEqual(["x", "y"]);
    expect(out[0].text).toBe(punctuationOnly[0].text);
    expect(out[0].wordCount).toBe(punctuationOnly[0].wordCount);
    expect(out[1].text).toBe("ord");
  });

  it("keeps the segment count stable across every filter", () => {
    for (const f of listTextFilters()) {
      expect(applyTextFilter(segments, f.id)).toHaveLength(segments.length);
    }
  });
});

describe("countWords", () => {
  it("counts word-like tokens only", () => {
    expect(countWords("Hvor er du?")).toBe(3);
    expect(countWords("—  !")).toBe(0);
    expect(countWords("")).toBe(0);
  });
});
