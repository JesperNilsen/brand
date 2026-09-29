import { describe, expect, it } from "vitest";
import { enqueue, markPassage, NotVerbatimError, passageAt } from "@/domain/practice-queue";
import type { TextEdition } from "@/domain/types";

const SEGMENT = "Hei, fremmedkarl, far ei så fort! Veien er bratt og været hårdt. Gå hjem.";

const edition: TextEdition = {
  id: "w.training.v1",
  workId: "w",
  kind: "training-edition",
  version: "1.0.0",
  contentHash: "sha256:first",
  languageProfileId: "brand-riksmaal",
  adaptationStatus: "orthography",
  segmentCount: 1,
  wordCount: 14,
  file: "/content/editions/w.training.v1.first.json",
  segments: [{ id: "s1", order: 1, text: SEGMENT, wordCount: 14 }],
};

const clock = () => new Date("2026-09-17T10:00:00.000Z");

describe("passageAt", () => {
  it("returns the sentence the caret stands in, with its terminator", () => {
    expect(passageAt(SEGMENT, 5)).toBe("Hei, fremmedkarl, far ei så fort!");
    expect(passageAt(SEGMENT, 40)).toBe("Veien er bratt og været hårdt.");
  });

  it("returns a slice that is verbatim in the text it came from", () => {
    for (const caret of [0, 5, 20, 33, 40, 64, SEGMENT.length - 1]) {
      const passage = passageAt(SEGMENT, caret);
      if (passage) expect(SEGMENT).toContain(passage);
    }
  });

  it("refuses a sentence too short to be worth practising", () => {
    // «Gå hjem.» is 8 characters, under the phrase floor — and the answer is
    // null, not the neighbouring sentence glued on to make up the length.
    expect(passageAt(SEGMENT, 66)).toBeNull();
  });

  it("does not run past a line break into the next line", () => {
    const verse = "Over de høie fjelde\nser jeg hjemmets røk.";
    expect(passageAt(verse, 3)).toBe("Over de høie fjelde");
    expect(passageAt(verse, 25)).toBe("ser jeg hjemmets røk.");
  });

  it("handles a caret past the end without throwing", () => {
    expect(passageAt(SEGMENT, 9999)).toBe("Gå hjem.".length >= 12 ? "Gå hjem." : null);
    expect(passageAt("", 0)).toBeNull();
  });
});

describe("markPassage", () => {
  it("marks the passage at the caret and stamps its provenance", () => {
    const queue = markPassage([], edition, "s1", 5, clock);
    expect(queue).toHaveLength(1);
    expect(queue![0]).toMatchObject({
      text: "Hei, fremmedkarl, far ei så fort!",
      segmentId: "s1",
      editionId: "w.training.v1",
      editionContentHash: "sha256:first",
      source: "marked",
      kind: "phrase",
    });
  });

  it("marks the same passage only once", () => {
    const first = markPassage([], edition, "s1", 5, clock)!;
    expect(markPassage(first, edition, "s1", 7, clock)).toHaveLength(1);
  });

  it("returns null rather than guessing when the segment is not in the edition", () => {
    expect(markPassage([], edition, "s99", 5, clock)).toBeNull();
  });

  // The reason markPassage reads the edition instead of the typing surface: a
  // filtered surface shows text the edition does not contain, and a piece cut
  // from it is refused by the writer-side gate. This proves the gate would
  // catch it if the rule above were ever broken.
  it("a passage cut from filtered text is refused by the gate", () => {
    // What «no-punctuation» would put on screen. Marking from the surface
    // instead of from the edition would offer exactly this string.
    const fromSurface = "Hei fremmedkarl far ei så fort";
    expect(edition.segments[0].text).not.toContain(fromSurface);
    expect(() =>
      enqueue(
        [],
        { workId: "w", segmentId: "s1", kind: "phrase", text: fromSurface, source: "marked" },
        edition,
        clock,
      ),
    ).toThrow(NotVerbatimError);
  });
});
