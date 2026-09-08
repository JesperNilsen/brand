/**
 * Reading a pack's original editions, of which there can now be more than one.
 *
 * A training edition has been versioned since D7: a change that alters the text
 * makes a new version, because a stored result names the edition it was typed
 * against and that text has to still exist. The original was the one place that
 * rule was never implemented — `build-original.ts` wrote a fixed
 * `original.json`, so the only way to add text to a work was to overwrite the
 * edition every earlier session had been typed against, and every training
 * edition derived from it along with it. Nothing would have failed; the results
 * would simply have started naming a text that no longer existed.
 *
 * The shape follows `rules.vN.json` exactly, including the legacy name:
 *
 *   original.json      version 1, id `<work>.original`
 *   original.v2.json   version 2, id `<work>.original.v2`
 *
 * The unversioned name is kept for version 1 rather than renamed, because the
 * id inside it is what stored sessions and every training edition's
 * `basedOnEditionId` already point at.
 */
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

export type OriginalRef = { version: number; file: string };

/** The file a given original version lives in. */
export function originalFileName(version: number): string {
  return version === 1 ? "original.json" : `original.v${version}.json`;
}

/** The segment spec a given original version is built from. */
export function segmentsFileName(version: number): string {
  return version === 1 ? "segments.json" : `segments.v${version}.json`;
}

/** The edition id for a given original version. */
export function originalEditionId(workId: string, version: number): string {
  return version === 1 ? `${workId}.original` : `${workId}.original.v${version}`;
}

/** The version an original edition id names; 1 for the unsuffixed form. */
export function originalVersionOf(editionId: string): number {
  return Number(/\.original\.v(\d+)$/.exec(editionId)?.[1] ?? 1);
}

/** Every original in a pack, oldest first. Throws when there is none. */
export async function listOriginals(dir: string): Promise<OriginalRef[]> {
  const files = await readdir(dir);
  const found: OriginalRef[] = [];
  for (const f of files) {
    if (f === "original.json") found.push({ version: 1, file: f });
    const m = /^original\.v(\d+)\.json$/.exec(f);
    if (m) found.push({ version: Number(m[1]), file: f });
  }
  if (found.length === 0) throw new Error(`no original.json in ${dir}`);
  found.sort((a, b) => a.version - b.version);
  const seen = new Set<number>();
  for (const o of found) {
    if (seen.has(o.version)) throw new Error(`${dir}: two files claim original version ${o.version}`);
    seen.add(o.version);
  }
  return found;
}

/** The newest original in a pack. */
export async function latestOriginal(dir: string): Promise<OriginalRef> {
  return (await listOriginals(dir)).at(-1)!;
}

export async function readOriginal<T>(dir: string, version: number): Promise<T> {
  return JSON.parse(await readFile(path.join(dir, originalFileName(version)), "utf8")) as T;
}
