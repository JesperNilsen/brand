/**
 * The rights gates, shown to bite.
 *
 * The four fields exist because prose cannot be sorted. The gates exist because
 * a field nobody checks drifts back into prose: a work imported without a death
 * year still reads fine on /om, and a `public-domain` enum over a text still in
 * copyright reads *better* than the truth. Neither is visible without a machine
 * asking.
 *
 * The last case is the one worth the file: an author who died after the cut-off
 * with a public-domain claim and nothing written down. Every one of the 25
 * planned works passes the death-year sort, so the sort alone would never fire
 * — which is exactly why the claim, not the sort, is what is gated.
 */
import { describe, expect, it } from "vitest";
import { adaptationProblems, rightsProblems } from "../../scripts/lib/rights";

const work = { originalLanguage: "da-NO" };
const source = {
  authorDeathYear: 1906,
  license: "Public domain (Kielland d. 1906).",
  rightsStatus: "public-domain",
};

describe("rightsProblems", () => {
  it("accepts a work whose rights metadata is complete and consistent", () => {
    expect(rightsProblems(work, source)).toEqual([]);
  });

  it("fails a work with no authorDeathYear", () => {
    const { authorDeathYear: _drop, ...without } = source;
    const problems = rightsProblems(work, without);
    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain("authorDeathYear mangler");
  });

  it("fails a death year that is a sentence rather than a number", () => {
    const problems = rightsProblems(work, { ...source, authorDeathYear: "1906" });
    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain("må være et helt tall");
  });

  it("fails a work with no originalLanguage", () => {
    const problems = rightsProblems({}, source);
    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain("originalLanguage mangler");
  });

  it("fails an originalLanguage outside the union", () => {
    const problems = rightsProblems({ originalLanguage: "sv-SE" }, source);
    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain("sv-SE");
  });

  it("fails a missing or unknown rightsStatus", () => {
    const { rightsStatus: _drop, ...without } = source;
    expect(rightsProblems(work, without)[0]).toContain("rightsStatus mangler");
    expect(rightsProblems(work, { ...source, rightsStatus: "probably-fine" })[0]).toContain(
      "probably-fine",
    );
  });

  it("fails a public-domain claim over an author who died after 1955", () => {
    const problems = rightsProblems(work, {
      ...source,
      authorDeathYear: 1970,
      rightsStatus: "public-domain",
    });
    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain("døde i 1970");
    expect(problems[0]).toContain("rightsBasis");
  });

  it("fails a verified public-domain claim on the same author, not only the derived one", () => {
    const problems = rightsProblems(work, {
      ...source,
      authorDeathYear: 1970,
      rightsStatus: "public-domain-verified",
    });
    expect(problems).toHaveLength(1);
  });

  it("accepts the same work once the reason is written down", () => {
    expect(
      rightsProblems(work, {
        ...source,
        authorDeathYear: 1970,
        rightsStatus: "public-domain",
        rightsBasis: "Rettighetshaver har frigitt teksten; korrespondanse arkivert 2026-01-04.",
      }),
    ).toEqual([]);
  });

  it("accepts a late author who claims nothing", () => {
    expect(
      rightsProblems(work, { ...source, authorDeathYear: 1970, rightsStatus: "restricted" }),
    ).toEqual([]);
  });

  it("does not require a basis for whitespace alone", () => {
    const problems = rightsProblems(work, {
      ...source,
      authorDeathYear: 1970,
      rightsStatus: "public-domain",
      rightsBasis: "   ",
    });
    expect(problems).toHaveLength(1);
  });
});

describe("adaptationProblems", () => {
  it("accepts a training edition that says what was done to it", () => {
    expect(adaptationProblems("t.v1", { adaptationStatus: "orthography" })).toEqual([]);
  });

  it("fails a training edition with no adaptationStatus", () => {
    const problems = adaptationProblems("t.v1", { languageProfileId: "brand-riksmaal" });
    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain("adaptationStatus mangler");
  });

  it("fails a status outside the union", () => {
    const problems = adaptationProblems("t.v1", { adaptationStatus: "modernised" });
    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain("modernised");
  });
});
