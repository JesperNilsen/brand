import type { TextEdition } from "../types";
import { enqueue } from "./queue";
import type { QueueItem } from "./types";

/** The floor `scripts/lib/drills.ts` puts under an authored `phrase` item. */
const MIN_PASSAGE_LENGTH = 12;

/** Where one sentence ends and the next begins. */
const BOUNDARY = new Set([".", "!", "?", "…", ";", ":", "\n"]);

/**
 * The sentence the caret is standing in, as a verbatim slice of `text`.
 *
 * A slice, and only ever a slice — the whole design rests on a marked piece
 * being text the edition actually has, so this may narrow the range it returns
 * but may never join two of them or rewrite what is between them. Trimming
 * whitespace off the ends is the one liberty taken, and it shortens a
 * contiguous run rather than changing it.
 *
 * Returns null when the sentence is too short to be worth practising, rather
 * than reaching outward for neighbouring text to pad it with.
 */
export function passageAt(text: string, caret: number): string | null {
  if (text.length === 0) return null;
  const at = Math.max(0, Math.min(caret, text.length - 1));

  let start = at;
  while (start > 0 && !BOUNDARY.has(text[start - 1])) start -= 1;

  let end = at;
  while (end < text.length && !BOUNDARY.has(text[end])) end += 1;
  // The terminator belongs to the sentence it ends, the way the authored bank
  // cuts its quotes.
  if (end < text.length && text[end] !== "\n") end += 1;

  const passage = text.slice(start, end).trim();
  return passage.length >= MIN_PASSAGE_LENGTH ? passage : null;
}

/**
 * Mark the passage the caret is in, and put it in the queue.
 *
 * **The text is read from the edition, never from the typing surface.** What
 * the surface shows has already been through a text filter — «no-punctuation»
 * and «words-only» rewrite the text the reader types against — so a piece cut
 * from the screen would be a piece the edition does not contain, and the
 * verbatim rule would refuse it at best and be quietly broken at worst. The
 * caller passes the segment id; the original text comes from here.
 */
export function markPassage(
  queue: readonly QueueItem[],
  edition: TextEdition,
  segmentId: string,
  caret: number,
  now: () => Date = () => new Date(),
): QueueItem[] | null {
  const segment = edition.segments.find((s) => s.id === segmentId);
  if (!segment) return null;
  const text = passageAt(segment.text, caret);
  if (!text) return null;
  // Keyed on the WORK, not the edition: a piece cut from v1 that has not yet
  // been re-stamped by `selectForEdition` is the same passage of the same work,
  // and marking it again under v2 would put it in the queue twice.
  if (queue.some((q) => q.workId === edition.workId && q.text === text)) return [...queue];
  return enqueue(
    queue,
    { workId: edition.workId, segmentId, kind: "phrase", text, source: "marked" },
    edition,
    now,
  );
}
