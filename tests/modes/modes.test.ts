import { describe, expect, it } from "vitest";
import { buildTimedStream, timedMode } from "@/domain/modes/timed";
import { nonstopMode } from "@/domain/modes/nonstop";
import { passageMode } from "@/domain/modes/passage";
import { listGameModes, requireGameMode } from "@/domain/modes/registry";
import type { PlanInput } from "@/domain/modes/types";
import type { TextEdition, TextSegment, Work } from "@/domain/types";

function seg(id: string, text: string, order: number): TextSegment {
  return { id, order, text, wordCount: text.split(/\s+/).length };
}

const edition: TextEdition = {
  id: "w.training.v1",
  workId: "w",
  kind: "training-edition",
  version: "1",
  languageProfileId: "brand-riksmaal",
  segments: [seg("s3", "tre", 3), seg("s1", "en", 1), seg("s2", "to", 2)],
};

const work: Work = {
  id: "w",
  contentPackId: "p",
  author: "A",
  title: "T",
  editions: [edition],
  source: {
    author: "A",
    title: "T",
    language: "nb",
    sourceUrl: "https://example.org",
    retrievedAt: "2026-09-04",
    provider: "test",
    license: "public domain",
    digitalEdition: "test",
    verificationStatus: "agent-drafted",
  },
};

function input(selection: PlanInput["selection"]): PlanInput {
  return {
    planId: "plan",
    work,
    edition,
    contentPackId: "p",
    languageProfileId: "brand-riksmaal",
    errorMode: "flow",
    textFilterId: "as-printed",
    selection,
  };
}

describe("registry", () => {
  it("exposes exactly the three V1 modes", () => {
    expect(listGameModes().map((m) => m.id).sort()).toEqual([
      "nonstop",
      "passage",
      "timed",
    ]);
    expect(() => requireGameMode("markdown")).toThrow();
  });
});

describe("passage", () => {
  it("plans a single chosen segment", () => {
    const p = passageMode.buildPlan(input({ segmentId: "s2" }));
    expect(p.segments.map((s) => s.id)).toEqual(["s2"]);
    expect(p.endRule).toEqual({ kind: "all-segments" });
    expect(p.editionId).toBe("w.training.v1");
  });
  it("throws for an unknown segment", () => {
    expect(() => passageMode.buildPlan(input({ segmentId: "nope" }))).toThrow();
  });
});

describe("nonstop", () => {
  it("orders segments by `order` and resumes from the start segment", () => {
    const p = nonstopMode.buildPlan(input({ startSegmentId: "s2" }));
    expect(p.segments.map((s) => s.id)).toEqual(["s2", "s3"]);
    expect(p.endRule).toEqual({ kind: "user-stop" });
  });
  it("starts from the beginning when no start segment is given", () => {
    const p = nonstopMode.buildPlan(input({}));
    expect(p.segments.map((s) => s.id)).toEqual(["s1", "s2", "s3"]);
  });
});

describe("timed", () => {
  it("builds a stream long enough for the limit with no immediate repetition", () => {
    const stream = buildTimedStream(edition.segments, 120_000, 42);
    const chars = stream.reduce((n, s) => n + s.text.length + 1, 0);
    expect(chars).toBeGreaterThanOrEqual(1500);
    for (let i = 1; i < stream.length; i += 1) {
      expect(stream[i].id).not.toBe(stream[i - 1].id);
    }
  });
  it("is deterministic for a given seed", () => {
    const a = buildTimedStream(edition.segments, 60_000, 7).map((s) => s.id);
    const b = buildTimedStream(edition.segments, 60_000, 7).map((s) => s.id);
    expect(a).toEqual(b);
  });
  it("uses the given limit as end rule", () => {
    const p = timedMode.buildPlan(input({ limitMs: 60_000, seed: 1 }));
    expect(p.endRule).toEqual({ kind: "time", limitMs: 60_000 });
    expect(p.segments.length).toBeGreaterThan(1);
  });
});
