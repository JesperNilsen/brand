import { describe, expect, it } from "vitest";
import { editionContentHash } from "../../scripts/lib/hash";
import { buildTrainingEdition, serializeEdition } from "../../scripts/lib/build-edition";
import type { Rules } from "../../scripts/lib/rules";

const seg = (id: string, order: number, text: string) => ({ id, order, text });

describe("editionContentHash", () => {
  it("changes when the text a reader would type changes", () => {
    const a = editionContentHash([seg("s1", 1, "Hvor er du?")]);
    const b = editionContentHash([seg("s1", 1, "Hvor er du!")]);
    expect(a).not.toBe(b);
  });

  it("ignores everything that is not id, order or text", () => {
    // A reworded editorial note or a recomputed word count must not move it,
    // or the hash stops meaning "this is the text you typed".
    const bare = editionContentHash([seg("s1", 1, "Hvor er du?")]);
    const decorated = editionContentHash([
      { ...seg("s1", 1, "Hvor er du?"), label: "Første akt", wordCount: 3, difficulty: 2 } as never,
    ]);
    expect(decorated).toBe(bare);
  });

  it("depends on reading order, not on array order", () => {
    const inOrder = [seg("a", 1, "en"), seg("b", 2, "to")];
    const shuffled = [seg("b", 2, "to"), seg("a", 1, "en")];
    expect(editionContentHash(shuffled)).toBe(editionContentHash(inOrder));

    const reordered = [seg("a", 2, "en"), seg("b", 1, "to")];
    expect(editionContentHash(reordered)).not.toBe(editionContentHash(inOrder));
  });

  it("distinguishes the same text under different ids", () => {
    expect(editionContentHash([seg("a", 1, "x")])).not.toBe(
      editionContentHash([seg("b", 1, "x")]),
    );
  });

  it("is stable across calls, which is what makes it storable", () => {
    const s = [seg("s1", 1, "Æ, ø og å — «sitat»")];
    expect(editionContentHash(s)).toBe(editionContentHash(s));
    expect(editionContentHash(s)).toMatch(/^sha256:[0-9a-f]{64}$/);
  });
});

describe("buildTrainingEdition", () => {
  const original = {
    edition: {
      id: "w.original",
      workId: "w",
      contentHash: "sha256:original",
      segments: [seg("s1", 1, "Hvad nu?"), seg("s2", 2, "Nu og nuomstunder")],
    },
  };
  const rules: Rules = {
    editionId: "w.training.v1",
    version: "1.0.0",
    languageProfileId: "brand-riksmaal",
    notes: ["note"],
    replacements: { hvad: "hva", nu: "nå" },
  };

  it("is deterministic: the same inputs serialize to the same bytes", () => {
    const a = serializeEdition(buildTrainingEdition(original, rules).edition);
    const b = serializeEdition(buildTrainingEdition(original, rules).edition);
    expect(a).toBe(b);
  });

  it("records the original it derives from, so drift underneath is visible", () => {
    const built = buildTrainingEdition(original, rules).edition;
    expect(built.basedOnEditionId).toBe("w.original");
    expect(built.basedOnContentHash).toBe("sha256:original");
  });

  it("hashes its own output, not the original's", () => {
    const built = buildTrainingEdition(original, rules).edition as {
      contentHash: string;
      segments: Array<{ id: string; order: number; text: string }>;
    };
    expect(built.contentHash).toBe(editionContentHash(built.segments));
    expect(built.contentHash).not.toBe("sha256:original");
  });

  it("applies the rules it was given and reports unused ones", () => {
    const { edition, unusedReplacements } = buildTrainingEdition(original, {
      ...rules,
      replacements: { ...rules.replacements, xyzzy: "nope" },
    });
    const segments = (edition as { segments: Array<{ text: string }> }).segments;
    expect(segments[0].text).toBe("Hva nå?");
    expect(segments[1].text).toBe("Nå og nuomstunder");
    expect(unusedReplacements).toEqual(["xyzzy"]);
  });
});
