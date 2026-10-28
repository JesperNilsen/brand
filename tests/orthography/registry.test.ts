import { describe, expect, it } from "vitest";
import {
  formKey,
  getOrthographySource,
  isAccepted,
  listOrthographies,
  listWritingLanguages,
  requireOrthography,
  type SourceRef,
} from "@/domain/orthography";
import { ORTHOGRAPHY_SOURCES } from "@/domain/orthography/sources";

/**
 * The gate on the norm data. It is what makes «ingen udokumenterte regler
 * presenteres som sikre» checkable: a rule without a source, a form with a
 * status its period did not have, or a source id nobody can look up fails
 * here, however plausible the rule looks.
 */

const BOKMAL_IDS = [
  ["bokmal-current", "Moderne bokmål"],
  ["bokmal-1907", "Riksmål 1907"],
  ["bokmal-1917", "Riksmål 1917"],
  ["bokmal-1938", "Bokmål 1938"],
  ["bokmal-1959", "Bokmål 1959"],
  ["bokmal-1981", "Bokmål 1981"],
  ["bokmal-2005", "Bokmål 2005"],
] as const;

function allRefs(): { where: string; ref: SourceRef }[] {
  const out: { where: string; ref: SourceRef }[] = [];
  for (const o of listOrthographies()) {
    o.sources.forEach((ref) => out.push({ where: o.id, ref }));
    for (const r of o.ruleset.rules) r.sources.forEach((ref) => out.push({ where: `${o.id}/${r.id}`, ref }));
    for (const w of o.ruleset.words) (w.sources ?? []).forEach((ref) => out.push({ where: `${o.id}/${w.id}`, ref }));
    for (const t of o.ruleset.exampleTexts) out.push({ where: `${o.id}/example`, ref: t.source });
  }
  return out;
}

describe("language list", () => {
  it("is Brandmål and Bokmål, in that order, with no historical norm in it", () => {
    expect(listWritingLanguages().map((l) => l.displayName)).toEqual(["Brandmål", "Bokmål"]);
  });

  it("offers the seven bokmål norms with their historical names, modern bokmål by default", () => {
    const bokmal = listWritingLanguages().find((l) => l.id === "bokmal")!;
    expect(bokmal.defaultOrthographyId).toBe("bokmal-current");
    expect(bokmal.orthographyIds.map((id) => [id, requireOrthography(id).displayName])).toEqual(
      BOKMAL_IDS.map(([id, name]) => [id, name]),
    );
  });

  it("names the pre-1929 norms riksmål and the later ones bokmål", () => {
    for (const [id, name] of BOKMAL_IDS) {
      const from = requireOrthography(id).historicalPeriod.from;
      if (from < 1929) expect(name).toMatch(/^Riksmål/);
      else expect(name).not.toMatch(/^Riksmål/);
    }
  });

  it("keeps Brandmål a language of its own that inherits nothing from bokmål", () => {
    const brandmal = requireOrthography("brandmal-0.1");
    expect(brandmal.languageId).toBe("brandmal");
    expect(brandmal.officialStatus).toBe("house");
    const bokmalRuleIds = new Set(
      listOrthographies("bokmal").flatMap((o) => o.ruleset.rules.map((r) => r.id)),
    );
    for (const w of brandmal.ruleset.words) expect(bokmalRuleIds.has(w.ruleId)).toBe(false);
    for (const ref of brandmal.ruleset.rules.flatMap((r) => r.sources)) {
      expect(getOrthographySource(ref.sourceId)?.kind).toBe("house");
    }
  });

  it("links Brandmål, and only Brandmål, to the editions readers type", () => {
    const linked = listOrthographies().filter((o) => o.editionProfileId);
    expect(linked.map((o) => [o.id, o.editionProfileId])).toEqual([["brandmal-0.1", "brand-riksmaal"]]);
  });
});

describe("norm metadata", () => {
  it("has exactly one current norm per language", () => {
    for (const l of listWritingLanguages()) {
      const current = l.orthographyIds.filter((id) => requireOrthography(id).isCurrent);
      expect(current, l.id).toHaveLength(1);
    }
  });

  it("never presents a historical norm as current official spelling", () => {
    for (const o of listOrthographies()) {
      if (o.officialStatus === "current-official") expect(o.isCurrent, o.id).toBe(true);
      if (!o.isCurrent) expect(o.officialStatus, o.id).not.toBe("current-official");
      if (o.historicalPeriod.to !== undefined) expect(o.isCurrent, o.id).toBe(false);
    }
  });

  it("marks implementation status by what is actually there", () => {
    for (const o of listOrthographies()) {
      const hasRules = o.ruleset.rules.length > 0;
      expect(o.implementationStatus, o.id).toBe(hasRules ? "partial" : "metadata-only");
    }
  });

  it("uses hovedform/sideform only where the period had them", () => {
    for (const o of listOrthographies("bokmal")) {
      const ranked = o.ruleset.formStatuses.some((s) => s === "main" || s === "side");
      const year = o.historicalPeriod.from;
      // 1938 introduced the distinction; 2005 abolished it.
      expect(ranked, o.id).toBe(year >= 1938 && year < 2005);
    }
  });
});

describe("rules and word forms", () => {
  it("cite only sources that exist, each with a locator", () => {
    for (const { where, ref } of allRefs()) {
      expect(getOrthographySource(ref.sourceId), `${where} cites ${ref.sourceId}`).toBeDefined();
      expect(ref.locator.trim(), where).not.toBe("");
    }
  });

  it("give every rule at least one source", () => {
    for (const o of listOrthographies())
      for (const r of o.ruleset.rules) expect(r.sources.length, `${o.id}/${r.id}`).toBeGreaterThan(0);
  });

  it("tie every word to a rule of the same norm", () => {
    for (const o of listOrthographies()) {
      const ids = new Set(o.ruleset.rules.map((r) => r.id));
      for (const w of o.ruleset.words) expect(ids.has(w.ruleId), `${o.id}/${w.id}`).toBe(true);
    }
  });

  it("give forms only the statuses their norm uses, and at least one allowed form", () => {
    for (const o of listOrthographies()) {
      for (const w of o.ruleset.words) {
        for (const f of w.forms) {
          expect(o.ruleset.formStatuses, `${o.id}/${w.id}/${f.form}`).toContain(f.status);
        }
        expect(w.forms.some((f) => isAccepted(f.status)), `${o.id}/${w.id}`).toBe(true);
      }
    }
  });

  it("list no form twice in one entry, and no id twice in one norm", () => {
    for (const o of listOrthographies()) {
      const ids = [...o.ruleset.rules.map((r) => r.id), ...o.ruleset.words.map((w) => w.id)];
      expect(new Set(ids).size, o.id).toBe(ids.length);
      for (const w of o.ruleset.words) {
        const keys = w.forms.map((f) => formKey(f.form));
        expect(new Set(keys).size, `${o.id}/${w.id}`).toBe(keys.length);
      }
    }
  });

  it("have unique, https-addressed sources", () => {
    const ids = ORTHOGRAPHY_SOURCES.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const s of ORTHOGRAPHY_SOURCES) expect(s.url, s.id).toMatch(/^https:\/\//);
  });
});
