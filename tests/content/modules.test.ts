/**
 * The module invariants, shown to bite.
 *
 * A module id reaches the progress key, which is what separates these checks
 * from the ones on `part`. A mistyped part makes an extra heading; a mistyped
 * module id files a reader's place under a module that does not exist, and
 * nothing inside the app can see it happen — the record writes, the record
 * reads back, and it never matches what the chooser asks for.
 *
 * The all-or-nothing case is the one that would otherwise look harmless: a
 * half-modularised edition keys some segments with a module element and others
 * without, which is two keying schemes for one work.
 */
import { describe, expect, it } from "vitest";
import { moduleProblems } from "../../scripts/lib/modules";
import { WORKS } from "@/domain/content/catalog.generated";

const modules = [
  { id: "diapsalmata", title: "Diapsalmata", order: 1 },
  { id: "dagbog", title: "Forførerens Dagbog", order: 2 },
];
const segments = [
  { id: "s1", moduleId: "diapsalmata" },
  { id: "s2", moduleId: "diapsalmata" },
  { id: "s3", moduleId: "dagbog" },
];

describe("moduleProblems", () => {
  it("accepts an edition whose modules and segments agree", () => {
    expect(moduleProblems("e", modules, segments)).toEqual([]);
  });

  it("says nothing about an edition with no modules and no moduleId", () => {
    expect(moduleProblems("e", undefined, [{ id: "s1" }, { id: "s2" }])).toEqual([]);
  });

  it("fails a segment naming a module the edition does not declare", () => {
    const problems = moduleProblems("e", modules, [
      ...segments,
      { id: "s4", moduleId: "eller" },
    ]);
    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain("«eller» er ikke en erklært modul");
  });

  it("fails a half-modularised edition", () => {
    const problems = moduleProblems("e", modules, [...segments, { id: "s4" }]);
    expect(problems.some((p) => p.includes("enten alle eller ingen"))).toBe(true);
  });

  it("fails a moduleId on an edition that declares no modules", () => {
    const problems = moduleProblems("e", undefined, [{ id: "s1", moduleId: "diapsalmata" }]);
    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain("erklærer ingen modules");
  });

  it("fails a module that comes back after another one", () => {
    const problems = moduleProblems("e", modules, [
      { id: "s1", moduleId: "diapsalmata" },
      { id: "s2", moduleId: "dagbog" },
      { id: "s3", moduleId: "diapsalmata" },
    ]);
    expect(problems.some((p) => p.includes("må være sammenhengende"))).toBe(true);
  });

  it("fails a repeated module id and a repeated order", () => {
    const problems = moduleProblems(
      "e",
      [
        { id: "diapsalmata", title: "A", order: 1 },
        { id: "diapsalmata", title: "B", order: 1 },
      ],
      [{ id: "s1", moduleId: "diapsalmata" }],
    );
    expect(problems.some((p) => p.includes("id gjentas"))).toBe(true);
    expect(problems.some((p) => p.includes("order 1 gjentas"))).toBe(true);
  });

  it("fails a gap in the module order", () => {
    const problems = moduleProblems(
      "e",
      [
        { id: "a", title: "A", order: 1 },
        { id: "b", title: "B", order: 3 },
      ],
      [
        { id: "s1", moduleId: "a" },
        { id: "s2", moduleId: "b" },
      ],
    );
    expect(problems.some((p) => p.includes("mangler 2"))).toBe(true);
  });

  it("fails a declared module no segment belongs to", () => {
    const problems = moduleProblems(
      "e",
      [...modules, { id: "eller", title: "Eller", order: 3 }],
      segments,
    );
    expect(problems.some((p) => p.includes("«eller» har ingen segmenter"))).toBe(true);
  });

  it("fails a module without a title", () => {
    const problems = moduleProblems("e", [{ id: "a", title: "  ", order: 1 }], [
      { id: "s1", moduleId: "a" },
    ]);
    expect(problems.some((p) => p.includes("mangler tittel"))).toBe(true);
  });
});

describe("the catalogue as it ships", () => {
  it("declares no modules on any work, and is unchanged by their existence", () => {
    // Half the gate for Q-011: the four works that exist today come out the
    // other side identical. The day one of them gains modules, this is the
    // test that says so out loud.
    for (const work of WORKS) {
      for (const edition of work.editions) {
        expect(edition.modules, `${edition.id}`).toBeUndefined();
      }
    }
  });
});
