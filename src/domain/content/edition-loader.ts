/**
 * Fetches an edition's text.
 *
 * The catalog names every edition and where its text lives; this is the only
 * place the text itself is read. Three things it guarantees:
 *
 *  - **One fetch per edition.** Results and in-flight requests are cached, so
 *    a reader who returns to a work does not pay for it twice.
 *  - **The text is the text the catalog names.** The file carries its own id
 *    and contentHash, and the hash is recomputed from the segments where
 *    WebCrypto exists. A session records the edition it was typed against, so
 *    a mismatch has to be caught before typing rather than explained after.
 *  - **A failure is a failure.** No partial edition is ever returned; the
 *    caller shows an error and can retry.
 */
import { editionContentHashWeb } from "./content-hash";
import type { TextEdition, TextEditionMeta, TextSegment } from "../types";

export class EditionLoadError extends Error {
  constructor(
    message: string,
    readonly cause?: unknown,
  ) {
    super(message);
    this.name = "EditionLoadError";
  }
}

type EditionAsset = { id: string; contentHash: string; segments: TextSegment[] };

const cache = new Map<string, TextEdition>();
const inFlight = new Map<string, Promise<TextEdition>>();

/** Test seam. The default is the platform fetch. */
export type FetchLike = (input: string) => Promise<{ ok: boolean; status: number; json: () => Promise<unknown> }>;

function isAsset(v: unknown): v is EditionAsset {
  if (typeof v !== "object" || v === null) return false;
  const a = v as Partial<EditionAsset>;
  return (
    typeof a.id === "string" &&
    typeof a.contentHash === "string" &&
    Array.isArray(a.segments) &&
    a.segments.length > 0
  );
}

async function load(meta: TextEditionMeta, doFetch: FetchLike): Promise<TextEdition> {
  let payload: unknown;
  try {
    const res = await doFetch(meta.file);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    payload = await res.json();
  } catch (e) {
    throw new EditionLoadError(`Kunne ikke hente teksten til ${meta.id}.`, e);
  }

  if (!isAsset(payload)) {
    throw new EditionLoadError(`Teksten til ${meta.id} har uventet form.`);
  }
  if (payload.id !== meta.id || payload.contentHash !== meta.contentHash) {
    throw new EditionLoadError(
      `Teksten til ${meta.id} hører til en annen utgave (${payload.id} ${payload.contentHash}).`,
    );
  }
  // The file says which text it is; this checks that it is telling the truth.
  // Skipped only where WebCrypto is absent, which is a missing check, never a
  // failed one — the build verified these same bytes.
  const recomputed = await editionContentHashWeb(payload.segments);
  if (recomputed !== null && recomputed !== meta.contentHash) {
    throw new EditionLoadError(
      `Teksten til ${meta.id} stemmer ikke med sin egen kontrollsum.`,
    );
  }

  return { ...meta, segments: payload.segments };
}

export async function loadEditionText(
  meta: TextEditionMeta,
  doFetch: FetchLike = (input) => fetch(input),
): Promise<TextEdition> {
  const cached = cache.get(meta.contentHash);
  if (cached) return cached;
  const pending = inFlight.get(meta.contentHash);
  if (pending) return pending;

  const promise = load(meta, doFetch)
    .then((edition) => {
      cache.set(meta.contentHash, edition);
      return edition;
    })
    .finally(() => {
      inFlight.delete(meta.contentHash);
    });
  inFlight.set(meta.contentHash, promise);
  return promise;
}

/** Whether the text is already in memory, so a caller can skip its loading state. */
export function loadedEdition(meta: TextEditionMeta): TextEdition | undefined {
  return cache.get(meta.contentHash);
}

/** Tests only. */
export function resetEditionCache(): void {
  cache.clear();
  inFlight.clear();
}
