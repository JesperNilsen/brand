import { beforeEach, describe, expect, it } from "vitest";
import { defaultEdition, getWork } from "@/domain/content/registry";
import {
  EditionLoadError,
  loadedEdition,
  loadEditionText,
  resetEditionCache,
} from "@/domain/content/edition-loader";
import type { TextEditionMeta } from "@/domain/types";
import { fetchFromPublic } from "./load-from-disk";

const meta: TextEditionMeta = defaultEdition(getWork("ibsen-brand")!, "brand-riksmaal");

/** A fetch that serves whatever payload it is given, and counts the calls. */
function serving(payload: unknown, ok = true, status = 200) {
  const counter = { calls: 0 };
  const fetcher = async () => {
    counter.calls += 1;
    return { ok, status, json: async () => payload };
  };
  return { fetcher, counter };
}

describe("edition loader", () => {
  beforeEach(() => resetEditionCache());

  it("loads the real built asset and verifies its hash", async () => {
    const edition = await loadEditionText(meta, fetchFromPublic);
    expect(edition.id).toBe(meta.id);
    expect(edition.segments).toHaveLength(meta.segmentCount);
    expect(edition.segments[0]!.text.length).toBeGreaterThan(0);
    // Metadata survives the merge, so a loaded edition is still a full one.
    expect(edition.contentHash).toBe(meta.contentHash);
    expect(edition.file).toBe(meta.file);
  });

  it("fetches an edition once, however many callers ask", async () => {
    const { fetcher, counter } = serving(await (await fetchFromPublic(meta.file)).json());
    const [a, b] = await Promise.all([
      loadEditionText(meta, fetcher),
      loadEditionText(meta, fetcher),
    ]);
    const c = await loadEditionText(meta, fetcher);
    expect(counter.calls).toBe(1);
    expect(a).toBe(b);
    expect(b).toBe(c);
    expect(loadedEdition(meta)).toBe(a);
  });

  it("reports a network failure rather than returning half an edition", async () => {
    await expect(loadEditionText(meta, serving(null, false, 503).fetcher)).rejects.toBeInstanceOf(
      EditionLoadError,
    );
    expect(loadedEdition(meta)).toBeUndefined();
  });

  it("does not cache a failure, so a retry can succeed", async () => {
    await expect(loadEditionText(meta, serving(null, false, 503).fetcher)).rejects.toThrow();
    const edition = await loadEditionText(meta, fetchFromPublic);
    expect(edition.segments).toHaveLength(meta.segmentCount);
  });

  it("refuses a file belonging to another edition", async () => {
    const other = defaultEdition(getWork("kielland-gift")!, "brand-riksmaal");
    const payload = await (await fetchFromPublic(other.file)).json();
    await expect(loadEditionText(meta, serving(payload).fetcher)).rejects.toThrow(/annen utgave/);
  });

  it("refuses text that does not match the hash it claims", async () => {
    const payload = (await (await fetchFromPublic(meta.file)).json()) as {
      segments: { text: string }[];
    };
    // The file still says it is this edition; only the text has moved.
    payload.segments[0]!.text = `${payload.segments[0]!.text} og litt til`;
    await expect(loadEditionText(meta, serving(payload).fetcher)).rejects.toThrow(/kontrollsum/);
  });

  it("refuses a payload that is not an edition at all", async () => {
    await expect(loadEditionText(meta, serving({ hello: "world" }).fetcher)).rejects.toThrow(
      /uventet form/,
    );
  });
});
