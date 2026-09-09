import { describe, expect, it } from "vitest";
import { splitIntoModules, splitIntoParts } from "@/components/ChooseView";
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

/**
 * The module splitter, beside the part splitter it does not replace.
 *
 * Q-007's grouping stays exactly as it was for the four works that have parts
 * and no modules; these cases are about the division that carries progress.
 */
describe("splitIntoModules", () => {
  const modules = [
    { id: "dagbog", title: "Forførerens Dagbog", order: 2 },
    { id: "diapsalmata", title: "Diapsalmata", order: 1 },
  ];

  function mseg(id: string, order: number, moduleId: string): TextSegment {
    return { id, order, text: "en to tre", wordCount: 3, moduleId };
  }

  it("orders groups by the modules' own order, not by the array they arrived in", () => {
    const groups = splitIntoModules(
      [mseg("a", 1, "diapsalmata"), mseg("b", 2, "dagbog")],
      modules,
    );
    expect(groups.map((g) => g.id)).toEqual(["diapsalmata", "dagbog"]);
    expect(groups.map((g) => g.title)).toEqual(["Diapsalmata", "Forførerens Dagbog"]);
  });

  it("carries the module id, which is what lets a group be «Skrevet»", () => {
    const groups = splitIntoModules([mseg("a", 1, "diapsalmata")], modules);
    expect(groups[0].id).toBe("diapsalmata");
    // A part has no id, and therefore no completion of its own.
    expect(splitIntoParts([seg("a", 1, "En del")])[0].id).toBeUndefined();
  });

  it("keeps each group's segments in reading order", () => {
    const groups = splitIntoModules(
      [mseg("a", 1, "diapsalmata"), mseg("b", 2, "diapsalmata"), mseg("c", 3, "dagbog")],
      modules,
    );
    expect(groups[0].segments.map((s) => s.id)).toEqual(["a", "b"]);
    expect(groups[1].segments.map((s) => s.id)).toEqual(["c"]);
  });

  it("drops a module no segment belongs to rather than rendering an empty group", () => {
    const groups = splitIntoModules([mseg("a", 1, "diapsalmata")], modules);
    expect(groups).toHaveLength(1);
  });
});
