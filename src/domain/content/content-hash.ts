/**
 * The canonical form an edition's contentHash is taken over, shared by the
 * build scripts (node:crypto) and the browser (WebCrypto), so the two can
 * never drift into hashing different bytes.
 *
 * See `scripts/lib/hash.ts` for what the hash means and why it covers only
 * `id`, `order` and `text`.
 */
export function canonicalEditionText(
  segments: ReadonlyArray<{ id: string; order: number; text: string }>,
): string {
  return JSON.stringify(
    [...segments]
      .sort((a, b) => a.order - b.order)
      .map((s) => ({ id: s.id, order: s.order, text: s.text })),
  );
}

/**
 * The same hash, computed with WebCrypto. Returns null where `crypto.subtle`
 * does not exist (a non-secure context), which is a reason to skip the check,
 * never a reason to fail it: the build already verified these bytes.
 */
export async function editionContentHashWeb(
  segments: ReadonlyArray<{ id: string; order: number; text: string }>,
): Promise<string | null> {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) return null;
  const bytes = new TextEncoder().encode(canonicalEditionText(segments));
  const digest = await subtle.digest("SHA-256", bytes);
  const hex = [...new Uint8Array(digest)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return `sha256:${hex}`;
}
