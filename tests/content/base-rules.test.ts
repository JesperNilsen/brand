import { describe, expect, it } from "vitest";
import { baseOverrides, composeRules, type BaseRules, type Rules } from "../../scripts/lib/rules";
import { brandRiksmaal } from "../../src/domain/language/brand-riksmaal";
import { getBaseRuleSet, requireBaseRuleSet } from "../../src/domain/language/registry";
import { editionMajorVersion } from "../../src/domain/content/registry";

/**
 * D9: the profile owns the orthography every work shares, and a pack lists
 * only what is particular to its own text. The composition is the thing that
 * decides what the user types, so its order and its override rules are tested
 * rather than trusted — a silently reversed precedence would put a rejected
 * form back into a literary text with nothing failing.
 */

function rules(extra: Partial<Rules> = {}): Rules {
  return {
    editionId: "test.training.v2",
    version: "2.0.0",
    languageProfileId: "brand-riksmaal",
    ...extra,
  };
}

const base: BaseRules = {
  replacements: { af: "av", sig: "seg" },
  patterns: [{ from: "aa", to: "å" }],
};

describe("composeRules", () => {
  it("returns the pack untouched when it inherits nothing", () => {
    const pack = rules({ replacements: { hvad: "hva" } });
    expect(composeRules(pack, undefined)).toBe(pack);
  });

  it("inherits base replacements the pack does not mention", () => {
    const composed = composeRules(rules({ replacements: { hvad: "hva" } }), base);
    expect(composed.replacements).toEqual({ af: "av", sig: "seg", hvad: "hva" });
  });

  it("lets the pack win on a key both define", () => {
    const composed = composeRules(rules({ replacements: { sig: "sig" } }), base);
    expect(composed.replacements?.sig).toBe("sig");
  });

  it("runs base patterns before the pack's own", () => {
    const composed = composeRules(
      rules({ patterns: [{ from: "å", to: "aa" }] }),
      base,
    );
    expect(composed.patterns?.map((p) => p.from)).toEqual(["aa", "å"]);
  });

  it("keeps the pack's other fields", () => {
    const composed = composeRules(
      rules({ lowercaseNouns: { properNames: ["Isak"] }, retained: { sprød: "rim" } }),
      base,
    );
    expect(composed.lowercaseNouns?.properNames).toEqual(["Isak"]);
    expect(composed.retained).toEqual({ sprød: "rim" });
  });
});

describe("baseOverrides", () => {
  it("reports a restatement of a base rule as redundant", () => {
    expect(baseOverrides(rules({ replacements: { af: "av" } }), base).redundant).toEqual(["af"]);
  });

  it("reports a contradicting value as diverging, not redundant", () => {
    const { redundant, diverging } = baseOverrides(rules({ replacements: { sig: "sig" } }), base);
    expect(redundant).toEqual([]);
    expect(diverging).toEqual(["sig"]);
  });

  it("ignores keys the base set never mentions", () => {
    expect(baseOverrides(rules({ replacements: { hvad: "hva" } }), base)).toEqual({
      redundant: [],
      diverging: [],
    });
  });
});

describe("brand-riksmaal base rule set", () => {
  it("is reachable by id through the registry", () => {
    expect(requireBaseRuleSet("brand-riksmaal.base.v1").languageProfileId).toBe("brand-riksmaal");
    expect(getBaseRuleSet("nonexistent.base.v9")).toBeUndefined();
  });

  it("is published by the profile it belongs to", () => {
    for (const s of brandRiksmaal.baseRuleSets) {
      expect(s.languageProfileId).toBe(brandRiksmaal.id);
      expect(s.id.startsWith(brandRiksmaal.id)).toBe(true);
    }
  });

  it("carries no rule that undoes another rule in the same set", () => {
    // «nu» → «nå» and a rule producing «nu» would fight over the same word.
    const r = requireBaseRuleSet("brand-riksmaal.base.v1").replacements ?? {};
    for (const [from, to] of Object.entries(r)) {
      expect(r[to], `${from}→${to} is itself rewritten`).toBeUndefined();
    }
  });

  it("never mechanises the profile's preferred forms, which are word choice", () => {
    // LANGUAGE_PROFILE.md forbids changing the author's word choice; «mye» →
    // «meget» would be exactly that, so preferredForms must stay out of here.
    const r = requireBaseRuleSet("brand-riksmaal.base.v1").replacements ?? {};
    for (const rejected of Object.values(brandRiksmaal.preferredForms)) {
      if (rejected === "nu" || rejected === "efter") continue; // orthography, not word choice
      expect(r[rejected], `${rejected} is a word choice, not orthography`).toBeUndefined();
    }
  });
});

describe("editionMajorVersion", () => {
  it("reads the version off an edition id", () => {
    expect(editionMajorVersion("kielland-gift.training.v2")).toBe(2);
    expect(editionMajorVersion("kielland-gift.original")).toBe(0);
  });
});
