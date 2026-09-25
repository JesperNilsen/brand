/**
 * The proposer must list exactly what `lowercaseNouns` would eat: the same
 * sentence-boundary heuristic, the same word tokens, and — when rules are
 * given — the post-pattern form, which is the only form `properNames` can
 * match on.
 */
import { describe, expect, it } from "vitest";
import { proposeProperNames } from "../../scripts/import/propose-proper-names";
import { applyRules, type Rules } from "../../src/domain/language/rules";

const segs = [
  { id: "a-01", text: "Haabet er lysegrønt. „Du støver!“ ropte Fetter Hans til Ole." },
  { id: "a-02", text: "Ole hørte ikke; han saa paa Ylajali og tænkte paa Kristiania." },
  { id: "a-03", text: "„Synes De ikke om at danse?“ Hun saa paa Dem — Ylajali smilte." },
  { id: "a-04", text: "Kristiania. Byen sov, og Ylajali gik hjem til Kristiania." },
];

describe("proposeProperNames", () => {
  const byToken = Object.fromEntries(proposeProperNames(segs).map((c) => [c.token, c]));

  it("excludes sentence-initial words — the rule never touches them", () => {
    // «Haabet», «Ole» (segment start), «Byen» (after a full stop), «Du» and
    // «Synes» (after an opening quote) are all sentence-initial.
    expect(byToken.Haabet).toBeUndefined();
    expect(byToken.Byen).toBeUndefined();
    expect(byToken.Du).toBeUndefined();
    expect(byToken.Synes).toBeUndefined();
  });

  it("lists every capitalised mid-sentence token with its count, most frequent first", () => {
    const order = proposeProperNames(segs).map((c) => `${c.token}:${c.count}`);
    // Ylajali stands mid-sentence in a-02 and a-04. Its third occurrence, in
    // a-03, follows a dash — a sentence boundary to the rule — and is NOT
    // counted, because the rule would not lowercase it either. Kristiania:
    // mid-sentence in a-02 and at the end of a-04; a-04's first is initial.
    expect(order.slice(0, 2)).toEqual(["Kristiania:2", "Ylajali:2"]);
    expect(byToken.Kristiania.count).toBe(2);
    expect(byToken.Fetter.count).toBe(1);
    expect(byToken.Hans.count).toBe(1);
    expect(byToken.Ole.count).toBe(1); // only a-01's «til Ole»
  });

  it("marks the polite forms and what the rules file already has", () => {
    const withAlready = Object.fromEntries(
      proposeProperNames(segs, new Set(["Hans"])).map((c) => [c.token, c]),
    );
    expect(withAlready.De.polite).toBe(true);
    expect(withAlready.Dem.polite).toBe(true);
    expect(withAlready.Hans.already).toBe(true);
    expect(withAlready.Ylajali.already).toBe(false);
  });

  it("keeps a context snippet that shows the token in place", () => {
    expect(byToken.Ylajali.contexts[0]).toMatch(/^\[a-02\] …/);
    expect(byToken.Ylajali.contexts[0]).toContain("‹Ylajali›");
    expect(byToken.Ylajali.contexts).toHaveLength(2);
  });

  it("proposes the post-pattern form when rules are applied first — Gift lists «Håb», not «Haab»", () => {
    const rules: Rules = {
      editionId: "w.training.v1",
      version: "1.0.0",
      languageProfileId: "brand-riksmaal",
      patterns: [{ from: "aa", to: "å" }, { from: "Aa", to: "Å" }],
      replacements: {},
    } as Rules;
    const rewritten = [{ id: "b-01", text: "Han saa paa Haabet og paa Aalesund og paa Aase." }].map((s) => ({
      id: s.id,
      text: applyRules(s.text, rules, new Map()),
    }));
    const tokens = proposeProperNames(rewritten).map((c) => c.token);
    expect(tokens).toContain("Håbet");
    expect(tokens).toContain("Ålesund");
    expect(tokens).toContain("Åse");
    expect(tokens).not.toContain("Haabet");
  });
});
