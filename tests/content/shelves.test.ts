/**
 * Shelves are a curated selection, not an owner. The two things that go wrong
 * silently are a shelf pointing at a work that is gone and a work standing on
 * no shelf at all — the first renders an empty row, the second makes a work
 * that is still in `WORKS` invisible to anyone browsing by shelf. Both are
 * gated here, and both are shown to bite on constructed input.
 *
 * The other half of the point is what must NOT happen: putting a work on a
 * second shelf must not produce a second content entry. That is why the shelf
 * is its own axis, and it is asserted against the real catalogue rather than a
 * fixture, because the day it stops being true it will be true in the fixture.
 */
import { describe, expect, it } from "vitest";
import { shelfProblems } from "../../scripts/lib/shelves";
import { SHELVES, WORKS } from "@/domain/content/catalog.generated";
import { getShelf, listShelves, listShelvesForWork } from "@/domain/content/registry";
import type { Shelf } from "@/domain/types";

function shelf(id: string, workIds: string[]): Shelf {
  return { id, title: `Hylle ${id}`, description: "En hylle.", workIds };
}

describe("shelfProblems", () => {
  it("accepts shelves that cover every work", () => {
    expect(shelfProblems([shelf("a", ["w1"]), shelf("b", ["w2"])], ["w1", "w2"])).toEqual([]);
  });

  it("accepts a work standing on two shelves", () => {
    expect(shelfProblems([shelf("a", ["w1"]), shelf("b", ["w1"])], ["w1"])).toEqual([]);
  });

  it("accepts an empty shelf declared before its first import", () => {
    expect(shelfProblems([shelf("a", ["w1"]), shelf("tom", [])], ["w1"])).toEqual([]);
  });

  it("fails a shelf that names a work the catalogue does not have", () => {
    const problems = shelfProblems([shelf("a", ["w1", "borte"])], ["w1"]);
    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain("borte");
  });

  it("fails a work that stands on no shelf", () => {
    const problems = shelfProblems([shelf("a", ["w1"])], ["w1", "glemt"]);
    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain("glemt");
  });

  it("fails a repeated shelf id and a work listed twice on one shelf", () => {
    const problems = shelfProblems([shelf("a", ["w1", "w1"]), shelf("a", ["w1"])], ["w1"]);
    expect(problems.some((p) => p.includes("hylle-id gjentas"))).toBe(true);
    expect(problems.some((p) => p.includes("to ganger på samme hylle"))).toBe(true);
  });
});

describe("the shelves the catalogue actually ships", () => {
  it("is what content/shelves.json says, with no work left unshelved", () => {
    expect(
      shelfProblems(
        SHELVES,
        WORKS.map((w) => w.id),
      ),
    ).toEqual([]);
  });

  it("does not duplicate a content entry for a work on two shelves", () => {
    const twice = WORKS.filter((w) => listShelvesForWork(w.id).length > 1);
    expect(twice.length).toBeGreaterThan(0);
    // One entry per work id, however many shelves name it.
    expect(new Set(WORKS.map((w) => w.id)).size).toBe(WORKS.length);
    for (const work of twice) {
      expect(WORKS.filter((w) => w.id === work.id)).toHaveLength(1);
    }
  });

  it("hides an empty shelf from the list but still resolves it by id", () => {
    const empty = SHELVES.filter((s) => s.workIds.length === 0);
    expect(empty.length).toBeGreaterThan(0);
    for (const s of empty) {
      expect(listShelves().map((x) => x.id)).not.toContain(s.id);
      expect(getShelf(s.id)).toBeDefined();
    }
  });

  it("keeps the curated order of shelves.json", () => {
    const shown = listShelves().map((s) => s.id);
    const curated = SHELVES.filter((s) => s.workIds.length > 0).map((s) => s.id);
    expect(shown).toEqual(curated);
  });

  it("gives an unknown work no shelves rather than throwing", () => {
    expect(listShelvesForWork("finnes-ikke")).toEqual([]);
  });
});
