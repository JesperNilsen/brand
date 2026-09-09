/**
 * Content registry: packs, works and edition headers, from the generated
 * catalog. Adding a pack = adding a folder under content/ and running
 * `pnpm build:content`; there is no list to maintain here any more.
 *
 * The registry knows about every edition but holds no text. Text is fetched
 * per edition by `edition-loader.ts`, so the bundle does not grow with the
 * corpus. Anything here that takes a `TextEdition` needs the text; anything
 * that takes a `TextEditionMeta` does not.
 */
import type {
  ContentPack,
  Shelf,
  TextEdition,
  TextEditionKind,
  TextEditionMeta,
  TextSegment,
  Work,
} from "../types";
import { CONTENT_PACKS, SHELVES, WORKS } from "./catalog.generated";

const packs: ContentPack[] = CONTENT_PACKS;
const works = new Map<string, Work>(WORKS.map((w) => [w.id, w]));
const packWorks = new Map<string, Work[]>();
for (const work of WORKS) {
  const list = packWorks.get(work.contentPackId) ?? [];
  list.push(work);
  packWorks.set(work.contentPackId, list);
}

const shelvesByWork = new Map<string, Shelf[]>();
for (const shelf of SHELVES) {
  for (const workId of shelf.workIds) {
    const list = shelvesByWork.get(workId) ?? [];
    list.push(shelf);
    shelvesByWork.set(workId, list);
  }
}

export function listContentPacks(): ContentPack[] {
  return packs.filter((p) => p.status === "active");
}

export function getContentPack(id: string): ContentPack | undefined {
  return packs.find((p) => p.id === id);
}

/**
 * The shelves worth showing, in curated order.
 *
 * Filtered the way `listContentPacks()` filters on status, and for the same
 * kind of reason: «Danske klassikere» and «Idé og tro» are declared before the
 * first import lands on them, so that the curated order is already settled when
 * it does — but an empty shelf is a card with nothing behind it. Declaring the
 * shelf early and hiding it while it is empty are both deliberate; the rule
 * lives here so no future surface has to remember it.
 *
 * `getShelf()` still resolves an empty shelf: it exists, it is just not shown.
 */
export function listShelves(): Shelf[] {
  return SHELVES.filter((s) => s.workIds.length > 0);
}

export function getShelf(id: string): Shelf | undefined {
  return SHELVES.find((s) => s.id === id);
}

/**
 * Every shelf a work stands on, in catalogue order.
 *
 * A work can stand on more than one without its content entry being
 * duplicated — that is the whole point of the shelf being its own axis rather
 * than a field on `Work`. Unknown ids get an empty list rather than a throw:
 * the caller is asking where something is shelved, not asserting it exists.
 */
export function listShelvesForWork(workId: string): Shelf[] {
  return shelvesByWork.get(workId) ?? [];
}

export function listWorks(packId: string): Work[] {
  return packWorks.get(packId) ?? [];
}

export function getWork(id: string): Work | undefined {
  return works.get(id);
}

export function requireWork(id: string): Work {
  const w = getWork(id);
  if (!w) throw new Error(`Unknown work: ${id}`);
  return w;
}

/**
 * The newest edition of a kind.
 *
 * Newest, not first: originals are versioned too since a work can grow, and
 * the first match in the array is whichever the generator happened to emit
 * first. The same mistake on training editions once served three works their
 * v1 while the writing surface used v2.
 */
export function getEdition(work: Work, kind: TextEditionKind): TextEditionMeta | undefined {
  return work.editions
    .filter((e) => e.kind === kind)
    .sort((a, b) => editionMajorVersion(b.id) - editionMajorVersion(a.id))[0];
}

export function getEditionById(work: Work, id: string): TextEditionMeta | undefined {
  return work.editions.find((e) => e.id === id);
}

/**
 * Major version from an edition id ending in `.vN`.
 *
 * An id with no suffix is version 1, not version 0: `<work>.original` is the
 * first original, and it keeps the unsuffixed form because stored sessions and
 * every training edition's `basedOnEditionId` already name it that way.
 */
export function editionMajorVersion(id: string): number {
  return Number(/\.v(\d+)$/.exec(id)?.[1] ?? 1);
}

/**
 * The edition the user normally types: the newest training edition for the
 * profile, else the original.
 *
 * "Newest" has to be explicit. Once a work has both a v1 and a v2 the first
 * match in the array is whichever the generator happened to emit first, so
 * picking it would serve a superseded text on a directory listing's whim —
 * and stored sessions name the edition they were typed against, so the choice
 * is not cosmetic.
 */
export function defaultEdition(work: Work, languageProfileId: string): TextEditionMeta {
  const training = work.editions
    .filter((e) => e.kind === "training-edition" && e.languageProfileId === languageProfileId)
    .sort((a, b) => editionMajorVersion(b.id) - editionMajorVersion(a.id))[0];
  const original = getEdition(work, "original");
  const chosen = training ?? original;
  if (!chosen) throw new Error(`Work ${work.id} has no editions`);
  return chosen;
}

export function getSegment(edition: TextEdition, id: string): TextSegment | undefined {
  return edition.segments.find((s) => s.id === id);
}

export function firstSegment(edition: TextEdition): TextSegment {
  return [...edition.segments].sort((a, b) => a.order - b.order)[0];
}

/** Segments in reading order. */
export function orderedSegments(edition: TextEdition): TextSegment[] {
  return [...edition.segments].sort((a, b) => a.order - b.order);
}

/** Estimated minutes at a calm 35 net wpm. */
export function estimateMinutes(wordCount: number): number {
  return Math.max(1, Math.round(wordCount / 35));
}

/**
 * The works whose default edition carries a drill bank, in catalog order.
 *
 * Drill starts without a chooser, so something has to pick the edition. It is
 * data, not a constant: today `ibsen-brand` is the only cut bank, and the day a
 * second one lands this returns two and the choice becomes a real one to make
 * rather than a name to find and change.
 */
export function worksWithDrills(languageProfileId: string): Work[] {
  return WORKS.filter((w) => defaultEdition(w, languageProfileId).drills !== undefined);
}

export { loadEditionText, loadedEdition, EditionLoadError } from "./edition-loader";
export { loadDrillBank, DrillLoadError } from "./drill-loader";
