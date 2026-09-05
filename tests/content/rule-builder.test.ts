import { describe, expect, it } from "vitest";
import {
  applyLowercaseNouns,
  applyRules,
  isSentenceInitial,
  type Rules,
} from "../../scripts/lib/rules";
import { countWords, isWordToken, matchCase, tokenize } from "../../scripts/lib/text";

/**
 * The builder decides what the user actually types. A wrong rule does not
 * crash anything: it quietly puts a wrong word into a literary text and the
 * only signal is a reader noticing. Phase 4 rewrites the layering around these
 * functions, so this is the net that has to hold while it does.
 */

function rules(extra: Partial<Rules> = {}): Rules {
  return {
    editionId: "test.training.v1",
    version: "1.0.0",
    languageProfileId: "brand-riksmaal",
    ...extra,
  };
}

describe("tokenize", () => {
  it("keeps hyphens and apostrophes inside words but splits on everything else", () => {
    expect(tokenize("is-tjern")).toEqual(["is-tjern"]);
    expect(tokenize("Paris’s")).toEqual(["Paris’s"]);
    expect(tokenize("ja, nei")).toEqual(["ja", ", ", "nei"]);
    expect(tokenize("ord—ord")).toEqual(["ord", "—", "ord"]);
  });

  it("round-trips: joining the tokens reproduces the input exactly", () => {
    for (const s of ["BONDEN (skriger).\nStands, mann!", "Æ, ø og å — «sitat»", "1903-utgaven"]) {
      expect(tokenize(s).join("")).toBe(s);
    }
  });

  it("treats Norwegian letters as word characters", () => {
    expect(tokenize("bræen")).toEqual(["bræen"]);
    expect(isWordToken("ærlig")).toBe(true);
    expect(isWordToken(", ")).toBe(false);
  });
});

describe("matchCase", () => {
  it("carries all-caps, initial caps and lowercase across", () => {
    expect(matchCase("HVAD", "hva")).toBe("HVA");
    expect(matchCase("Hvad", "hva")).toBe("Hva");
    expect(matchCase("hvad", "hva")).toBe("hva");
  });

  it("treats a single uppercase letter as initial caps, not all caps", () => {
    // Both branches match a one-letter word; initial-caps is the safe reading
    // because the replacement may be longer than the source.
    expect(matchCase("A", "aa")).toBe("AA");
  });

  it("leaves the replacement alone when the source has no case", () => {
    expect(matchCase("1903", "1903")).toBe("1903");
  });
});

describe("applyRules — replacements", () => {
  it("substitutes whole words only, never inside a longer word", () => {
    // The invariant that keeps «nuomstunder» intact while «nu» becomes «nå».
    // A naive string replace would produce «nåomstunder» and no test would see it.
    const usage = new Map<string, number>();
    const out = applyRules(
      "nu og nuomstunder og nu",
      rules({ replacements: { nu: "nå" } }),
      usage,
    );
    expect(out).toBe("nå og nuomstunder og nå");
    expect(usage.get("nu")).toBe(2);
  });

  it("preserves the case of the word it replaces", () => {
    const out = applyRules(
      "Hvad, hvad og HVAD",
      rules({ replacements: { hvad: "hva" } }),
      new Map(),
    );
    expect(out).toBe("Hva, hva og HVA");
  });

  it("leaves punctuation, line breaks and unlisted words untouched", () => {
    const src = "BONDEN.\nJa, det var lenge før ifjor; -\nda hendte der så mangt et under;";
    expect(applyRules(src, rules({ replacements: { xyzzy: "nope" } }), new Map())).toBe(src);
  });

  it("applies patterns before replacements, so a pattern can feed one", () => {
    const usage = new Map<string, number>();
    const out = applyRules(
      "Aalbom",
      rules({
        patterns: [{ from: "Aa", to: "Å" }],
        replacements: { ålbom: "Ålbom" },
      }),
      usage,
    );
    expect(out).toBe("Ålbom");
    expect(usage.get("pattern:Aa")).toBe(1);
  });

  it("counts every occurrence, which is what the editorial notes report", () => {
    const usage = new Map<string, number>();
    applyRules("af af af", rules({ replacements: { af: "av" } }), usage);
    expect(usage.get("af")).toBe(3);
  });

  it("is a no-op when the rule set is empty", () => {
    const src = "uendret tekst";
    expect(applyRules(src, rules(), new Map())).toBe(src);
  });
});

describe("isSentenceInitial", () => {
  const t = (s: string) => tokenize(s);

  it("is true for the first word and after a sentence-ending mark", () => {
    const tokens = t("Ja. Nei");
    expect(isSentenceInitial(tokens, 0)).toBe(true);
    expect(isSentenceInitial(tokens, tokens.indexOf("Nei"))).toBe(true);
  });

  it("is true after an opening quote", () => {
    const tokens = t("han sa «Gud");
    expect(isSentenceInitial(tokens, tokens.indexOf("Gud"))).toBe(true);
  });

  it("is false for a word merely following another word", () => {
    const tokens = t("den store Skov");
    expect(isSentenceInitial(tokens, tokens.indexOf("Skov"))).toBe(false);
  });
});

describe("applyLowercaseNouns", () => {
  const none = new Set<string>();

  it("lowercases a capitalised common noun in mid-sentence", () => {
    const usage = new Map<string, number>();
    expect(applyLowercaseNouns("den store Skov var mørk", none, usage)).toBe(
      "den store skov var mørk",
    );
    expect(usage.get("lowercase:Skov")).toBe(1);
  });

  it("never touches a listed proper name", () => {
    expect(applyLowercaseNouns("og Isak gikk", new Set(["Isak"]), new Map())).toBe(
      "og Isak gikk",
    );
  });

  it("leaves the first word of the segment alone", () => {
    expect(applyLowercaseNouns("Skoven var mørk", none, new Map())).toBe("Skoven var mørk");
  });

  it("leaves a word starting a new sentence alone", () => {
    expect(applyLowercaseNouns("Det var sent. Skoven var mørk", none, new Map())).toBe(
      "Det var sent. Skoven var mørk",
    );
  });

  it("leaves an already-lowercase word and non-word tokens alone", () => {
    expect(applyLowercaseNouns("den store skov, 1903", none, new Map())).toBe(
      "den store skov, 1903",
    );
  });

  describe("documented limitations, pinned so a future fix is deliberate", () => {
    it("treats the word after an abbreviation as sentence-initial", () => {
      // "f.eks. Skoven" is mid-sentence, but the period reads as a boundary,
      // so the noun keeps its capital. Wrong, known, and cheap to live with
      // while the corpus is small: it fails safe, leaving the source spelling.
      expect(applyLowercaseNouns("se f.eks. Skoven her", none, new Map())).toBe(
        "se f.eks. Skoven her",
      );
    });

    it("treats a parenthetical dash as a sentence break", () => {
      // Same failure direction: an em dash mid-sentence protects the next
      // noun instead of lowercasing it.
      expect(applyLowercaseNouns("han gikk — Skoven lå stille", none, new Map())).toBe(
        "han gikk — Skoven lå stille",
      );
    });
  });
});

describe("countWords", () => {
  it("counts word-like tokens and ignores bare punctuation", () => {
    expect(countWords("Hvor er du?")).toBe(3);
    expect(countWords("—  !")).toBe(0);
    expect(countWords("")).toBe(0);
    expect(countWords("is-tjern og bræen")).toBe(3);
  });
});
