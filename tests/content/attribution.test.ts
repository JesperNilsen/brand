/**
 * The attribution the reader meets on the writing surface.
 *
 * Two claims are gated here. First, that a normalised text says it has been
 * normalised — an adapted edition that presents itself as the author's own
 * words is the failure this line exists to prevent, and it is a failure of
 * omission, so nothing else would catch it. Second, that the line names the
 * printed edition AND its year for every work in the catalogue: «Basert på»
 * followed by a source statement with no year in it is an attribution that
 * cannot be checked.
 *
 * That the line is actually rendered on the surface is a separate claim, and a
 * browser is the honest place to make it: see e2e/attribution.spec.ts.
 */
import { describe, expect, it } from "vitest";
import { WORKS } from "@/domain/content/catalog.generated";
import { defaultEdition, getEdition } from "@/domain/content/registry";
import { attributionLine } from "@/lib/session-flow";
import type { TextEditionMeta, Work } from "@/domain/types";

const BRAND_RIKSMAAL = "brand-riksmaal";

function training(work: Work): TextEditionMeta {
  return defaultEdition(work, BRAND_RIKSMAAL);
}

describe("attributionLine", () => {
  it("says a training edition has been adapted, and what it rests on", () => {
    const work = WORKS[0];
    const line = attributionLine(work, training(work));
    expect(line).toContain("Språklig bearbeidet etter Brand-standarden.");
    expect(line).toContain("Basert på");
    expect(line).toContain(work.source.digitalEdition.replace(/\.$/, ""));
  });

  it("does not claim adaptation for an original", () => {
    const work = WORKS[0];
    const original = getEdition(work, "original")!;
    const line = attributionLine(work, original);
    expect(line).not.toContain("bearbeidet");
    expect(line).toContain("Originaltekst, uendret.");
    expect(line).toContain("Basert på");
  });

  it("names a printed edition and a year for every work in the catalogue", () => {
    for (const work of WORKS) {
      const line = attributionLine(work, training(work));
      // A four-digit year, and it has to come from the edition statement
      // rather than from the sentence around it.
      expect(line, work.id).toMatch(/Basert på .*\b(1[6-9]|20)\d{2}\b/);
      expect(line.endsWith("."), work.id).toBe(true);
    }
  });

  it("ends the sentence once when the source statement already ends it", () => {
    const work: Work = {
      ...WORKS[0],
      source: { ...WORKS[0].source, digitalEdition: "En utgave, 1907." },
    };
    expect(attributionLine(work, training(work))).toMatch(/Basert på En utgave, 1907\.$/);
  });

  it("ends the sentence when the source statement does not", () => {
    const work: Work = {
      ...WORKS[0],
      source: { ...WORKS[0].source, digitalEdition: "En utgave, 1907" },
    };
    expect(attributionLine(work, training(work))).toMatch(/Basert på En utgave, 1907\.$/);
  });
});
