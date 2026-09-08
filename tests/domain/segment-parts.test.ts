import { describe, expect, it } from "vitest";
import { splitIntoParts } from "@/components/ChooseView";
import type { TextSegment } from "@/domain/types";

function seg(id: string, order: number, part?: string): TextSegment {
  return { id, order, text: "en to tre", wordCount: 3, part };
}

describe("splitIntoParts", () => {
  it("gives a work without parts one unnamed group", () => {
    const parts = splitIntoParts([seg("a", 1), seg("b", 2)]);
    expect(parts).toHaveLength(1);
    expect(parts[0].title).toBeUndefined();
    expect(parts[0].segments.map((s) => s.id)).toEqual(["a", "b"]);
  });

  it("splits where the part changes, keeping reading order", () => {
    const parts = splitIntoParts([
      seg("h1", 1, "Haabet er lysegrønt"),
      seg("h2", 2, "Haabet er lysegrønt"),
      seg("v1", 3, "Visne Blade"),
    ]);
    expect(parts.map((p) => p.title)).toEqual(["Haabet er lysegrønt", "Visne Blade"]);
    expect(parts.map((p) => p.segments.length)).toEqual([2, 1]);
  });

  it("carries the offset each group starts at", () => {
    // The offset is what numbers an unlabelled segment: «Utdrag 3» must mean
    // the third of the work, not the first of its group.
    const parts = splitIntoParts([seg("a", 1, "En"), seg("b", 2, "To"), seg("c", 3, "To")]);
    expect(parts.map((p) => p.offset)).toEqual([0, 1]);
  });

  it("does not merge a part that comes back after another", () => {
    // validate:content fails such a pack, so this can only arrive from a build
    // that skipped the gate — and splitting it honestly shows two groups with
    // one name rather than silently reordering the reading.
    const parts = splitIntoParts([seg("a", 1, "En"), seg("b", 2, "To"), seg("c", 3, "En")]);
    expect(parts.map((p) => p.title)).toEqual(["En", "To", "En"]);
  });
});
