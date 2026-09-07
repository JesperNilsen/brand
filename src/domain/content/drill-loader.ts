/**
 * Fetches an edition's drill bank.
 *
 * A sibling of `edition-loader.ts` and deliberately its twin: same one-fetch
 * cache, same "the file must be the file the catalog names" check, same refusal
 * to return a partial answer. The bank is verbatim fragments of the edition, so
 * it is corpus text and is never bundled — `pnpm check:bundle` would say so.
 *
 * The hash is taken over the same canonical form an edition's is, with the
 * items standing in for segments, so there is one canonicalisation in the
 * repository rather than two that must be kept in step.
 */
import { editionContentHashWeb } from "./content-hash";
import type { DrillBankMeta, DrillItem } from "../types";

export class DrillLoadError extends Error {
  constructor(
    message: string,
    readonly cause?: unknown,
  ) {
    super(message);
    this.name = "DrillLoadError";
  }
}

type DrillAsset = { id: string; contentHash: string; items: DrillItem[] };

const cache = new Map<string, DrillItem[]>();
const inFlight = new Map<string, Promise<DrillItem[]>>();

export type FetchLike = (
  input: string,
) => Promise<{ ok: boolean; status: number; json: () => Promise<unknown> }>;

function isAsset(v: unknown): v is DrillAsset {
  if (typeof v !== "object" || v === null) return false;
  const a = v as Partial<DrillAsset>;
  return (
    typeof a.id === "string" &&
    typeof a.contentHash === "string" &&
    Array.isArray(a.items) &&
    a.items.length > 0 &&
    a.items.every(
      (i) =>
        typeof i?.id === "string" &&
        typeof i?.text === "string" &&
        typeof i?.order === "number" &&
        (i?.kind === "quote" || i?.kind === "phrase" || i?.kind === "word"),
    )
  );
}

async function load(meta: DrillBankMeta, doFetch: FetchLike): Promise<DrillItem[]> {
  let payload: unknown;
  try {
    const res = await doFetch(meta.file);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    payload = await res.json();
  } catch (e) {
    throw new DrillLoadError(`Kunne ikke hente øvingsbitene til ${meta.id}.`, e);
  }

  if (!isAsset(payload)) {
    throw new DrillLoadError(`Øvingsbitene til ${meta.id} har uventet form.`);
  }
  if (payload.id !== meta.id || payload.contentHash !== meta.contentHash) {
    throw new DrillLoadError(
      `Øvingsbitene til ${meta.id} hører til en annen bank (${payload.id}).`,
    );
  }
  const recomputed = await editionContentHashWeb(payload.items);
  if (recomputed !== null && recomputed !== meta.contentHash) {
    throw new DrillLoadError(
      `Øvingsbitene til ${meta.id} stemmer ikke med sin egen kontrollsum.`,
    );
  }
  return payload.items;
}

export async function loadDrillBank(
  meta: DrillBankMeta,
  doFetch: FetchLike = (input) => fetch(input),
): Promise<DrillItem[]> {
  const cached = cache.get(meta.contentHash);
  if (cached) return cached;
  const pending = inFlight.get(meta.contentHash);
  if (pending) return pending;

  const promise = load(meta, doFetch)
    .then((items) => {
      cache.set(meta.contentHash, items);
      return items;
    })
    .finally(() => {
      inFlight.delete(meta.contentHash);
    });
  inFlight.set(meta.contentHash, promise);
  return promise;
}

/** Tests only. */
export function resetDrillCache(): void {
  cache.clear();
  inFlight.clear();
}
