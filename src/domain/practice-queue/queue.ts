import { newId } from "../ids";
import type { DrillItem, DrillKind, TextEdition, TextSegment } from "../types";
import type { QueueItem, QueueSelection, QueueSource, StaleItem } from "./types";

/**
 * A piece was offered to the queue that is not in the edition it claims.
 *
 * Not a programming error to be swallowed: this is the rights boundary. The
 * message names what was offered and where it was looked for, because the only
 * way to fix it is to look at the text.
 */
export class NotVerbatimError extends Error {
  constructor(
    readonly text: string,
    readonly editionId: string,
    readonly segmentId: string,
  ) {
    super(
      `«${text.slice(0, 50)}» finnes ikke ordrett i ${editionId}/${segmentId}. ` +
        `Køen er utledet av utgaven — den kan ikke inneholde tekst utgaven ikke har.`,
    );
    this.name = "NotVerbatimError";
  }
}

/** The segment named, or undefined. */
function segmentOf(edition: TextEdition, segmentId: string): TextSegment | undefined {
  return edition.segments.find((s) => s.id === segmentId);
}

/** The repo's word count, matched to `scripts/lib/drills.ts`'s served items. */
export function countWords(text: string): number {
  return text.split(/\s+/).filter((w) => w.length > 0).length;
}

/**
 * Put a piece in the queue, having proved it is in the edition.
 *
 * **The check is here, in the writer, on purpose.** Q-012 taught this repo the
 * general form of the lesson: an invariant that re-derives a claim from the
 * field the same process wrote is not an invariant. `validate:content` can
 * police the authored banks because they sit beside the edition in the
 * repository; nothing downstream can police a piece a reader marked in their
 * own browser, because the queue is the only place it exists. So the one
 * moment at which the text and the edition are both in hand — this call — is
 * the only moment the rule can be enforced, and it is enforced by reading the
 * edition, not by trusting the caller.
 *
 * Refuses rather than repairs. A piece that is not verbatim cannot be trimmed
 * into one without deciding what the reader meant, and that is exactly the
 * assembling/abbreviating/rewriting the rights rest on not happening.
 */
export function enqueue(
  queue: readonly QueueItem[],
  request: {
    workId: string;
    segmentId: string;
    kind: DrillKind;
    text: string;
    source: QueueSource;
  },
  edition: TextEdition,
  now: () => Date = () => new Date(),
): QueueItem[] {
  const segment = segmentOf(edition, request.segmentId);
  if (!segment) throw new NotVerbatimError(request.text, edition.id, request.segmentId);
  // The rule the whole design rests on — the same `includes` check
  // `scripts/lib/drills.ts` makes of an authored bank, made here of a piece
  // that will never pass through that gate.
  if (!segment.text.includes(request.text)) {
    throw new NotVerbatimError(request.text, edition.id, request.segmentId);
  }
  const item: QueueItem = {
    id: newId("q"),
    workId: request.workId,
    segmentId: request.segmentId,
    editionId: edition.id,
    editionContentHash: edition.contentHash,
    kind: request.kind,
    text: request.text,
    wordCount: countWords(request.text),
    source: request.source,
    addedAt: now().toISOString(),
  };
  return [...queue, item];
}

/**
 * The pieces of this queue that belong to this edition, re-checked against it.
 *
 * Two rules live here.
 *
 * **One edition per session (point 4).** `drill.ts` carries one `editionId` and
 * one `editionContentHash` on the plan, so a session that mixed works could not
 * honestly say which text it was written against. The only thing that is passed
 * over in silence is a piece belonging to ANOTHER WORK: that piece is not this
 * session's text at all, it is not waiting for anything, and it is re-checked
 * the moment its own work is the one being typed. Everything this work holds is
 * accounted for — `items`, `revalidated` or `stale`, never nothing.
 *
 * **An edition bump is detected, never ignored (point 5).** The edition can
 * move under a piece in two ways, and they get the same answer:
 *
 * - re-cut under the same id — the id matches, the hash does not;
 * - bumped to a new id (v1 → v2) — neither matches.
 *
 * Neither is served on the strength of the piece's own stamp: the text is
 * looked for again in the edition as it now stands. Found, the piece is
 * re-stamped with this edition's id AND hash and reported as revalidated; gone,
 * it is set aside as stale with the reason. A piece from a previous edition is
 * therefore never quietly dropped either — dropping it silently was the defect
 * this function was rejected for on 2026-09-18, and it is the same failure as
 * serving it silently: both let the reader's queue lose to an edition bump with
 * nothing said.
 */
export function selectForEdition(
  queue: readonly QueueItem[],
  edition: TextEdition,
): QueueSelection {
  const items: QueueItem[] = [];
  const revalidated: QueueItem[] = [];
  const stale: StaleItem[] = [];

  for (const item of queue) {
    // Another work — not this session's text, and not this call's business.
    if (item.workId !== edition.workId) continue;
    // The one path that serves a piece on its stamp alone: same edition id AND
    // same text hash, which together mean the text has not moved an inch.
    if (item.editionId === edition.id && item.editionContentHash === edition.contentHash) {
      items.push(item);
      continue;
    }
    // Everything else is a bump, whether the id moved or only the hash did, and
    // is answered by reading the edition rather than the record.
    const segment = segmentOf(edition, item.segmentId);
    if (!segment) {
      stale.push({ item, reason: "segment-gone" });
      continue;
    }
    if (!segment.text.includes(item.text)) {
      stale.push({ item, reason: "text-gone" });
      continue;
    }
    // Both stamps, not just the hash: a piece re-stamped with a v1 id and a v2
    // hash would claim an edition that never existed, and the next bump would
    // be measured against it.
    revalidated.push({
      ...item,
      editionId: edition.id,
      editionContentHash: edition.contentHash,
    });
  }

  return { items, revalidated, stale };
}

/**
 * The queue as the drill mode wants it.
 *
 * `order` is assigned here and nowhere else: `DrillItem.order` is what the
 * bank asset hashes over, and a queue piece has no such ordering of its own
 * beyond the order it was added in. Source is deliberately dropped — the mode
 * must not be able to tell a marked passage from a bank quote.
 */
export function toDrillItems(items: readonly QueueItem[], startOrder = 0): DrillItem[] {
  return items.map((item, i) => ({
    id: item.id,
    order: startOrder + i,
    kind: item.kind,
    text: item.text,
    wordCount: item.wordCount,
  }));
}
