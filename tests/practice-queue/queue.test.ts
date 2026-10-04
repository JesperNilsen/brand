import { describe, expect, it } from "vitest";
import {
  deriveFromDeviations,
  enqueue,
  NotVerbatimError,
  selectForEdition,
  toDrillItems,
} from "@/domain/practice-queue";
import type { QueueItem } from "@/domain/practice-queue";
import type { TextEdition } from "@/domain/types";

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

function mark(queue: readonly QueueItem[], text: string, ed = edition(), segmentId = "s1") {
  return enqueue(
    queue,
    { workId: ed.workId, segmentId, kind: "phrase", text, source: "marked" },
    ed,
    clock,
  );
}

describe("practice queue: a piece is verbatim or it is not a piece", () => {
  it("takes a passage that stands word for word in the segment", () => {
    const queue = mark([], "far ei så fort");
    expect(queue).toHaveLength(1);
    expect(queue[0]).toMatchObject({
      workId: "w",
      segmentId: "s1",
      editionId: "w.training.v1",
      editionContentHash: "sha256:first",
      text: "far ei så fort",
      source: "marked",
      wordCount: 4,
    });
  });

  // PORTER 2 of the entry: a piece with one word swapped must be refused, and
  // the refusal must come from reading the edition — not from trusting the
  // call site. An implementation that took the caller's word passes every
  // other test in this file and fails this one.
  it("refuses a passage with one word swapped", () => {
    expect(() => mark([], "far ei så langt")).toThrow(NotVerbatimError);
    expect(() => mark([], "far ei så langt")).toThrow(/finnes ikke ordrett/);
  });

  it("refuses a passage that is verbatim in ANOTHER segment", () => {
    // The text exists in the edition, just not where the caller says. Accepting
    // it would put a piece in the queue whose provenance is a lie, and the
    // re-check after an edition bump would then look in the wrong place.
    expect(() => mark([], "Veien er bratt")).toThrow(NotVerbatimError);
    expect(() => mark([], "Veien er bratt", edition(), "s2")).not.toThrow();
  });

  it("refuses a passage assembled from two places in the same segment", () => {
    expect(() => mark([], "Hei, far ei så fort!")).toThrow(NotVerbatimError);
  });

  it("refuses a passage whose segment does not exist", () => {
    expect(() => mark([], "far ei så fort", edition(), "s99")).toThrow(NotVerbatimError);
  });
});

describe("practice queue: one edition per session", () => {
  it("serves on the stamp alone only when id AND hash both stand", () => {
    // The stamp is trusted in exactly one case. Everything else is re-read from
    // the edition, so «tilhører denne utgaven» is decided by the text and not by
    // the record.
    const queue = mark([], "far ei så fort");
    expect(selectForEdition(queue, edition()).items).toEqual(queue);
    expect(selectForEdition(queue, edition({ contentHash: "sha256:second" })).items).toEqual([]);
    expect(selectForEdition(queue, edition({ id: "w.training.v2" })).items).toEqual([]);
  });

  it("stamps everything it serves with THIS edition, whatever it was cut from", () => {
    // Point 4: a session carries one editionId and one editionContentHash. A
    // piece cut from v1 may be typed in a v2 session, but only after it has been
    // re-checked and re-stamped — never while still claiming v1.
    const v1 = edition();
    const v2 = edition({ id: "w.training.v2", contentHash: "sha256:second" });
    const queue = mark([], "far ei så fort", v1);
    const selected = selectForEdition(queue, v2);
    const served = [...selected.items, ...selected.revalidated];
    // Served, not quietly withheld: the text stands in v2, so the piece is the
    // reader's to type. «Ingenting servert» would pass the stamp check below on
    // a technicality.
    expect(served).toHaveLength(1);
    for (const item of served) {
      expect(item.editionId).toBe(v2.id);
      expect(item.editionContentHash).toBe(v2.contentHash);
    }
  });

  it("returns nothing for an edition of another work", () => {
    // The only silence there is. A piece of another work is not waiting for
    // anything: it is re-checked when its own work is the one being typed.
    const queue = mark([], "far ei så fort");
    const elsewhere = edition({ id: "x.training.v1", workId: "x" });
    const selected = selectForEdition(queue, elsewhere);
    expect(selected.items).toHaveLength(0);
    expect(selected.revalidated).toHaveLength(0);
    expect(selected.stale).toHaveLength(0);
  });
});

describe("practice queue: the queue survives an edition bump", () => {
  // PORTER 1 of the entry, in the `edition-drift.ts` form: put a piece in the
  // queue, change the edition under it, and demand that it is never served as
  // though nothing had happened.
  it("sets a piece aside when its text did not survive the new edition", () => {
    const queue = mark([], "far ei så fort");
    const recut = edition({
      contentHash: "sha256:second",
      segments: [
        { id: "s1", order: 1, text: "Hei, fremmedkarl, gå ei så fort!", wordCount: 6 },
        { id: "s2", order: 2, text: SEGMENT_TWO, wordCount: 9 },
      ],
    });
    const selected = selectForEdition(queue, recut);
    expect(selected.items).toHaveLength(0);
    expect(selected.revalidated).toHaveLength(0);
    expect(selected.stale).toEqual([
      { item: queue[0], reason: "text-gone" },
    ]);
    // And the thing that actually matters: it does not reach the session.
    expect(toDrillItems([...selected.items, ...selected.revalidated])).toHaveLength(0);
  });

  it("sets a piece aside when its segment is gone from the new edition", () => {
    const queue = mark([], "far ei så fort");
    const recut = edition({
      contentHash: "sha256:second",
      segments: [{ id: "s2", order: 1, text: SEGMENT_TWO, wordCount: 9 }],
    });
    expect(selectForEdition(queue, recut).stale).toEqual([
      { item: queue[0], reason: "segment-gone" },
    ]);
  });

  it("re-checks rather than assumes when the edition moved but the text stands", () => {
    const queue = mark([], "far ei så fort");
    const recut = edition({
      contentHash: "sha256:second",
      segments: [
        { id: "s1", order: 1, text: SEGMENT_ONE, wordCount: 6 },
        { id: "s2", order: 2, text: "Været er hårdt mot fjellet.", wordCount: 5 },
      ],
    });
    const selected = selectForEdition(queue, recut);
    expect(selected.items).toHaveLength(0);
    expect(selected.stale).toHaveLength(0);
    expect(selected.revalidated).toHaveLength(1);
    // Re-stamped, so the next bump is measured against the text it really
    // matched — not against an edition two versions old.
    expect(selected.revalidated[0].editionContentHash).toBe("sha256:second");
  });

  it("serves a piece untouched while the edition has not moved", () => {
    const queue = mark([], "far ei så fort");
    const selected = selectForEdition(queue, edition());
    expect(selected.items).toEqual(queue);
    expect(selected.revalidated).toHaveLength(0);
  });

  // The real bump: v1 is retired and v2 is published under a NEW id. The first
  // attempt at `selectForEdition` skipped these pieces before it read a word of
  // the text, so the whole gate above measured nothing — the drift it caught was
  // only a re-cut under the same id, which D15 says should not happen.
  describe("and the bump is to a new edition id, not a re-cut", () => {
    const v1 = edition();

    it("re-checks a piece cut from v1 and re-stamps it onto v2", () => {
      const v2 = edition({
        id: "w.training.v2",
        version: "2.0.0",
        contentHash: "sha256:second",
        segments: [
          { id: "s1", order: 1, text: SEGMENT_ONE, wordCount: 6 },
          { id: "s2", order: 2, text: "Været er hårdt mot fjellet.", wordCount: 5 },
        ],
      });
      const queue = mark([], "far ei så fort", v1);
      const selected = selectForEdition(queue, v2);
      expect(selected.items).toHaveLength(0);
      expect(selected.stale).toHaveLength(0);
      expect(selected.revalidated).toHaveLength(1);
      expect(selected.revalidated[0]).toMatchObject({
        editionId: "w.training.v2",
        editionContentHash: "sha256:second",
        text: "far ei så fort",
      });
    });

    it("sets a piece from v1 aside when v2 no longer has its text", () => {
      const v2 = edition({
        id: "w.training.v2",
        version: "2.0.0",
        contentHash: "sha256:second",
        segments: [
          { id: "s1", order: 1, text: "Hei, fremmedkarl, gå ei så fort!", wordCount: 6 },
          { id: "s2", order: 2, text: SEGMENT_TWO, wordCount: 9 },
        ],
      });
      const queue = mark([], "far ei så fort", v1);
      const selected = selectForEdition(queue, v2);
      expect(selected.stale).toEqual([{ item: queue[0], reason: "text-gone" }]);
      expect(toDrillItems([...selected.items, ...selected.revalidated])).toHaveLength(0);
    });

    it("accounts for every piece of the work — none is passed over in silence", () => {
      // The invariant, not a case: whatever the queue holds of this work, each
      // piece is served, re-stamped or set aside. This is what the rejected
      // version failed — its pieces from another edition landed in none of the
      // three and vanished without a word.
      const v2 = edition({
        id: "w.training.v2",
        version: "2.0.0",
        contentHash: "sha256:second",
        segments: [
          { id: "s1", order: 1, text: "Hei, fremmedkarl, gå ei så fort!", wordCount: 6 },
          { id: "s2", order: 2, text: SEGMENT_TWO, wordCount: 9 },
        ],
      });
      let queue = mark([], "far ei så fort", v1); // v1, gone from v2 → stale
      queue = mark(queue, "Veien er bratt", v1, "s2"); // v1, still in v2 → re-stamped
      queue = mark(queue, "været er hårdt", v2, "s2"); // v2 → served
      queue = mark(queue, "far ei så fort", edition({ id: "x.training.v1", workId: "x" }));

      const selected = selectForEdition(queue, v2);
      const seen = [
        ...selected.items.map((i) => i.id),
        ...selected.revalidated.map((i) => i.id),
        ...selected.stale.map((s) => s.item.id),
      ];
      const mine = queue.filter((q) => q.workId === v2.workId).map((q) => q.id);
      expect(seen.sort()).toEqual(mine.sort());
      expect(new Set(seen).size).toBe(seen.length);
    });
  });
});

describe("practice queue: the mode cannot tell the sources apart", () => {
  it("hands drill items that carry no source", () => {
    let queue = mark([], "far ei så fort");
    queue = enqueue(
      queue,
      { workId: "w", segmentId: "s2", kind: "word", text: "fjellet", source: "bank" },
      edition(),
      clock,
    );
    const items = toDrillItems(queue);
    expect(items).toHaveLength(2);
    expect(items.map((i) => i.order)).toEqual([0, 1]);
    for (const item of items) {
      expect(Object.keys(item).sort()).toEqual([
        "id",
        "kind",
        "order",
        "text",
        "wordCount",
      ]);
    }
  });
});

describe("practice queue: pieces derived from the reader's own deviations", () => {
  const measured = {
    misses: [{ expected: "å", typed: "a", count: 9 }],
    opportunities: [{ char: "å", count: 30 }],
  };

  it("derives a word from the edition, verbatim, for a character missed often", () => {
    const queue = deriveFromDeviations([], edition(), measured, 5, clock);
    expect(queue).toHaveLength(1);
    expect(queue[0].source).toBe("deviation");
    expect(queue[0].kind).toBe("word");
    const segment = edition().segments.find((s) => s.id === queue[0].segmentId);
    expect(segment?.text).toContain(queue[0].text);
  });

  it("derives nothing below the opportunity floor — a rate needs a denominator", () => {
    const thin = {
      misses: [{ expected: "å", typed: "a", count: 3 }],
      opportunities: [{ char: "å", count: 4 }],
    };
    expect(deriveFromDeviations([], edition(), thin, 5, clock)).toHaveLength(0);
  });

  it("does not add a word the queue already holds", () => {
    const first = deriveFromDeviations([], edition(), measured, 5, clock);
    const second = deriveFromDeviations(first, edition(), measured, 5, clock);
    expect(second).toHaveLength(first.length);
  });
});
