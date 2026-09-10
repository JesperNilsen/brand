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

/**
 * The works that declare modules today.
 *
 * Q-011 shipped the machinery with the catalogue deliberately empty of it, and
 * the test here asserted that emptiness — a tripwire meant to fire the day a
 * work gained modules. hamsun-sult fired it. This list is what replaced it:
 * modules change how a reader's place is keyed, so a work that gains them is
 * named here or the test says so out loud, exactly as before.
 */
const MODULE_BEARING = ["hamsun-sult"];

describe("the catalogue as it ships", () => {
  it("declares modules on exactly the works meant to have them", () => {
    const bearing = WORKS.filter((w) => w.editions.some((e) => e.modules?.length)).map((w) => w.id);
    expect([...bearing].sort()).toEqual([...MODULE_BEARING].sort());
  });

  it("declares every module set well-formed: unique ids, titles, order 1..N", () => {
    // Only what the shipped catalogue carries. The segment-level rules —
    // all-or-nothing, contiguity, a moduleId resolving to a declared module —
    // need the segments, which live in the edition files rather than in WORKS,
    // and `validate:content` already runs moduleProblems over them
    // (scripts/validate-content.ts:307 for originals, :429 for training
    // editions). Duplicating them here would be a second gate on the same
    // invariant that could drift from the first.
    for (const work of WORKS) {
      for (const edition of work.editions) {
        if (!edition.modules) continue;
        const at = edition.id;
        const ids = edition.modules.map((m) => m.id);
        expect(new Set(ids).size, `${at}: en modul-id gjentas`).toBe(ids.length);
        for (const m of edition.modules) {
          expect(m.title.trim(), `${at}: modul «${m.id}» mangler tittel`).not.toBe("");
        }
        expect(
          edition.modules.map((m) => m.order).sort((a, b) => a - b),
          `${at}: modulrekkefølgen må være 1..${edition.modules.length}`,
        ).toEqual(edition.modules.map((_, i) => i + 1));
      }
    }
  });
});
