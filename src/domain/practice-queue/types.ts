import type { DrillKind } from "../types";

/**
 * Where a piece in the repetition queue came from.
 *
 * T-12 is explicit that this is one mode with several sources, not several
 * modes: `drillMode` builds a session out of `DrillItem[]` and must go on not
 * knowing where they came from. The source is recorded here, next to the
 * piece, so the queue can say what it holds — never so a mode can branch on it.
 *
 * - `bank`      — the edition's own drill bank, the source that already existed.
 * - `deviation` — derived from what this reader actually got wrong (Q-013).
 * - `marked`    — a passage the reader marked while writing.
 */
export type QueueSource = "bank" | "deviation" | "marked";

/**
 * One piece in the repetition queue.
 *
 * The provenance fields are the whole point of the record. A piece is a
 * verbatim fragment of one edition of one work, and it is kept as
 * `workId` + `segmentId` (which survive a new edition) alongside `editionId` +
 * `editionContentHash` (which do not). That pairing is what lets a later
 * edition bump be DETECTED rather than silently written against: the ids say
 * where to look in the new text, and the hash says whether looking is
 * necessary. See `selectForEdition`.
 */
export type QueueItem = {
  id: string;
  workId: string;
  /** The segment the piece was cut from — provenance, and where to re-check it. */
  segmentId: string;
  /** The edition the text was verified verbatim against, and that edition's hash. */
  editionId: string;
  editionContentHash: string;
  kind: DrillKind;
  /** A verbatim fragment of `segmentId` in `editionId`. Never assembled or rewritten. */
  text: string;
  wordCount: number;
  source: QueueSource;
  /** ISO-8601. Ordering is by insertion, so the queue reads as a queue. */
  addedAt: string;
};

/**
 * What `selectForEdition` made of the queue, for one edition.
 *
 * Three outcomes rather than two, because "the edition was re-cut" and "the
 * text is gone" are different facts and the reader is owed the difference:
 *
 * - `items`       — ready to type, verbatim in the edition as it stands now.
 * - `revalidated` — the edition moved under these pieces — re-cut under the
 *   same id, or bumped to a new one — but the text is still there; they carry a
 *   fresh `editionId` and `editionContentHash` and were re-checked, not assumed.
 * - `stale`       — the edition moved and the text did not survive it. Set
 *   aside with a reason, never served.
 *
 * Every piece of this work in the queue lands in exactly one of the three. A
 * fourth outcome — «passed over without a word» — is what the first attempt at
 * this function did to pieces from a previous edition, and it is why it was
 * rejected: a v1 → v2 bump has to be answered, not sidestepped.
 */
export type QueueSelection = {
  items: QueueItem[];
  revalidated: QueueItem[];
  stale: StaleItem[];
};

export type StaleReason = "segment-gone" | "text-gone";

export type StaleItem = {
  item: QueueItem;
  reason: StaleReason;
};

/** The short form, for a line that already lists other facts. */
export function staleLabel(reason: StaleReason): string {
  return reason === "segment-gone" ? "avsnittet er borte" : "teksten er endret";
}
