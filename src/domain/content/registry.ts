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
  TextEdition,
  TextEditionKind,
  TextEditionMeta,
  TextSegment,
  Work,
} from "../types";
import { CONTENT_PACKS, WORKS } from "./catalog.generated";

const packs: ContentPack[] = CONTENT_PACKS;
const works = new Map<string, Work>(WORKS.map((w) => [w.id, w]));
const packWorks = new Map<string, Work[]>();
for (const work of WORKS) {
  const list = packWorks.get(work.contentPackId) ?? [];
  list.push(work);
  packWorks.set(work.contentPackId, list);
}

export function listContentPacks(): ContentPack[] {
  return packs.filter((p) => p.status === "active");
}

export function getContentPack(id: string): ContentPack | undefined {
  return packs.find((p) => p.id === id);
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

export function getEdition(work: Work, kind: TextEditionKind): TextEditionMeta | undefined {
  return work.editions.find((e) => e.kind === kind);
}

export function getEditionById(work: Work, id: string): TextEditionMeta | undefined {
  return work.editions.find((e) => e.id === id);
}

/** The edition the user normally types: the training edition for the profile, else the original. */
export function defaultEdition(work: Work, languageProfileId: string): TextEditionMeta {
  const training = work.editions.find(
    (e) => e.kind === "training-edition" && e.languageProfileId === languageProfileId,
  );
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

export { loadEditionText, loadedEdition, EditionLoadError } from "./edition-loader";
