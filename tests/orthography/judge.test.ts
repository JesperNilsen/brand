import { describe, expect, it } from "vitest";
import {
  explainOrthography,
  explainTranscription,
  judgeOrthography,
  judgeTranscription,
  listOrthographies,
  orthographyItems,
  requireOrthography,
  type OrthographyProfile,
  type WordEntry,
} from "@/domain/orthography";
import { listGameModes } from "@/domain/modes/registry";

/**
 * A fixture norm with every standing a period can give a form. Synthetic on
 * purpose: these tests are about the judge, and a judge test that leaned on
 * the historical data would start failing the day that data is corrected.
 */
const ENTRY: WordEntry = {
  id: "fixture-word",
  lexeme: "fixture",
  forms: [
    { form: "hoved", status: "main" },
    { form: "side", status: "side" },
    { form: "klamme", status: "bracket" },
    { form: "gammel", status: "outside", note: "formen før reformen" },
  ],
  ruleId: "fixture-rule",
};

const FIXTURE: OrthographyProfile = {
  ...requireOrthography("bokmal-1959"),
  id: "fixture-norm",
  displayName: "Prøvenorm",
  ruleset: {
    formStatuses: ["main", "side", "bracket", "outside"],
    rules: [
      {
        id: "fixture-rule",
        kind: "form-status",
        summary: "Prøveregel.",
        sources: [{ sourceId: "sprakradet-bokmal-1900", locator: "—" }],
        confidence: "verified-secondary",
      },
    ],
    words: [ENTRY],
    exampleTexts: [],
  },
};

describe("orthography exercise (rettskrivning)", () => {
  it("accepts a sideform as a sideform, not as the textbook form", () => {
    const v = judgeOrthography(ENTRY, "side");
    expect(v.kind).toBe("accepted");
    if (v.kind !== "accepted") return;
    expect(v.form.status).toBe("side");
    const text = explainOrthography(FIXTURE, v);
    expect(text).toContain("sideform");
    expect(text).not.toContain("obligatorisk");
    expect(text).toContain("«hoved» (hovedform)");
  });

  it("orders the allowed forms by standing, main first", () => {
    const v = judgeOrthography(ENTRY, "gammel");
    expect(v.accepted.map((f) => f.status)).toEqual(["main", "side", "bracket"]);
  });

  it("reports a documented pre-reform form as outside the norm", () => {
    const v = judgeOrthography(ENTRY, "gammel");
    expect(v.kind).toBe("outside");
    expect(explainOrthography(FIXTURE, v)).toContain("formen før reformen");
  });

  it("does not reject a form the sources simply do not name", () => {
    const v = judgeOrthography(ENTRY, "ukjent");
    expect(v.kind).toBe("undocumented");
    expect(explainOrthography(FIXTURE, v)).toContain("kan likevel ha vært tillatt");
  });

  it("ignores case, surrounding space and Unicode composition", () => {
    const entry: WordEntry = { ...ENTRY, forms: [{ form: "hånd", status: "main" }] };
    expect(judgeOrthography(entry, "  Hånd ").kind).toBe("accepted");
    expect(judgeOrthography(entry, "hånd").kind).toBe("accepted");
  });

  it("offers only words with a form to show and a form to accept", () => {
    const items = orthographyItems(FIXTURE);
    expect(items).toHaveLength(1);
    expect(items[0].cue.form).toBe("gammel");
    const onlyAllowed: OrthographyProfile = {
      ...FIXTURE,
      ruleset: { ...FIXTURE.ruleset, words: [{ ...ENTRY, forms: [{ form: "hoved", status: "main" }] }] },
    };
    expect(orthographyItems(onlyAllowed)).toEqual([]);
  });

  it("has a Brandmål exercise built from the standard's documented pairs", () => {
    const cues = orthographyItems(requireOrthography("brandmal-0.1")).map((i) => i.cue.form);
    expect(cues).toEqual(["boka", "jenta", "døra", "kasta", "snakka", "bygga", "husa", "åra"]);
  });

  it("treats a Brandmål stilmarkert form as allowed, never as an error", () => {
    const brandmal = requireOrthography("brandmal-0.1");
    const nu = brandmal.ruleset.words.find((w) => w.id === "brandmal-na")!;
    const v = judgeOrthography(nu, "nu");
    expect(v.kind).toBe("accepted");
    expect(explainOrthography(brandmal, v)).toContain("stilmarkert");
  });
});

describe("transcription (avskrivning)", () => {
  it("every existing mode is transcription, so the norm never changes what is right", () => {
    expect(listGameModes().map((m) => [m.id, m.exerciseKind])).toEqual(
      listGameModes().map((m) => [m.id, "transcription"]),
    );
  });

  it("is exact under every norm: an allowed form is still a deviation from the text", () => {
    for (const o of listOrthographies()) {
      expect(judgeTranscription("etter", "etter", o).kind).toBe("exact");
      expect(judgeTranscription("etter", "efter", o).kind).toBe("differs");
      expect(judgeTranscription("Etter", "etter", o).kind).toBe("differs");
    }
  });

  it("explains, but does not excuse, a form the reader's norm allows", () => {
    const brandmal = requireOrthography("brandmal-0.1");
    const v = judgeTranscription("etter", "efter", brandmal);
    expect(v).toMatchObject({ kind: "differs", allowedInNorm: { form: { form: "efter" } } });
    expect(explainTranscription(brandmal, "etter", v)).toBe(
      "«efter» er foretrukket i Brandmål, men i avskrivning gjengis teksten nøyaktig: «etter».",
    );
  });

  it("says nothing extra when the typed form is not an allowed form of the word", () => {
    const brandmal = requireOrthography("brandmal-0.1");
    const v = judgeTranscription("boken", "boka", brandmal);
    expect(v).toEqual({ kind: "differs" });
    expect(explainTranscription(brandmal, "boken", v)).toBeNull();
  });
});
