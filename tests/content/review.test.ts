/**
 * The review file is the one place a human's judgement enters the pipeline, so
 * the checks on it are about contradiction rather than absence: a review that
 * names an edition that does not exist, or certifies a hash the edition does
 * not have, is worse than no review at all — it looks like an assurance.
 */
import { describe, expect, it } from "vitest";
import { publishedReviewFields, reviewProblems, type ReviewFile } from "../../scripts/lib/review";

const editions = [
  { id: "p.original", kind: "original", contentHash: "sha256:aaa" },
  { id: "p.training.v1", kind: "training-edition", contentHash: "sha256:bbb" },
];

function problems(reviews: ReviewFile): string[] {
  return reviewProblems("p", reviews, editions);
}

describe("reviewProblems", () => {
  it("accepts a complete review of a real edition", () => {
    expect(
      problems({
        "p.training.v1": {
          reviewStatus: "reviewed",
          reviewedContentHash: "sha256:bbb",
          reviewedBy: "Jesper Nilsen",
          reviewedAt: "2026-09-07",
        },
      }),
    ).toEqual([]);
  });

  it("says nothing about editions with no entry at all", () => {
    expect(problems({})).toEqual([]);
  });

  it("rejects a review of an edition that is not in the pack", () => {
    expect(problems({ "p.training.v9": { reviewStatus: "reviewed" } })[0]).toMatch(/no such edition/);
  });

  it("rejects a review of an original", () => {
    expect(problems({ "p.original": { reviewStatus: "reviewed" } })[0]).toMatch(
      /only a training edition/,
    );
  });

  it("catches a certified hash that no longer matches — a published edition was edited in place", () => {
    const found = problems({
      "p.training.v1": {
        reviewStatus: "reviewed",
        reviewedContentHash: "sha256:old",
        reviewedBy: "J",
        reviewedAt: "2026-09-07",
      },
    });
    expect(found.join("\n")).toMatch(/edited its rules in place/);
  });

  it("refuses a review that names neither a reader nor a date nor a hash", () => {
    const found = problems({ "p.training.v1": { reviewStatus: "reviewed" } }).join("\n");
    expect(found).toMatch(/reviewedBy is missing/);
    expect(found).toMatch(/reviewedAt is missing/);
    expect(found).toMatch(/reviewedContentHash is missing/);
  });

  it("requires an ISO date", () => {
    const found = problems({
      "p.training.v1": {
        reviewStatus: "reviewed",
        reviewedContentHash: "sha256:bbb",
        reviewedBy: "J",
        reviewedAt: "7. september 2026",
      },
    }).join("\n");
    expect(found).toMatch(/YYYY-MM-DD/);
  });

  it("rejects an unknown status", () => {
    expect(
      problems({ "p.training.v1": { reviewStatus: "godkjent" as never } })[0],
    ).toMatch(/reviewStatus must be one of/);
  });

  it("allows a review still in progress without demanding a reader or date", () => {
    expect(problems({ "p.training.v1": { reviewStatus: "in-review" } })).toEqual([]);
  });
});

describe("publishedReviewFields", () => {
  it("publishes only what the app shows, never the hash or the private notes", () => {
    expect(
      publishedReviewFields({
        reviewStatus: "reviewed",
        reviewedContentHash: "sha256:bbb",
        reviewedBy: "Jesper Nilsen",
        reviewedAt: "2026-09-07",
        notes: ["internt"],
      }),
    ).toEqual({
      reviewStatus: "reviewed",
      reviewedBy: "Jesper Nilsen",
      reviewedAt: "2026-09-07",
    });
  });

  it("adds nothing at all for an edition with no review", () => {
    expect(publishedReviewFields(undefined)).toEqual({});
  });
});
