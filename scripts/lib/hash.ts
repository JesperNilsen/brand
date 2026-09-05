import { createHash } from "node:crypto";
import { canonicalEditionText } from "../../src/domain/content/content-hash";

/**
 * The identity of an edition's text, as a hash.
 *
 * Covers exactly the segments in reading order and, per segment, only `id`,
 * `order` and `text`: the things that change what the reader types. A
 * reworded editorial note, a new label or a recomputed word count must not
 * move it, or the hash stops meaning "this is the text you typed" and starts
 * meaning "something in this file changed".
 *
 * The unfiltered text is hashed. Which practice form a session used is a
 * separate fact and is already carried by `textFilterId`; folding the two
 * together would make one field answer two questions badly.
 *
 * The canonical form lives in `src/domain/content/content-hash.ts` because the
 * browser recomputes the same hash over a fetched edition; two copies of the
 * canonicalisation would be two things to keep in step.
 */
export function editionContentHash(
  segments: ReadonlyArray<{ id: string; order: number; text: string }>,
): string {
  return `sha256:${createHash("sha256")
    .update(canonicalEditionText(segments), "utf8")
    .digest("hex")}`;
}
