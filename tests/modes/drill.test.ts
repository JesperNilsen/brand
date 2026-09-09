import { describe, expect, it } from "vitest";
import {
  buildDrillPieces,
  DRILL_ITEM_COUNT,
  DRILL_RECIPE,
  drillMode,
  WORDS_PER_RUN,
} from "@/domain/modes/drill";
import type { PlanInput } from "@/domain/modes/types";
import type { DrillItem, TextEdition, Work } from "@/domain/types";

/** A bank shaped like the real one: more of each kind than a session uses. */
function bank(counts = { quote: 12, phrase: 12, word: 20 }): DrillItem[] {
  const items: DrillItem[] = [];
  let order = 0;
  for (const [kind, n] of Object.entries(counts) as [DrillItem["kind"], number][]) {
    for (let i = 1; i <= n; i += 1) {
      items.push({
        id: `${kind}-${i}`,
        order: order++,
        kind,
        text: `${kind} nummer ${i} med nok tegn til å telle`,
        wordCount: 8,
      });
    }
  }
  return items;
}

const edition: TextEdition = {
  id: "w.training.v1",
  workId: "w",
  kind: "training-edition",
  version: "1.0.0",
  contentHash: "sha256:test",
  languageProfileId: "brand-riksmaal",
  adaptationStatus: "orthography",
  segmentCount: 1,
  wordCount: 3,
  file: "/content/editions/w.training.v1.test.json",
  segments: [{ id: "s1", order: 1, text: "en to tre", wordCount: 3 }],
};

const work: Work = {
  id: "w",
  contentPackId: "p",
  title: "Verk",
  author: "Forfatter",
  languageProfileIds: ["brand-riksmaal"],
  editions: [],
  source: {
    author: "Forfatter",
    title: "Verk",
    language: "nb-NO",
    sourceUrl: "https://example.test",
    archiveId: "test",
    retrievedAt: "2026-09-07",
    provider: "Test",
    license: "Public domain",
    digitalEdition: "Test",
    verificationStatus: "agent-drafted",
  },
} as unknown as Work;

/** `drills` is passed explicitly, including when it is absent: that is a case. */
function input(seed: number, drills: DrillItem[] | undefined): PlanInput {
  return {
    planId: "p1",
    work,
    edition,
    contentPackId: "p",
    languageProfileId: "brand-riksmaal",
    errorMode: "flow",
    textFilterId: "as-printed",
    drills,
    selection: { seed },
  };
}

describe("drill pieces", () => {
  it("draws a full session, in the recipe's shape", () => {
    const pieces = buildDrillPieces(bank(), 1);
    expect(pieces).toHaveLength(DRILL_ITEM_COUNT);
    const labels = pieces.map((p) => p.label);
    expect(labels.filter((l) => l === "Sitat")).toHaveLength(DRILL_RECIPE.quote);
    expect(labels.filter((l) => l === "Setningsdel")).toHaveLength(DRILL_RECIPE.phrase);
    expect(labels.filter((l) => l === "Ord")).toHaveLength(DRILL_RECIPE.wordRun);
    // Ordered from zero, because the runner reads `order`, not array position.
    expect(pieces.map((p) => p.order)).toEqual([...Array(DRILL_ITEM_COUNT).keys()]);
  });

  it("types words in runs, not one at a time", () => {
    const runs = buildDrillPieces(bank(), 2).filter((p) => p.label === "Ord");
    for (const run of runs) {
      expect(run.id.split("+")).toHaveLength(WORDS_PER_RUN);
      expect(run.text.split(" ").length).toBeGreaterThan(WORDS_PER_RUN);
    }
  });

  it("never serves the same item twice in one session", () => {
    // Every id, including the ones inside a run: a session that repeats itself
    // is the whole failure this mode has to avoid.
    const ids = buildDrillPieces(bank(), 3).flatMap((p) => p.id.split("+"));
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("is deterministic in the seed, and only in the seed", () => {
    expect(buildDrillPieces(bank(), 7)).toEqual(buildDrillPieces(bank(), 7));
    expect(buildDrillPieces(bank(), 7)).not.toEqual(buildDrillPieces(bank(), 8));
  });

  it("two consecutive starts differ", () => {
    // The user-visible promise: repeat without repetition. Ten seeds, and no
    // two neighbouring sessions may come out identical.
    const runs = [...Array(10).keys()].map((i) => buildDrillPieces(bank(), 1000 + i));
    for (let i = 1; i < runs.length; i += 1) {
      expect(runs[i].map((p) => p.id)).not.toEqual(runs[i - 1].map((p) => p.id));
    }
  });

  it("fills a session from what a thin bank does have", () => {
    // A bank with no quotes still yields ten pieces rather than six: the
    // recipe is a preference, not a precondition.
    const thin = bank({ quote: 0, phrase: 20, word: 10 });
    expect(buildDrillPieces(thin, 4)).toHaveLength(DRILL_ITEM_COUNT);
  });

  it("gives a short bank everything it has and no more", () => {
    const tiny = bank({ quote: 1, phrase: 1, word: 0 });
    expect(buildDrillPieces(tiny, 5)).toHaveLength(2);
  });
});

describe("drill mode", () => {
  it("plans one edition's pieces with an all-segments end rule", () => {
    const plan = drillMode.buildPlan(input(42, bank()));
    expect(plan.gameModeId).toBe("drill");
    expect(plan.endRule).toEqual({ kind: "all-segments" });
    expect(plan.segments).toHaveLength(DRILL_ITEM_COUNT);
    // One edition per session: the plan can name exactly the text it was cut
    // from, which is what makes a stored result honest.
    expect(plan.workId).toBe("w");
    expect(plan.editionId).toBe(edition.id);
    expect(plan.editionContentHash).toBe(edition.contentHash);
  });

  it("refuses to build a plan without a bank rather than inventing one", () => {
    expect(() => drillMode.buildPlan(input(1, undefined))).toThrow(/no drill bank/);
    expect(() => drillMode.buildPlan(input(1, []))).toThrow(/no drill bank/);
  });

  it("has no chooser, and says so", () => {
    expect(drillMode.hasChooser).toBe(false);
    expect(drillMode.availableInV1).toBe(true);
  });
});
