import { rankPracticeFocus } from "../engine/practice-focus";
import type { CharacterCount, CharacterMiss } from "../engine/metrics";
import type { TextEdition } from "../types";
import { enqueue } from "./queue";
import type { QueueItem } from "./types";

/** The floor `scripts/lib/drills.ts` puts under an authored `word` item. */
const MIN_WORD_LENGTH = 4;

/**
 * Leading/trailing punctuation, trimmed so a token reads as a word.
 *
 * Trimming is safe for the verbatim rule precisely because it only ever
 * shortens a contiguous slice: «fort!» trimmed to «fort» is still a substring
 * of the segment it came from. Nothing here may ever JOIN two slices.
 */
function wordsOf(text: string): string[] {
  return text
    .split(/\s+/)
    .map((t) => t.replace(/^[^\p{L}\p{N}]+/u, "").replace(/[^\p{L}\p{N}]+$/u, ""))
    .filter((t) => t.length >= MIN_WORD_LENGTH);
}

/**
 * Pieces derived from what this reader actually got wrong.
 *
 * Source (b) of T-12's three. The ranking is `rankPracticeFocus`'s and not a
 * second one: Q-014's trap is that a queue filled on raw miss count is a queue
 * full of `e`, `r` and space for every reader in every session, so the
 * characters come back ordered by RATE and already past the opportunity floor.
 *
 * Every derived piece goes through `enqueue` like any other, so the verbatim
 * rule is proved here too rather than assumed from the fact that the words
 * were read out of the edition a moment ago. That is not belt-and-braces: the
 * words are trimmed after they are read, and the check is what makes the
 * trimming safe.
 */
export function deriveFromDeviations(
  queue: readonly QueueItem[],
  edition: TextEdition,
  measured: { misses: readonly CharacterMiss[]; opportunities: readonly CharacterCount[] },
  limit = 5,
  now: () => Date = () => new Date(),
): QueueItem[] {
  const focus = rankPracticeFocus(measured.misses, measured.opportunities);
  if (focus.length === 0) return [...queue];

  const already = new Set(queue.map((q) => q.text));
  const picked: { segmentId: string; text: string }[] = [];

  for (const item of focus) {
    for (const segment of edition.segments) {
      if (picked.length >= limit) break;
      if (!segment.text.includes(item.expected)) continue;
      const word = wordsOf(segment.text).find(
        (w) => w.includes(item.expected) && !already.has(w),
      );
      if (!word) continue;
      already.add(word);
      picked.push({ segmentId: segment.id, text: word });
      break;
    }
    if (picked.length >= limit) break;
  }

  let next = [...queue];
  for (const p of picked) {
    next = enqueue(
      next,
      {
        workId: edition.workId,
        segmentId: p.segmentId,
        kind: "word",
        text: p.text,
        source: "deviation",
      },
      edition,
      now,
    );
  }
  return next;
}
