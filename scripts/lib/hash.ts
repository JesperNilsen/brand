import { createHash } from "node:crypto";

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
 */
export function editionContentHash(
  segments: ReadonlyArray<{ id: string; order: number; text: string }>,
): string {
  const canonical = JSON.stringify(
    [...segments]
      .sort((a, b) => a.order - b.order)
      .map((s) => ({ id: s.id, order: s.order, text: s.text })),
  );
  return `sha256:${createHash("sha256").update(canonical, "utf8").digest("hex")}`;
}
