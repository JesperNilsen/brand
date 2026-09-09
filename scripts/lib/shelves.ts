/**
 * Reading `content/shelves.json`: the curated shelves the catalogue is
 * presented on.
 *
 * The file sits beside the pack folders rather than inside one because a shelf
 * spans packs and a pack owns its works. Keeping it out of `content/<pack>/`
 * is also what lets the generator stay unchanged in shape: `build:content`
 * walks directories, so a file at the root is not a pack by accident.
 *
 * The two rules worth a machine are the two that go wrong silently. A shelf
 * naming a work that no longer exists renders an empty row nobody notices, and
 * a work on no shelf is invisible the moment the catalogue is browsed by shelf
 * rather than by pack — the work is still in `WORKS`, still reachable by id,
 * and still completely absent from the surface a reader uses.
 */
import { readFile } from "node:fs/promises";
import path from "node:path";
import type { Shelf } from "../../src/domain/types";

type ShelvesFile = { shelves: Shelf[] };

/**
 * The shelves for the catalogue. Unlike `review.json`, absence is an error:
 * every work has to stand somewhere, so there is no such thing as a catalogue
 * with no shelves.
 */
export async function loadShelves(contentRoot: string): Promise<Shelf[]> {
  const file = path.join(contentRoot, "shelves.json");
  let raw: string;
  try {
    raw = await readFile(file, "utf8");
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "ENOENT") {
      throw new Error(`content/shelves.json mangler — hver hylle i docs/spec/CORPUS.md skal stå der.`);
    }
    throw e;
  }
  const parsed = JSON.parse(raw) as ShelvesFile;
  if (!parsed || !Array.isArray(parsed.shelves)) {
    throw new Error(`content/shelves.json: forventet { "shelves": [...] }`);
  }
  return parsed.shelves;
}

/**
 * Complain about shelves that contradict the catalogue they describe.
 *
 * An empty shelf is not a contradiction: «Danske klassikere» and «Idé og tro»
 * are declared before the first import lands on them, and declaring them early
 * is what keeps the curated order stable when it does.
 */
export function shelfProblems(shelves: readonly Shelf[], workIds: readonly string[]): string[] {
  const problems: string[] = [];
  const known = new Set(workIds);
  const seenShelves = new Set<string>();
  const shelved = new Set<string>();

  for (const shelf of shelves) {
    const where = `shelves.json ${shelf.id || "(uten id)"}`;
    if (!shelf.id) problems.push(`${where}: hylle uten id`);
    else if (seenShelves.has(shelf.id)) problems.push(`${where}: hylle-id gjentas`);
    seenShelves.add(shelf.id);
    if (!shelf.title?.trim()) problems.push(`${where}: hylle uten tittel`);
    if (!shelf.description?.trim()) problems.push(`${where}: hylle uten beskrivelse`);
    if (!Array.isArray(shelf.workIds)) {
      problems.push(`${where}: workIds må være en liste`);
      continue;
    }
    const seenHere = new Set<string>();
    for (const workId of shelf.workIds) {
      if (!known.has(workId)) {
        problems.push(`${where}: navngir verket «${workId}», som ikke finnes i katalogen`);
      }
      if (seenHere.has(workId)) {
        problems.push(`${where}: verket «${workId}» står to ganger på samme hylle`);
      }
      seenHere.add(workId);
      shelved.add(workId);
    }
  }

  for (const workId of workIds) {
    if (!shelved.has(workId)) {
      problems.push(
        `shelves.json: verket «${workId}» står ikke på noen hylle — ` +
          `et verk uten hylle er usynlig når katalogen leses hylle for hylle`,
      );
    }
  }

  return problems;
}
