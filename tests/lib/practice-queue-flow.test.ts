import { beforeEach, describe, expect, it } from "vitest";
import { enqueue, type QueueItem } from "@/domain/practice-queue";
import type { DrillItem, TextEdition } from "@/domain/types";
import { MemoryRepository } from "@/infra/repository/MemoryRepository";
import { drillItemsFor } from "@/lib/practice-queue-flow";

const SEGMENT_ONE = "Hei, fremmedkarl, far ei så fort!";
const SEGMENT_TWO = "Veien er bratt og været er hårdt mot fjellet.";

function edition(overrides: Partial<TextEdition> = {}): TextEdition {
  return {
    id: "w.training.v1",
    workId: "w",
    kind: "training-edition",
    version: "1.0.0",
    contentHash: "sha256:first",
    languageProfileId: "brand-riksmaal",
    adaptationStatus: "orthography",
    segmentCount: 2,
    wordCount: 15,
    file: "/content/editions/w.training.v1.first.json",
    segments: [
      { id: "s1", order: 1, text: SEGMENT_ONE, wordCount: 6 },
      { id: "s2", order: 2, text: SEGMENT_TWO, wordCount: 9 },
    ],
    ...overrides,
  };
}

const clock = () => new Date("2026-09-17T10:00:00.000Z");

/** v2 under a new id: s1 re-written, s2 untouched. */
const V2 = edition({
  id: "w.training.v2",
  version: "2.0.0",
  contentHash: "sha256:second",
  segments: [
    { id: "s1", order: 1, text: "Hei, fremmedkarl, gå ei så fort!", wordCount: 6 },
    { id: "s2", order: 2, text: SEGMENT_TWO, wordCount: 9 },
  ],
});

const BANK: DrillItem[] = [
  { id: "d1", order: 0, kind: "quote", text: SEGMENT_ONE, wordCount: 6 },
];

function marked(queue: readonly QueueItem[], text: string, ed: TextEdition, segmentId: string) {
  return enqueue(
    queue,
    { workId: ed.workId, segmentId, kind: "phrase", text, source: "marked" },
    ed,
    clock,
  );
}

describe("drillItemsFor: one mode, three sources", () => {
  let repo: MemoryRepository;

  beforeEach(() => {
    repo = new MemoryRepository();
  });

  it("hands the mode a flat list that says nothing about where a piece came from", async () => {
    await repo.saveQueue(marked([], "været er hårdt", edition(), "s2"));
    const { items } = await drillItemsFor(repo, edition(), BANK);
    expect(items.map((i) => i.text)).toEqual([SEGMENT_ONE, "været er hårdt"]);
    expect(items.map((i) => i.order)).toEqual([0, 1]);
    for (const item of items) {
      expect(Object.keys(item).sort()).toEqual(["id", "kind", "order", "text", "wordCount"]);
    }
  });

  it("gives a reader who has marked nothing exactly the session they had before", async () => {
    const { items, queue, stale } = await drillItemsFor(repo, edition(), BANK);
    expect(items).toEqual(BANK);
    expect(queue).toEqual([]);
    expect(stale).toEqual([]);
  });

  it("writes the re-stamp back, so the bump is answered once and not every session", async () => {
    // A piece cut from v1 whose text still stands in v2. It may be typed — but
    // only re-stamped, and the new stamp has to reach the store or the next
    // session re-opens a question this one has already settled.
    await repo.saveQueue(marked([], "Veien er bratt", edition(), "s2"));
    const { items } = await drillItemsFor(repo, V2, BANK);
    expect(items.map((i) => i.text)).toContain("Veien er bratt");
    expect(await repo.listQueue()).toMatchObject([
      { editionId: "w.training.v2", editionContentHash: "sha256:second" },
    ]);
  });

  it("drops a piece the bump killed from the store, and reports it", async () => {
    await repo.saveQueue(marked([], "far ei så fort", edition(), "s1"));
    const { items, stale } = await drillItemsFor(repo, V2, BANK);
    expect(items).toEqual(BANK);
    expect(stale.map((s) => s.reason)).toEqual(["text-gone"]);
    expect(await repo.listQueue()).toEqual([]);
  });

  it("leaves another work's pieces in the store untouched", async () => {
    const elsewhere = edition({ id: "x.training.v1", workId: "x" });
    await repo.saveQueue(marked([], "far ei så fort", elsewhere, "s1"));
    const { items } = await drillItemsFor(repo, edition(), BANK);
    expect(items).toEqual(BANK);
    expect((await repo.listQueue()).map((q) => q.workId)).toEqual(["x"]);
  });
});
